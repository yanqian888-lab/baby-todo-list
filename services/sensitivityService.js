// services/sensitivityService.js
// 排敏功能服务层 - 优化版

const db = wx.cloud.database();
const { stores } = require('../utils/dataStore');
const { safeDateFormat, getUserId, getBabyId } = require('../utils/helpers');

// 食材数据缓存
let foodsCache = null;
let foodsCacheTime = null;
const CACHE_EXPIRY = 60 * 60 * 1000; // 1小时缓存

/**
 * 处理数据库操作错误
 * @param {Error} error - 错误对象
 * @param {string} operation - 操作描述
 * @param {string} collection - 集合名称
 */
function handleDatabaseError(error, operation, collection) {
  console.error(`${operation}失败 (${collection}):`, error);
  
  if (error.errCode === -502005) {
    wx.showModal({
      title: '集合不存在',
      content: `集合 '${collection}' 不存在，请在云开发控制台创建该集合。`,
      showCancel: false,
      confirmText: '知道了'
    });
  }
  
  throw error;
}

/**
 * 排敏服务类
 */
class SensitivityService {
  /**
   * 获取排敏食物数据
   * @returns {Promise<Array>} 食物列表
   */
  static async getSensitivityFoods() {
    // 强制使用本地JSON作为唯一数据源，确保和Excel完全一致
    // 清除旧缓存，避免云端/缓存数据覆盖最新本地数据
    foodsCache = null;
    foodsCacheTime = null;

    try {
      const foodData = require('../data/sensitivityFoods.js');
      const foods = [];
      foodData.categories.forEach(category => {
        category.foods.forEach(food => {
          foods.push({
            ...food,
            category: category.name
          });
        });
      });
      foodsCache = foods;
      foodsCacheTime = Date.now();
      return foods;
    } catch (error) {
      console.error('加载本地食物数据失败:', error);
      return [];
    }
  }

  /**
   * 获取过敏等级配置
   * @returns {Object}
   */
  static async getAllergyConfig() {
    try {
      const foodData = require('../data/sensitivityFoods.js');
      return foodData.allergyLevels;
    } catch (error) {
      return {
        "1": { name: "低敏", days: 3 },
        "2": { name: "中敏", days: 3 },
        "3": { name: "高敏", days: 5 }
      };
    }
  }

  /**
   * 按家庭获取宝宝信息（优先从家庭缓存/云端读取）
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Object>}
   */
  static async getFamilyBabyInfo(familyId = null) {
    // 1. 如果有 familyId，优先读取本地家庭隔离缓存
    if (familyId) {
      const familyBabyInfo = wx.getStorageSync(`babyInfo_${familyId}`);
      if (familyBabyInfo) {
        // 如果本地缓存缺少 safeFoodsList，尝试从全局缓存合并补充
        if (!familyBabyInfo.safeFoodsList) {
          const globalBabyInfo = wx.getStorageSync('babyInfo') || {};
          if (globalBabyInfo.safeFoodsList) {
            return { ...globalBabyInfo, ...familyBabyInfo };
          }
        }
        return familyBabyInfo;
      }
      // 2. 尝试从 families 集合云端读取
      try {
        const familyRes = await db.collection('families').doc(familyId).get();
        if (familyRes.data && familyRes.data.babyInfo) {
          let cloudBabyInfo = familyRes.data.babyInfo;
          // 如果云端缺少 safeFoodsList，尝试从全局缓存合并补充
          if (!cloudBabyInfo.safeFoodsList) {
            const globalBabyInfo = wx.getStorageSync('babyInfo') || {};
            if (globalBabyInfo.safeFoodsList) {
              cloudBabyInfo = { ...globalBabyInfo, ...cloudBabyInfo };
            }
          }
          wx.setStorageSync(`babyInfo_${familyId}`, cloudBabyInfo);
          return cloudBabyInfo;
        }
      } catch (e) {
        console.warn('从 families 读取宝宝信息失败:', e);
      }
    }
    // 3. 回退到全局 babyInfo（兼容旧数据和无家庭模式）
    return wx.getStorageSync('babyInfo') || {};
  }

  /**
   * 按家庭保存宝宝信息中的 safeFoodsList
   * @param {Object} babyInfo - 宝宝信息
   * @param {string} familyId - 家庭ID
   */
  static async saveFamilyBabyInfo(babyInfo, familyId = null) {
    if (familyId) {
      // 保存到本地家庭隔离缓存
      wx.setStorageSync(`babyInfo_${familyId}`, babyInfo);
      // 尝试同步到 families 集合（静默失败不影响）
      try {
        const familyService = require('../services/familyService');
        await familyService.updateBabyInfo(familyId, babyInfo);
        console.log('✅ 已同步宝宝信息到家庭:', familyId);
      } catch (e) {
        console.warn('同步宝宝信息到家庭失败:', e);
      }
    }
    // 始终保存到全局缓存（作为兜底和兼容）
    wx.setStorageSync('babyInfo', babyInfo);
    const userInfo = wx.getStorageSync('userInfo') || {};
    userInfo.babyInfo = babyInfo;
    wx.setStorageSync('userInfo', userInfo);
  }

  /**
   * 获取排敏进度
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Object>}
   */
  static async getSensitivityProgress(userId, babyId, familyId = null) {
    try {
      const allFoods = await this.getSensitivityFoods();
      console.log("📋 所有食物数量:", allFoods.length);
      console.log("📊 获取排敏进度:", { userId, babyId, familyId });
      
      // 获取排敏记录中的已完成食物
      const completedFoods = await this._getCompletedFoods(userId, babyId, familyId);
      
      // 额外获取宝宝信息中的食物（这些也视为已完成）
      const babyInfo = await this.getFamilyBabyInfo(familyId);
      const safeFoodsList = babyInfo.safeFoodsList || [];
      
      if (Array.isArray(safeFoodsList)) {
        safeFoodsList.forEach(food => {
          const foodName = typeof food === 'string' ? food : (food.foodName || food.name);
          if (foodName) {
            completedFoods.add(foodName);
          }
        });
      }
      
      console.log("✅ 已完成食物（含宝宝信息）:", Array.from(completedFoods));
      
      const completedCount = completedFoods.size;
      const totalCount = allFoods.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return { totalCount, completedCount, progress };
    } catch (error) {
      console.error('获取排敏进度失败:', error);
      return { totalCount: 0, completedCount: 0, progress: 0 };
    }
  }

  /**
   * 获取推荐排敏食物
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @param {number} limit - 推荐数量
   * @returns {Promise<Array>}
   */
  static async getRecommendedFoods(userId, babyId, limit = 3, familyId = null) {
    try {
      // 1. 首先获取宝宝信息中的已排敏食物（最重要，优先处理）
      const babyInfo = await this.getFamilyBabyInfo(familyId);
      
      // 按家庭隔离的 safeFoodsList
      let safeFoodsList = babyInfo.safeFoodsList || [];
      console.log('✅ 按家庭获取 safeFoodsList 数量:', safeFoodsList.length, 'familyId:', familyId);
      
      // 提取已排敏食物名称（强制转为字符串）
      const babySafeFoodNames = new Set();
      safeFoodsList.forEach(food => {
        let foodName = null;
        if (typeof food === 'string') {
          foodName = food;
        } else if (food && food.foodName) {
          foodName = food.foodName;
        } else if (food && food.name) {
          foodName = food.name;
        }
        if (foodName) {
          babySafeFoodNames.add(String(foodName).trim());
        }
      });
      
      console.log('👶 宝宝信息页已排敏食物:', Array.from(babySafeFoodNames));
      
      // 2. 获取所有食物和排敏记录
      const [allFoods, records, config] = await Promise.all([
        this.getSensitivityFoods(),
        this.getUserSensitivityRecords(userId, babyId, familyId),
        this.getAllergyConfig()
      ]);

      const completedFoods = new Set();
      const ongoingFoods = new Map();

      // 3. 将宝宝信息中的食物直接标记为已完成（关键步骤）
      babySafeFoodNames.forEach(foodName => {
        completedFoods.add(foodName);
        console.log('✅ 标记为已完成:', foodName);
      });

      // 4. 处理排敏记录（排敏tab页添加的食物按天数计算）
      await this._processRecords(records, allFoods, config, completedFoods, ongoingFoods, familyId);

      // 5. 构建推荐列表（过滤掉所有已完成食物）
      const ongoingList = [];
      const notStartedList = [];

      for (const food of allFoods) {
        // 检查是否在宝宝信息中或已完成
        if (babySafeFoodNames.has(food.name) || completedFoods.has(food.name)) {
          console.log('⏭️ 跳过已完成/宝宝信息食物:', food.name);
          continue;
        }

        const progress = ongoingFoods.get(food.name);
        const foodData = {
          ...food,
          ongoing: !!progress,
          sensitivityDays: progress?.sensitivityDays || 0,
          totalSensitivityDays: progress?.totalSensitivityDays || config[food.allergyLevel]?.days || 3
        };

        if (progress) {
          ongoingList.push(foodData);
        } else {
          notStartedList.push(foodData);
        }
      }

      // 排序辅助函数：按 sensitivityOrder 升序，相同则随机
      const sortBySensitivityOrder = (list) => {
        return list.sort((a, b) => {
          const orderA = a.sensitivityOrder !== undefined ? a.sensitivityOrder : 999;
          const orderB = b.sensitivityOrder !== undefined ? b.sensitivityOrder : 999;
          if (orderA !== orderB) return orderA - orderB;
          return Math.random() - 0.5;
        });
      };

      // 优先推荐排敏中（天数不达标）的食物，再推荐未开始的
      // 两组内部均按 sensitivityOrder 排序，相同数字随机
      sortBySensitivityOrder(ongoingList);
      sortBySensitivityOrder(notStartedList);
      const recommendedFoods = [...ongoingList, ...notStartedList].slice(0, limit);
      
      console.log('📤 推荐食物:', recommendedFoods.map(f => ({ name: f.name, ongoing: f.ongoing, days: `${f.sensitivityDays}/${f.totalSensitivityDays}`, sensitivityOrder: f.sensitivityOrder })));

      return recommendedFoods;
    } catch (error) {
      console.error('获取推荐食物失败:', error);
      return [];
    }
  }

  /**
   * 获取用户排敏记录
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Array>}
   */
  static async getUserSensitivityRecords(userId, babyId, familyId = null) {
    // 合并云端和本地记录
    const [cloudRecords, localRecords] = await Promise.all([
      this._getCloudRecords(userId, babyId, familyId).catch(() => []),
      Promise.resolve(this._getLocalRecords(userId, babyId, familyId))
    ]);

    return this._mergeAndDeduplicateRecords([...cloudRecords, ...localRecords]);
  }

  /**
   * 保存排敏记录
   * @param {Object} record - 记录数据
   * @returns {Promise<Object>}
   */
  static async saveSensitivityRecord(record) {
    const enrichedRecord = {
      ...record,
      _id: record._id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 1,
      sensitivityDays: 1,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 保存到本地
    this._saveLocalRecord(enrichedRecord);

    // 尝试同步到云端
    try {
      await this._syncToCloud(enrichedRecord);
    } catch (error) {
      console.warn('同步到云端失败，仅保存本地:', error);
    }
    
    // 检查食物是否已完成排敏，如果完成则添加到宝宝信息的已排敏列表
    try {
      await this._checkAndAddToSafeFoods(record.userId, record.babyId, record.foodName || record.foodId, record.familyId);
    } catch (e) {
      console.warn('检查并添加到安全食物失败:', e);
    }

    return { success: true, data: { _id: enrichedRecord._id } };
  }
  
  /**
   * 检查食物是否已完成排敏，如果完成则添加到宝宝信息的已排敏列表
   * @private
   */
  static async _checkAndAddToSafeFoods(userId, babyId, foodName, familyId = null) {
    if (!foodName) return;
    
    // 获取该食物的所有排敏记录
    const records = await this.getUserSensitivityRecords(userId, babyId, familyId);
    const foodRecords = records.filter(r => r.foodName === foodName || r.foodId === foodName);
    
    if (foodRecords.length === 0) return;
    
    // 计算独特日期数（使用 safeDateFormat 避免时区问题）
    const uniqueDates = new Set();
    foodRecords.forEach(record => {
      const dateStr = safeDateFormat(record.date);
      if (dateStr) {
        uniqueDates.add(dateStr);
      }
    });
    
    // 获取食物信息和所需天数
    const allFoods = await this.getSensitivityFoods();
    const food = allFoods.find(f => f.name === foodName);
    const config = await this.getAllergyConfig();
    const requiredDays = food ? config[food.allergyLevel]?.days || 3 : 3;
    
    console.log(`🔍 检查食物 ${foodName} 排敏进度: ${uniqueDates.size}/${requiredDays} 天`);
    
    // 如果已完成排敏，添加到宝宝信息
    if (uniqueDates.size >= requiredDays) {
      console.log(`✅ 食物 ${foodName} 已完成排敏，添加到宝宝信息`);
      
      // 获取当前宝宝信息（按家庭隔离）
      let babyInfo = await this.getFamilyBabyInfo(familyId);
      let safeFoodsList = babyInfo.safeFoodsList || [];
      
      // 检查是否已存在
      const exists = safeFoodsList.some(f => f.foodName === foodName || f.name === foodName);
      
      if (!exists) {
        // 添加新的已排敏食物
        safeFoodsList.push({
          foodId: food ? food._id : foodName,
          foodName: foodName,
          category: food ? food.category : '',
          likeStatus: foodRecords[foodRecords.length - 1]?.likeStatus || 0,
          allergyStatus: foodRecords[foodRecords.length - 1]?.allergyStatus || 0
        });
        
        // 更新宝宝信息
        babyInfo.safeFoodsList = safeFoodsList;
        babyInfo.safeFoods = safeFoodsList.map(f => f.foodName).join(',');
        
        // 按家庭保存
        await this.saveFamilyBabyInfo(babyInfo, familyId);
        
        console.log(`✅ 已添加 ${foodName} 到宝宝信息的已排敏列表 (familyId: ${familyId})`);
      }
    }
  }

  /**
   * 更新排敏记录
   * @param {Object} record - 记录数据
   * @returns {Promise<Object>}
   */
  static async updateSensitivityRecord(record) {
    try {
      // 确保记录有 updatedAt
      const enrichedRecord = {
        ...record,
        updatedAt: record.updatedAt || new Date().toISOString()
      };
      
      // 先保存到本地
      this._saveLocalRecord(enrichedRecord);

      // 尝试同步到云端
      try {
        await this._syncToCloud(enrichedRecord);
      } catch (error) {
        console.warn('同步到云端失败，仅更新本地:', error);
      }

      return { success: true, data: { _id: enrichedRecord._id } };
    } catch (error) {
      console.error('更新排敏记录失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取宝宝信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  static async getBabyInfo(userId) {
    try {
      // 优先从本地获取
      const localInfo = stores.babyInfo.getLocal();
      if (localInfo && localInfo.userId === userId) {
        return localInfo;
      }

      // 从云端获取
      const result = await db.collection('baby_info').where({ userId }).get();
      return result.data[0] || null;
    } catch (error) {
      handleDatabaseError(error, '获取宝宝信息', 'baby_info');
    }
  }

  /**
   * 保存宝宝信息
   * @param {Object} babyInfo - 宝宝信息
   * @returns {Promise<Object>}
   */
  static async saveBabyInfo(babyInfo) {
    const data = {
      ...babyInfo,
      updatedAt: new Date()
    };

    // 保存到本地
    stores.babyInfo.setLocal(data);

    // 保存到云端
    try {
      // 准备云端数据，删除 _id 字段（云端会自动生成）
      const cloudData = { ...data };
      delete cloudData._id;
      
      const existing = await this.getBabyInfo(babyInfo.userId);
      if (existing && existing._id) {
        await db.collection('baby_info').doc(existing._id).update({ data: cloudData });
        return existing._id;
      } else {
        cloudData.createdAt = new Date();
        const result = await db.collection('baby_info').add({ data: cloudData });
        return result._id;
      }
    } catch (error) {
      handleDatabaseError(error, '保存宝宝信息', 'baby_info');
    }
  }

  // ============ 私有方法 ============

  /**
   * 获取已完成排敏的食物集合
   * @private
   */
  static async _getCompletedFoods(userId, babyId, familyId = null) {
    const records = await this.getUserSensitivityRecords(userId, babyId, familyId);
    console.log("📝 获取到排敏记录数:", records.length);
    const config = await this.getAllergyConfig();
    const completedFoods = new Set();

    const foodGroups = this._groupRecordsByFood(records);
    console.log("🍎 食物分组:", Array.from(foodGroups.keys()));
    
    const allFoods = await this.getSensitivityFoods();
    
    for (const [foodName, foodRecords] of foodGroups) {
      const food = allFoods.find(f => f.name === foodName);
      
      if (!food) {
        console.warn('⚠️ 找不到食物信息:', foodName);
        continue;
      }
      
      // 计算实际排敏天数（按记录条数，同一天只算一次）
      const uniqueDates = new Set();
      foodRecords.forEach(record => {
        const dateStr = safeDateFormat(record.date);
        if (dateStr) {
          uniqueDates.add(dateStr);
        }
      });
      const actualDays = uniqueDates.size;
      
      const requiredDays = config[food.allergyLevel]?.days || 3;
      console.log("📅 食物:", foodName, "实际排敏天数:", actualDays, "需要天数:", requiredDays);
      
      if (actualDays >= requiredDays) {
        completedFoods.add(foodName);
      }
    }
    
    // 添加宝宝信息中标记的已排敏食物（按家庭隔离）
    try {
      const babyInfo = await this.getFamilyBabyInfo(familyId);
      const safeFoodsList = babyInfo.safeFoodsList || [];
      if (safeFoodsList.length > 0) {
        console.log("👶 从宝宝信息获取已排敏食物:", safeFoodsList);
        safeFoodsList.forEach(food => {
          const foodName = food.foodName || food.name;
          if (foodName) {
            completedFoods.add(foodName);
            console.log("✅ 添加已排敏食物:", foodName);
          }
        });
      }
    } catch (e) {
      console.warn('获取宝宝信息中的已排敏食物失败:', e);
    }

    return completedFoods;
  }

  /**
   * 处理排敏记录，区分已完成和进行中
   * @private
   */
  static async _processRecords(records, allFoods, config, completedFoods, ongoingFoods, familyId = null) {
    const foodGroups = this._groupRecordsByFood(records);
    console.log("🍎 食物分组:", Array.from(foodGroups.keys()));
    
    // 直接从宝宝信息获取已排敏食物（双重保险，按家庭隔离）
    const babyInfo = await this.getFamilyBabyInfo(familyId);
    const safeFoodsList = babyInfo.safeFoodsList || [];
    const babySafeFoods = new Set();
    
    if (Array.isArray(safeFoodsList)) {
      safeFoodsList.forEach(food => {
        const foodName = typeof food === 'string' ? food : (food.foodName || food.name);
        if (foodName) {
          babySafeFoods.add(foodName);
          completedFoods.add(foodName); // 同时添加到 completedFoods
        }
      });
    }
    
    console.log("👶 _processRecords 中宝宝信息已排敏食物:", Array.from(babySafeFoods));

    for (const [foodName, foodRecords] of foodGroups) {
      // 如果食物在 completedFoods 中（包括来自宝宝信息页的），跳过
      if (completedFoods.has(foodName)) {
        console.log("✅ 食物已完成，跳过排敏记录处理:", foodName);
        continue;
      }
      
      // 再次检查是否在宝宝信息中（以防 completedFoods 没包含）
      if (babySafeFoods.has(foodName)) {
        console.log("✅ 食物在宝宝信息中，标记为完成:", foodName);
        completedFoods.add(foodName);
        continue;
      }
      
      const food = allFoods.find(f => f.name === foodName);
      if (!food) continue;

      // 计算实际排敏天数（按记录条数，同一天只算一次）
      const uniqueDates = new Set();
      foodRecords.forEach(record => {
        const dateStr = safeDateFormat(record.date);
        if (dateStr) {
          uniqueDates.add(dateStr);
        }
      });
      const actualDays = uniqueDates.size;
      
      const totalDays = config[food.allergyLevel]?.days || 3;
      console.log("📅 食物:", foodName, "实际排敏天数:", actualDays, "需要天数:", totalDays, "记录数:", foodRecords.length);

      if (actualDays >= totalDays) {
        completedFoods.add(foodName);
      } else {
        ongoingFoods.set(foodName, { sensitivityDays: actualDays, totalSensitivityDays: totalDays });
      }
    }
  }

  /**
   * 按食物名称分组记录
   * @private
   */
  static _groupRecordsByFood(records) {
    const groups = new Map();
    for (const record of records) {
      if (!record.foodName) continue;
      if (!groups.has(record.foodName)) {
        groups.set(record.foodName, []);
      }
      groups.get(record.foodName).push(record);
    }
    return groups;
  }

  /**
   * 计算排敏天数
   * @private
   */
  static _calculateSensitivityDays(recordDate) {
    const start = new Date(recordDate);
    const now = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * 获取云端记录
   * @private
   */
  static async _getCloudRecords(userId, babyId, familyId = null) {
    const query = {};
    if (familyId) {
      // 家庭模式下共享可见：只按家庭ID查询，不限定用户
      query.familyId = familyId;
    } else {
      query.userId = userId;
      if (babyId && babyId !== 'local-baby-id') {
        query.babyId = babyId;
      }
    }

    const result = await db.collection('sensitivity_records').where(query).get();
    return result.data || [];
  }

  /**
   * 获取本地记录
   * @private
   */
  static _getLocalRecords(userId, babyId, familyId = null) {
    let allRecords = stores.sensitivityRecords.getLocal();
    console.log('📦 本地所有记录:', allRecords.length, '条');
    console.log('🔍 过滤条件:', { userId, babyId, familyId });
    
    // 自动清理脏数据：家庭模式下同一天只保留最新的一条记录
    if (familyId) {
      const cleanMap = new Map();
      allRecords.forEach(record => {
        const rFamilyId = record.familyId || null;
        const rDate = safeDateFormat(record.date || record.createdAt);
        if (!rDate) return;
        
        if (rFamilyId === familyId) {
          const key = `${rFamilyId}-${rDate}`;
          const existing = cleanMap.get(key);
          if (!existing || this._shouldReplaceRecord(existing, record)) {
            cleanMap.set(key, record);
          }
        }
      });
      
      // 重建本地存储：保留其他家庭/非家庭记录 + 清理后的当前家庭记录
      const cleanedFamilyRecords = Array.from(cleanMap.values());
      const otherRecords = allRecords.filter(record => {
        const rFamilyId = record.familyId || null;
        return rFamilyId !== familyId;
      });
      const newAllRecords = [...otherRecords, ...cleanedFamilyRecords];
      if (newAllRecords.length !== allRecords.length) {
        console.log('🧹 清理家庭脏数据:', allRecords.length, '->', newAllRecords.length);
        stores.sensitivityRecords.setLocal(newAllRecords);
        allRecords = newAllRecords;
      }
    }
    
    const filtered = allRecords.filter(record => {
      // 家庭模式下共享可见：只按 familyId 过滤
      if (familyId) {
        return record.familyId === familyId;
      }
      
      // 兼容大小写不同的userId
      const recordUserId = record.userId || record.openId || record.openid || record._openid;
      if (recordUserId !== userId) {
        console.log('❌ userId不匹配:', recordUserId, '!==', userId);
        return false;
      }
      if (babyId && record.babyId !== babyId && record.babyId !== 'local-baby-id') {
        console.log('❌ babyId不匹配:', record.babyId, '!==', babyId);
        return false;
      }
      return true;
    });
    
    console.log('✅ 过滤后记录:', filtered.length, '条');
    return filtered;
  }

  /**
   * 合并并去重记录
   * @private
   */
  static _mergeAndDeduplicateRecords(records) {
    const uniqueMap = new Map();

    for (const record of records) {
      const userId = record.userId || record._openid || record.openId || record.openid || '';
      const babyId = getBabyId(record);
      const foodName = record.foodName || '';
      const dateKey = safeDateFormat(record.date || record.createdAt);
      const familyId = record.familyId || '';
      if (!dateKey) continue; // 跳过无效日期的记录
      
      // 家庭模式下共享去重，不按用户隔离
      const key = familyId
        ? `${familyId}-${dateKey}`
        : `${userId}-${babyId}-${foodName}-${dateKey}`;

      const existing = uniqueMap.get(key);
      if (!existing || this._shouldReplaceRecord(existing, record)) {
        uniqueMap.set(key, record);
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * 判断是否替换记录
   * @private
   */
  static _shouldReplaceRecord(existing, newRecord) {
    // 优先使用 updatedAt 判断谁更新
    if (newRecord.updatedAt && existing.updatedAt) {
      return new Date(newRecord.updatedAt) > new Date(existing.updatedAt);
    }
    // 新记录有 updatedAt 而旧记录没有，优先使用新记录
    if (newRecord.updatedAt && !existing.updatedAt) return true;
    // 旧记录有 updatedAt 而新记录没有，保留旧记录
    if (!newRecord.updatedAt && existing.updatedAt) return false;
    // 都没有 updatedAt 时，按日期判断
    return new Date(newRecord.date) > new Date(existing.date);
  }

  /**
   * 保存记录到本地
   * @private
   */
  static _saveLocalRecord(record) {
    const records = stores.sensitivityRecords.getLocal();
    
    // 查找同一天记录（使用安全日期格式化）
    const recordDate = safeDateFormat(record.date);
    const recordFamilyId = record.familyId || null;
    let existingIndex = -1;
    
    if (recordFamilyId) {
      // 家庭模式下共享：按 familyId + date 匹配，忽略 userId、babyId 和 foodName
      // 确保每天只有一条记录（修改食物时覆盖旧记录）
      existingIndex = records.findIndex(r => {
        const rDate = safeDateFormat(r.date);
        const rFamilyId = r.familyId || null;
        return rFamilyId === recordFamilyId && rDate === recordDate;
      });
    } else {
      existingIndex = records.findIndex(r => {
        const rDate = safeDateFormat(r.date);
        const rUserId = getUserId(r);
        const rBabyId = getBabyId(r);
        const rFamilyId = r.familyId || null;
        return rUserId === getUserId(record) && rBabyId === getBabyId(record) && rDate === recordDate && rFamilyId === recordFamilyId;
      });
    }

    if (existingIndex > -1) {
      records[existingIndex] = { ...records[existingIndex], ...record, updatedAt: new Date().toISOString() };
    } else {
      records.push(record);
    }

    stores.sensitivityRecords.setLocal(records);
  }

  /**
   * 同步到云端
   * @private
   */
  static async _syncToCloud(record) {
    const todayStr = safeDateFormat(record.date);
    
    // 基础查询条件
    const baseQuery = {};
    if (record.familyId) {
      baseQuery.familyId = record.familyId;
    } else {
      baseQuery.userId = record.userId;
      baseQuery.babyId = record.babyId;
    }
    
    // 获取该用户/家庭的所有记录，再在服务端过滤同一天
    const existing = await db.collection('sensitivity_records').where(baseQuery).get();
    const sameDayRecords = existing.data.filter(r => safeDateFormat(r.date) === todayStr);

    if (sameDayRecords.length > 0) {
      // 删除旧记录
      for (const old of sameDayRecords) {
        await db.collection('sensitivity_records').doc(old._id).remove();
      }
    }

    // 添加新记录
    await db.collection('sensitivity_records').add({ data: record });
  }

  /**
   * 标准化食物名称
   * @param {string} name
   * @returns {string}
   */
  static normalizeFoodName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/\s+/g, '').toLowerCase();
  }
}

module.exports = SensitivityService;

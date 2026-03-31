// services/sensitivityService.js
// 排敏功能服务层，处理排敏相关的业务逻辑

const db = wx.cloud.database();

/**
 * 处理数据库操作错误，特别是集合不存在的情况
 * @param {Error} error - 数据库操作错误对象
 * @param {string} operation - 当前操作描述
 * @param {string} collection - 操作的集合名称
 * @throws {Error} 处理后的错误对象
 */
function handleDatabaseError(error, operation, collection) {
  if (error.errCode === -502005) {
    // 集合不存在的错误处理
    error.message = `排敏功能需要的集合 '${collection}' 不存在，请先在云开发控制台手动创建该集合。创建后请刷新页面重试。`;
    wx.showModal({
      title: '集合不存在',
      content: `排敏功能需要的集合 '${collection}' 不存在，请先在云开发控制台手动创建该集合。\n\n创建步骤：\n1. 打开云开发控制台\n2. 进入数据库页面\n3. 点击「创建集合」\n4. 输入集合名称 '${collection}'\n\n创建后请刷新页面重试。`,
      showCancel: false,
      confirmText: '知道了'
    });
  } else {
    // 其他数据库错误
    wx.showToast({
      title: `${operation}失败`,
      icon: 'none',
      duration: 3000
    });
  }
  console.error(`${operation}失败 (${collection}):`, error);
  throw error;
}

/**
 * 排敏服务类
 */
class SensitivityService {
  /**
   * 获取排敏食物分类数据
   * @returns {Promise<Array>} 排敏食物分类列表
   */
  static async getSensitivityFoods() {
    // 使用静态数据代替数据库查询，确保食物列表显示
    // 按照"宝宝辅食食材排敏与添加指南.xlsx"中的"食材分类"列组织
    const staticFoods = [
      // 高铁基础谷物类
      { "_id": "1", "name": "高铁婴儿米粉", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 1 },
      { "_id": "2", "name": "小米泥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 2 },
      { "_id": "3", "name": "燕麦泥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 3 },
      { "_id": "4", "name": "大米粥泥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 4 },
      { "_id": "5", "name": "藜麦泥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 5 },
      { "_id": "6", "name": "糙米泥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 6 },
      { "_id": "7", "name": "玉米糊", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 7 },
      { "_id": "8", "name": "高粱粥", "category": "高铁基础谷物类", "allergyLevel": 1, "sortOrder": 8 },
      
      // 淀粉类根茎蔬菜
      { "_id": "9", "name": "土豆泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 9 },
      { "_id": "10", "name": "南瓜泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 10 },
      { "_id": "11", "name": "红薯泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 11 },
      { "_id": "12", "name": "山药泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 12 },
      { "_id": "13", "name": "莲藕泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 13 },
      { "_id": "14", "name": "紫薯泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 14 },
      { "_id": "15", "name": "芋头泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 15 },
      { "_id": "16", "name": "胡萝卜泥", "category": "淀粉类根茎蔬菜", "allergyLevel": 1, "sortOrder": 16 },
      
      // 绿叶蔬菜类
      { "_id": "17", "name": "菠菜泥", "category": "绿叶蔬菜类", "allergyLevel": 2, "sortOrder": 17 },
      { "_id": "18", "name": "西兰花泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 18 },
      { "_id": "19", "name": "油麦菜泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 19 },
      { "_id": "20", "name": "生菜泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 20 },
      { "_id": "21", "name": "油菜泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 21 },
      { "_id": "22", "name": "娃娃菜泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 22 },
      { "_id": "23", "name": "芥蓝泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 23 },
      { "_id": "24", "name": "茼蒿泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 24 },
      { "_id": "25", "name": "菠菜苗泥", "category": "绿叶蔬菜类", "allergyLevel": 1, "sortOrder": 25 },
      
      // 瓜茄类蔬菜
      { "_id": "26", "name": "黄瓜泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 26 },
      { "_id": "27", "name": "番茄泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 27 },
      { "_id": "28", "name": "西葫芦泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 28 },
      { "_id": "29", "name": "茄子泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 29 },
      { "_id": "30", "name": "甜椒泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 30 },
      { "_id": "31", "name": "冬瓜泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 31 },
      { "_id": "32", "name": "丝瓜泥", "category": "瓜茄类蔬菜", "allergyLevel": 1, "sortOrder": 32 },
      
      // 低糖低酸水果类
      { "_id": "33", "name": "苹果泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 33 },
      { "_id": "34", "name": "梨泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 34 },
      { "_id": "35", "name": "香蕉泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 35 },
      { "_id": "36", "name": "木瓜泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 36 },
      { "_id": "37", "name": "白心火龙果泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 37 },
      { "_id": "38", "name": "猕猴桃泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 38 },
      { "_id": "39", "name": "草莓泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 39 },
      { "_id": "40", "name": "蓝莓泥", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 40 },
      { "_id": "41", "name": "桃子泥（软桃）", "category": "低糖低酸水果类", "allergyLevel": 1, "sortOrder": 41 },
      
      // 菌菇类
      { "_id": "42", "name": "香菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 42 },
      { "_id": "43", "name": "平菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 43 },
      { "_id": "44", "name": "金针菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 44 },
      { "_id": "45", "name": "杏鲍菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 45 },
      { "_id": "46", "name": "蟹味菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 46 },
      { "_id": "47", "name": "白玉菇泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 47 },
      { "_id": "48", "name": "口蘑泥", "category": "菌菇类", "allergyLevel": 2, "sortOrder": 48 },
      
      // 中敏食材
      { "_id": "49", "name": "蛋黄", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 49 },
      { "_id": "50", "name": "猪肉泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 50 },
      { "_id": "51", "name": "鸡肉泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 51 },
      { "_id": "52", "name": "鸭肉泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 52 },
      { "_id": "53", "name": "鹅肉泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 53 },
      { "_id": "54", "name": "鳕鱼泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 54 },
      { "_id": "55", "name": "龙利鱼泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 55 },
      { "_id": "56", "name": "三文鱼泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 56 },
      { "_id": "57", "name": "金枪鱼泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 57 },
      { "_id": "58", "name": "银鱼泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 58 },
      { "_id": "59", "name": "豆腐泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 59 },
      { "_id": "60", "name": "鹰嘴豆泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 60 },
      { "_id": "61", "name": "红豆泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 61 },
      { "_id": "62", "name": "绿豆泥", "category": "中敏食材", "allergyLevel": 2, "sortOrder": 62 },
      
      // 高敏食材
      { "_id": "63", "name": "蛋白", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 63 },
      { "_id": "64", "name": "牛肉泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 64 },
      { "_id": "65", "name": "羊肉泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 65 },
      { "_id": "66", "name": "虾泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 66 },
      { "_id": "67", "name": "蟹肉泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 67 },
      { "_id": "68", "name": "贝肉泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 68 },
      { "_id": "69", "name": "花生泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 69 },
      { "_id": "70", "name": "芝麻泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 70 },
      { "_id": "71", "name": "核桃泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 71 },
      { "_id": "72", "name": "杏仁泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 72 },
      { "_id": "73", "name": "芒果泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 73 },
      { "_id": "74", "name": "菠萝泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 74 },
      { "_id": "75", "name": "猕猴桃泥", "category": "高敏食材", "allergyLevel": 3, "sortOrder": 75 }
    ];
    return staticFoods;
  }

  /**
   * 获取宝宝信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 宝宝信息
   */
  static async getBabyInfo(userId) {
    try {
      const result = await db.collection('baby_info').where({
        userId: userId
      }).get();
      return result.data[0] || null;
    } catch (error) {
      handleDatabaseError(error, '获取宝宝信息', 'baby_info');
    }
  }

  /**
   * 保存宝宝信息
   * @param {Object} babyInfo - 宝宝信息
   * @returns {Promise<Object>} 保存结果
   */
  static async saveBabyInfo(babyInfo) {
    try {
      // 检查是否已存在宝宝信息
      const existing = await this.getBabyInfo(babyInfo.userId);
      if (existing) {
        // 更新现有信息
        await db.collection('baby_info').doc(existing._id).update({
          data: babyInfo
        });
        return existing._id;
      } else {
        // 创建新信息
        const result = await db.collection('baby_info').add({
          data: babyInfo
        });
        return result._id;
      }
    } catch (error) {
      handleDatabaseError(error, '保存宝宝信息', 'baby_info');
    }
  }

  /**
   * 获取用户排敏记录
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Array>} 排敏记录列表
   */
  static async getUserSensitivityRecords(userId, babyId) {
    try {
      let allRecords = [];
      
      // 1. 尝试从数据库获取记录
      try {
        const result = await db.collection('sensitivity_records').where({
          userId: userId,
          babyId: babyId
        }).orderBy('date', 'desc').get();
        allRecords = [...result.data];
      } catch (dbError) {
        console.warn('从数据库获取排敏记录失败，尝试从本地存储获取:', dbError);
      }
      
      // 2. 从本地存储获取记录
      const localRecords = this.getSensitivityRecordsFromLocal(userId, babyId);
      console.log('从本地存储获取的排敏记录:', localRecords);
      
      // 合并所有记录
      allRecords = [...allRecords, ...localRecords];
      
      console.log('合并后的所有记录数量:', allRecords.length);
      console.log('合并后的所有记录:', allRecords);
      
      // 3. 去重逻辑：基于多个维度进行严格去重
      // 使用Map进行去重，确保同一食物在同一天只有一条记录
      const uniqueRecordsMap = new Map();
      
      allRecords.forEach(record => {
        // 确保记录有基本字段
        const recordUserId = record.userId || userId;
        const recordBabyId = record.babyId || babyId;
        const foodName = record.foodName || '';
        
        // 处理日期，确保是字符串且只保留日期部分
        let recordDate = record.date;
        if (!recordDate) {
          recordDate = record.createTime || new Date().toISOString();
        }
        if (typeof recordDate !== 'string') {
          recordDate = new Date(recordDate).toISOString();
        }
        const dateKey = new Date(recordDate).toISOString().split('T')[0];
        
        // 关键改进：使用更严格的复合键，同时考虑foodId（如果有的话）
        const foodId = record.foodId || foodName; // 使用foodId或foodName作为食物标识
        const compositeKey = `${recordUserId}-${recordBabyId}-${foodId}-${dateKey}`;
        
        // 获取现有记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        
        if (!existingRecord) {
          // 确保记录有唯一ID和正确的date字段
          if (!record._id) {
            record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          record.date = recordDate;
          uniqueRecordsMap.set(compositeKey, record);
          console.log('添加新记录，复合键:', compositeKey);
        } else {
          console.log('发现重复记录，复合键:', compositeKey);
          console.log('现有记录:', existingRecord);
          console.log('新记录:', record);
          // 有重复记录，优先保留：
          // 1. 有_id的记录（通常是数据库记录）
          // 2. 有更新时间且更新时间较新的记录
          // 3. 保留最新创建的记录
          const shouldReplace = (!existingRecord._id && record._id) || 
                               (record.updatedAt && existingRecord.updatedAt && 
                                new Date(record.updatedAt) > new Date(existingRecord.updatedAt)) ||
                               (new Date(record.date) > new Date(existingRecord.date));
          
          if (shouldReplace) {
            // 确保记录有唯一ID和正确的date字段
            if (!record._id) {
              record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            }
            record.date = recordDate;
            uniqueRecordsMap.set(compositeKey, record);
            console.log('更新重复记录，复合键:', compositeKey);
          }
        }
      });
      
      // 转换为数组
      const mergedRecords = Array.from(uniqueRecordsMap.values());
      
      console.log('去重后的记录数量:', mergedRecords.length);
      console.log('去重后的记录:', mergedRecords);
      
      // 4. 按日期排序
      mergedRecords.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA; // 倒序排列，最新的记录在前
      });
      
      return mergedRecords;
    } catch (error) {
      console.error('获取排敏记录失败:', error);
      // 出错时返回空数组
      return [];
    }
  }

  /**
   * 保存排敏记录到本地存储
   * @param {Object} record - 排敏记录
   */
  static saveSensitivityRecordToLocal(record) {
    try {
      // 确保记录有唯一ID
      if (!record._id) {
        record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
      
      // 确保date字段存在且是字符串
      if (!record.date || typeof record.date !== 'string') {
        record.date = new Date().toISOString();
      }
      
      // 确保所有必要字段都存在
      record.userId = record.userId || '';
      record.babyId = record.babyId || '';
      record.foodName = record.foodName || '';
      record.category = record.category || '';
      record.allergyStatus = record.allergyStatus !== undefined ? record.allergyStatus : 0;
      record.likeStatus = record.likeStatus !== undefined ? record.likeStatus : 0;
      
      // 从本地存储获取现有记录
      let existingRecords = wx.getStorageSync('sensitivity_records') || [];
      
      // 第一步：先对现有记录进行严格去重，清理所有重复记录
      const uniqueRecordsMap = new Map();
      existingRecords.forEach(existing => {
        // 确保现有记录有必要字段
        const existingUserId = existing.userId || '';
        const existingBabyId = existing.babyId || '';
        
        // 处理现有记录的日期
        let existingDate = existing.date;
        if (!existingDate || typeof existingDate !== 'string') {
          existingDate = existing.createTime || new Date().toISOString();
          if (typeof existingDate !== 'string') {
            existingDate = new Date(existingDate).toISOString();
          }
        }
        const existingDateKey = new Date(existingDate).toISOString().split('T')[0];
        
        // 创建复合键，使用userID + babyId + 日期（每天只能有一条记录）
        const compositeKey = `${existingUserId}-${existingBabyId}-${existingDateKey}`;
        
        // 只保留最新的记录
        if (!uniqueRecordsMap.has(compositeKey)) {
          uniqueRecordsMap.set(compositeKey, existing);
        }
      });
      
      // 转换为数组
      existingRecords = Array.from(uniqueRecordsMap.values());
      
      // 第二步：检查新记录是否已存在（基于用户ID + 宝宝ID + 日期）
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      const recordKey = `${record.userId}-${record.babyId}-${recordDate}`;
      
      // 检查是否已存在当天记录
      const existingIndex = existingRecords.findIndex(existing => {
        const existingDate = new Date(existing.date).toISOString().split('T')[0];
        const existingKey = `${existing.userId}-${existing.babyId}-${existingDate}`;
        return existingKey === recordKey;
      });
      
      if (existingIndex > -1) {
        // 更新现有记录
        existingRecords[existingIndex] = {
          ...existingRecords[existingIndex],
          ...record,
          updatedAt: new Date().toISOString()
        };
        console.log('已更新本地存储中的排敏记录:', existingRecords[existingIndex]);
      } else {
        // 添加新记录
        existingRecords.push(record);
        console.log('排敏记录已保存到本地存储:', record);
      }
      
      // 保存回本地存储
      wx.setStorageSync('sensitivity_records', existingRecords);
      console.log('本地存储中现有记录数量:', existingRecords.length);
    } catch (error) {
      console.error('保存排敏记录到本地存储失败:', error);
    }
  }

  /**
   * 从本地存储获取排敏记录
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Array} 排敏记录列表
   */
  static getSensitivityRecordsFromLocal(userId, babyId) {
    try {
      const allRecords = wx.getStorageSync('sensitivity_records') || [];
      
      // 过滤符合条件的记录
      const filteredRecords = allRecords.filter(record => {
        if (record.userId !== userId) return false;
        // 允许本地默认ID和真实babyId，确保旧记录也能被找到
        if (babyId && record.babyId !== babyId && record.babyId !== 'local-baby-id') return false;
        return true;
      });
      
      // 对本地存储的记录也进行去重，清理已存在的重复记录
      const uniqueLocalRecordsMap = new Map();
      
      filteredRecords.forEach(record => {
        // 确保记录有基本字段
        const foodName = record.foodName || '';
        
        // 处理日期，确保是字符串且只保留日期部分
        let recordDate = record.date;
        if (!recordDate) {
          recordDate = record.createTime || new Date().toISOString();
        }
        if (typeof recordDate !== 'string') {
          recordDate = new Date(recordDate).toISOString();
        }
        const dateKey = new Date(recordDate).toISOString().split('T')[0];
        
        // 创建复合键
        const compositeKey = `${record.userId}-${record.babyId}-${foodName}-${dateKey}`;
        
        // 只保留最新的记录
        const existingRecord = uniqueLocalRecordsMap.get(compositeKey);
        if (!existingRecord) {
          // 确保记录有唯一ID和正确的date字段
          if (!record._id) {
            record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          record.date = recordDate;
          uniqueLocalRecordsMap.set(compositeKey, record);
        } else {
          // 更新现有记录，确保date字段正确
          existingRecord.date = recordDate;
        }
      });
      
      // 将去重后的记录保存回本地存储，清理重复数据
      const uniqueLocalRecords = Array.from(uniqueLocalRecordsMap.values());
      wx.setStorageSync('sensitivity_records', uniqueLocalRecords);
      
      return uniqueLocalRecords;
    } catch (error) {
      console.error('从本地存储获取排敏记录失败:', error);
      return [];
    }
  }

  /**
   * 保存排敏记录
   * @param {Object} record - 排敏记录
   * @returns {Promise<Object>} 保存结果
   */
  static async saveSensitivityRecord(record) {
    try {
      // 添加调试信息
      console.log('保存排敏记录前:', record);
      
      // 对于新的排敏记录，始终从状态1开始，不管之前的记录
      record.status = 1;
      record.sensitivityDays = 1;
      
      // 添加调试信息
      console.log('保存排敏记录后:', record);
      
      // 先保存到本地存储，确保数据不会丢失（本地存储已经实现了一天一条记录的逻辑）
      this.saveSensitivityRecordToLocal(record);
      
      try {
        // 检查是否已存在相同日期的记录
        const todayStr = new Date(record.date).toISOString().split('T')[0];
        const existingRecords = await db.collection('sensitivity_records').where({
          userId: record.userId,
          babyId: record.babyId,
          date: db.command.gte(todayStr + 'T00:00:00.000Z'),
          date: db.command.lte(todayStr + 'T23:59:59.999Z')
        }).get();
        
        if (existingRecords.data.length > 0) {
          // 如果有多个记录，先删除所有当天记录
          for (const existing of existingRecords.data) {
            await db.collection('sensitivity_records').doc(existing._id).remove();
          }
          // 然后添加新记录
          const result = await db.collection('sensitivity_records').add({
            data: record
          });
          return result;
        } else {
          // 创建新记录
          const result = await db.collection('sensitivity_records').add({
            data: record
          });
          return result;
        }
      } catch (error) {
        console.warn('保存排敏记录到数据库失败，已保存到本地存储:', error);
        // 不抛出错误，允许继续执行
        return { success: true, data: { _id: 'local-' + Date.now() } };
      }
    } catch (error) {
      console.error('保存排敏记录过程中发生错误:', error);
      // 确保记录状态正确
      record.status = 1;
      record.sensitivityDays = 1;
      // 保存到本地存储
      this.saveSensitivityRecordToLocal(record);
      return { success: true, data: { _id: 'local-' + Date.now() } };
    }
  }

  /**
   * 更新排敏记录
   * @param {Object} record - 排敏记录
   * @returns {Promise<Object>} 更新结果
   */
  static async updateSensitivityRecord(record) {
    try {
      // 获取今日日期
      const today = new Date().toISOString().split('T')[0];
      
      // 获取所有本地排敏记录
      const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
      
      // 查找今日的排敏记录
      const todayRecordIndex = allLocalRecords.findIndex(r => {
        const recordDate = new Date(r.date).toISOString().split('T')[0];
        return r.userId === record.userId && 
               r.babyId === record.babyId && 
               recordDate === today;
      });
      
      if (todayRecordIndex > -1) {
        // 更新本地存储中的记录
        allLocalRecords[todayRecordIndex] = {
          ...allLocalRecords[todayRecordIndex],
          foodId: record.foodId,
          foodName: record.foodName,
          category: record.category,
          likeStatus: record.likeStatus,
          allergyStatus: record.allergyStatus,
          updatedAt: new Date()
        };
        
        // 保存更新后的记录到本地存储
        wx.setStorageSync('sensitivity_records', allLocalRecords);
        console.log('已更新本地排敏记录:', allLocalRecords[todayRecordIndex]);
      } else {
        // 如果找不到今日记录，创建新记录
        await this.saveSensitivityRecord(record);
      }
      
      // 尝试更新数据库中的记录
      try {
        // 构建查询条件
        const query = {
          userId: record.userId,
          babyId: record.babyId,
          date: db.command.gte(today + 'T00:00:00.000Z'),
          date: db.command.lte(today + 'T23:59:59.999Z')
        };
        
        // 更新数据库中的记录
        await db.collection('sensitivity_records').where(query).update({
          data: {
            foodId: record.foodId,
            foodName: record.foodName,
            category: record.category,
            likeStatus: record.likeStatus,
            allergyStatus: record.allergyStatus,
            updatedAt: new Date()
          }
        });
      } catch (dbError) {
        console.warn('更新数据库中排敏记录失败:', dbError);
      }
      
      return { success: true };
    } catch (error) {
      console.error('更新排敏记录失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户排敏记录
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Array>} 排敏记录列表
   */
  static async getUserRecords(userId, babyId) {
    try {
      // 构建查询条件，考虑本地宝宝ID的情况
      const query = {
        userId: userId
      };
      
      // 如果babyId不是本地默认值，则添加到查询条件
      if (babyId && babyId !== 'local-baby-id') {
        query.babyId = babyId;
      }
      
      // 获取用户已排敏记录
      const userRecords = await db.collection('sensitivity_records').where(query).get();
      
      // 添加调试信息，查看数据库中的排敏记录
      console.log('数据库中的排敏记录:', userRecords.data);
      
      return userRecords.data;
    } catch (error) {
      console.warn('从数据库获取排敏记录失败:', error);
      return [];
    }
  }

  /**
   * 获取排敏进度
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Object>} 排敏进度信息
   */
  static async getSensitivityProgress(userId, babyId) {
    try {
      // 获取所有排敏食物
      const allFoods = await this.getSensitivityFoods();
      const totalCount = allFoods.length;
      
      console.log('所有排敏食物数量:', totalCount);
      
      // 存储已处理的食物名称，使用Set避免重复计数
      const processedFoodNames = new Set();
      
      // 1. 从宝宝信息中获取已排敏食物
      const app = getApp();
      const babyInfo = app.globalData.userInfo?.babyInfo;
      console.log('当前宝宝信息:', babyInfo);
      
      if (babyInfo) {
        // 处理已排敏食物列表
        if (babyInfo.safeFoodsList && Array.isArray(babyInfo.safeFoodsList)) {
          babyInfo.safeFoodsList.forEach(food => {
            if (typeof food === 'string') {
              processedFoodNames.add(food);
              console.log('从宝宝信息中添加已排敏食物:', food);
            } else if (food.foodName) {
              processedFoodNames.add(food.foodName);
              console.log('从宝宝信息中添加已排敏食物:', food.foodName);
            } else if (food.name) {
              processedFoodNames.add(food.name);
              console.log('从宝宝信息中添加已排敏食物:', food.name);
            }
          });
        } else if (babyInfo.safeFoods) {
          // 处理字符串格式的已排敏食物
          const safeFoods = babyInfo.safeFoods.split(',').filter(food => food.trim());
          safeFoods.forEach(food => {
            processedFoodNames.add(food.trim());
            console.log('从宝宝信息中添加已排敏食物:', food.trim());
          });
        }
      }
      
      // 2. 从本地存储获取所有排敏记录
      const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
      const userLocalRecords = allLocalRecords.filter(record => {
        return record.userId === userId && 
               (record.babyId === babyId || record.babyId === 'local-baby-id');
      });
      
      console.log('本地存储中的排敏记录数量:', userLocalRecords.length);
      
      // 3. 尝试从数据库获取排敏记录
      let dbRecords = [];
      try {
        // 构建查询条件，考虑本地宝宝ID的情况
        const query = {
          userId: userId
        };
        
        // 如果babyId不是本地默认值，则添加到查询条件
        if (babyId && babyId !== 'local-baby-id') {
          query.babyId = babyId;
        }
        
        // 获取所有排敏记录
        const processedFoods = await db.collection('sensitivity_records').where(query).get();
        dbRecords = processedFoods.data;
        console.log('数据库中的排敏记录数量:', dbRecords.length);
      } catch (dbError) {
        console.warn('从数据库获取排敏记录失败，仅使用本地数据:', dbError);
      }
      
      // 合并所有排敏记录
      const allRecords = [...userLocalRecords, ...dbRecords];
      
      // 处理排敏记录，区分完成和进行中的食物
      const completedFoodNames = new Set();
      const ongoingFoodsMap = new Map();
      
      // 分组处理排敏记录
      const foodRecordsMap = new Map();
      allRecords.forEach(record => {
        if (record.foodName) {
          if (!foodRecordsMap.has(record.foodName)) {
            foodRecordsMap.set(record.foodName, []);
          }
          foodRecordsMap.get(record.foodName).push(record);
        }
      });
      
      // 处理每个食物的排敏记录
      const today = new Date();
      foodRecordsMap.forEach((records, foodName) => {
        // 找到最新的记录
        const latestRecord = records.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })[0];
        
        // 计算排敏天数
        const recordDate = new Date(latestRecord.date);
        const sensitivityDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // 获取对应的食物信息
        const food = allFoods.find(f => f.name === foodName);
        if (food) {
          // 计算总排敏天数
          const totalSensitivityDays = food.allergyLevel === 3 ? 5 : 3;
          
          // 检查是否已完成排敏
          const isCompleted = sensitivityDays >= totalSensitivityDays;
          
          if (isCompleted) {
            // 已完成排敏的食物
            completedFoodNames.add(foodName);
            console.log('食物已完成排敏:', foodName, '天数:', sensitivityDays, '总需:', totalSensitivityDays);
          } else {
            // 正在排敏的食物，记录进度
            ongoingFoodsMap.set(foodName, {
              sensitivityDays: sensitivityDays,
              totalSensitivityDays: totalSensitivityDays
            });
            console.log('食物正在排敏:', foodName, '已排:', sensitivityDays, '总需:', totalSensitivityDays);
          }
        }
      });
      
      // 合并所有已排敏食物
      const allCompletedFoods = new Set([...processedFoodNames, ...completedFoodNames]);
      
      console.log('已完成排敏的食物名称:', Array.from(allCompletedFoods));
      
      // 4. 计算已排敏的食物数量
      let processedCount = 0;
      allFoods.forEach(food => {
        // 检查食物是否已排敏
        if (allCompletedFoods.has(food.name)) {
          processedCount++;
          console.log('食物', food.name, '已排敏');
        }
      });
      
      // 5. 计算排敏进度
      const progress = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
      
      console.log('排敏进度计算:', processedCount, '/', totalCount, '=', progress, '%');

      return {
        totalCount,
        completedCount: processedCount,
        progress
      };
    } catch (error) {
      console.error('获取排敏进度失败:', error);
      // 出错时返回默认值
      return {
        totalCount: 0,
        completedCount: 0,
        progress: 0
      };
    }
  }

  /**
   * 获取推荐排敏食物
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @returns {Promise<Array>} 推荐食物列表
   */
  /**
   * 标准化食物名称，去除空格并转换为小写
   * @param {string} name - 食物名称
   * @returns {string} 标准化后的食物名称
   */
  static normalizeFoodName(name) {
    // 防御性检查，确保name是字符串
    if (typeof name !== 'string') {
      return '';
    }
    return name.replace(/\s+/g, '').toLowerCase();
  }

  static async getRecommendedFoods(userId, babyId) {
    try {
      // 1. 获取所有排敏食物（宝宝排敏表）
      const allFoods = await this.getSensitivityFoods();
      
      // 按排敏顺序排序食物
      const sortedFoods = allFoods.sort((a, b) => a.sortOrder - b.sortOrder);
      
      // 2. 从数据库和本地存储获取所有排敏记录
      let allRecords = [];
      
      // 2.1 尝试从数据库获取记录
      try {
        const result = await db.collection('sensitivity_records').where({
          userId: userId,
          babyId: babyId
        }).get();
        allRecords = [...result.data];
      } catch (dbError) {
        console.warn('从数据库获取排敏记录失败，尝试从本地存储获取:', dbError);
      }
      
      // 2.2 直接从本地存储获取所有排敏记录
      const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
      console.log('本地存储的所有排敏记录:', allLocalRecords);
      
      // 筛选当前用户和宝宝的本地排敏记录
      const userLocalRecords = allLocalRecords.filter(record => {
        return record.userId === userId && 
               (record.babyId === babyId || record.babyId === 'local-baby-id');
      });
      
      // 合并所有记录
      allRecords = [...allRecords, ...userLocalRecords];
      console.log('所有排敏记录:', allRecords);
      
      // 3. 构建最终推荐列表
      const recommendedFoods = [];
      const today = new Date();
      
      console.log('开始构建推荐列表...');
      
      // 4. 获取已排敏的食物列表（从多个来源）
      const excludedFoodNames = new Set();
      
      // 4.1 从本地存储的babyInfo中获取已排敏食物
      const localBabyInfo = wx.getStorageSync('babyInfo');
      console.log('从本地存储获取的babyInfo:', localBabyInfo);
      
      if (localBabyInfo) {
        // 处理已排敏食物列表
        if (localBabyInfo.safeFoodsList && Array.isArray(localBabyInfo.safeFoodsList)) {
          localBabyInfo.safeFoodsList.forEach(food => {
            if (typeof food === 'string') {
              excludedFoodNames.add(food);
              console.log('从本地babyInfo中添加已排敏食物:', food);
            } else if (food.foodName) {
              excludedFoodNames.add(food.foodName);
              console.log('从本地babyInfo中添加已排敏食物:', food.foodName);
            } else if (food.name) {
              excludedFoodNames.add(food.name);
              console.log('从本地babyInfo中添加已排敏食物:', food.name);
            }
          });
        } else if (localBabyInfo.safeFoods) {
          // 处理字符串格式的已排敏食物
          const safeFoods = localBabyInfo.safeFoods.split(',').filter(food => food.trim());
          safeFoods.forEach(food => {
            excludedFoodNames.add(food.trim());
            console.log('从本地babyInfo中添加已排敏食物:', food.trim());
          });
        }
      }
      
      // 4.2 从全局用户信息中获取已排敏食物
      const app = getApp();
      const globalBabyInfo = app.globalData.userInfo?.babyInfo;
      console.log('从全局用户信息获取的babyInfo:', globalBabyInfo);
      
      if (globalBabyInfo) {
        // 处理已排敏食物列表
        if (globalBabyInfo.safeFoodsList && Array.isArray(globalBabyInfo.safeFoodsList)) {
          globalBabyInfo.safeFoodsList.forEach(food => {
            if (typeof food === 'string') {
              excludedFoodNames.add(food);
              console.log('从全局babyInfo中添加已排敏食物:', food);
            } else if (food.foodName) {
              excludedFoodNames.add(food.foodName);
              console.log('从全局babyInfo中添加已排敏食物:', food.foodName);
            } else if (food.name) {
              excludedFoodNames.add(food.name);
              console.log('从全局babyInfo中添加已排敏食物:', food.name);
            }
          });
        } else if (globalBabyInfo.safeFoods) {
          // 处理字符串格式的已排敏食物
          const safeFoods = globalBabyInfo.safeFoods.split(',').filter(food => food.trim());
          safeFoods.forEach(food => {
            excludedFoodNames.add(food.trim());
            console.log('从全局babyInfo中添加已排敏食物:', food.trim());
          });
        }
      }
      
      // 4.3 从排敏记录中获取已排敏的食物，区分完成和进行中
      const completedFoodNames = new Set();
      const ongoingFoodsMap = new Map();
      
      // 分组处理排敏记录
      const foodRecordsMap = new Map();
      allRecords.forEach(record => {
        if (record.foodName) {
          if (!foodRecordsMap.has(record.foodName)) {
            foodRecordsMap.set(record.foodName, []);
          }
          foodRecordsMap.get(record.foodName).push(record);
        }
      });
      
      // 处理每个食物的排敏记录
      foodRecordsMap.forEach((records, foodName) => {
        // 找到最新的记录
        const latestRecord = records.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })[0];
        
        // 计算排敏天数
        const recordDate = new Date(latestRecord.date);
        const sensitivityDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // 获取对应的食物信息
        const food = allFoods.find(f => f.name === foodName);
        if (food) {
          // 计算总排敏天数
          const totalSensitivityDays = food.allergyLevel === 3 ? 5 : 3;
          
          // 检查是否已完成排敏
          const isCompleted = sensitivityDays >= totalSensitivityDays;
          
          if (isCompleted) {
            // 已完成排敏的食物
            completedFoodNames.add(foodName);
            console.log('食物已完成排敏:', foodName, '天数:', sensitivityDays, '总需:', totalSensitivityDays);
          } else {
            // 正在排敏的食物，记录进度
            ongoingFoodsMap.set(foodName, {
              sensitivityDays: sensitivityDays,
              totalSensitivityDays: totalSensitivityDays
            });
            console.log('食物正在排敏:', foodName, '已排:', sensitivityDays, '总需:', totalSensitivityDays);
          }
        }
      });
      
      // 合并所有已排敏食物
      const finalExcludedFoods = new Set([...excludedFoodNames, ...completedFoodNames]);
      console.log('所有已完成排敏食物:', Array.from(finalExcludedFoods));
      console.log('正在排敏的食物:', Array.from(ongoingFoodsMap.entries()));
      
      // 5. 遍历所有宝宝排敏表中的食物，生成推荐列表
      for (const food of sortedFoods) {
        console.log('处理食物:', food.name);
        
        // 首先检查是否已完成排敏，如果已完成，跳过
        if (finalExcludedFoods.has(food.name)) {
          console.log('食物已完成排敏，跳过:', food.name);
          continue;
        }
        
        // 检查食物是否正在排敏
        if (ongoingFoodsMap.has(food.name)) {
          // 正在排敏的食物，添加到推荐列表
          const progressInfo = ongoingFoodsMap.get(food.name);
          recommendedFoods.push({
            ...food,
            ongoing: true,
            sensitivityDays: progressInfo.sensitivityDays,
            totalSensitivityDays: progressInfo.totalSensitivityDays
          });
          
          console.log('添加排敏中的食物:', food.name, 'ongoing:', true, '进度:', progressInfo.sensitivityDays, '/', progressInfo.totalSensitivityDays);
        } else {
          // 未排敏的食物，添加到推荐列表
          recommendedFoods.push({...food});
          console.log('添加未排敏的食物:', food.name, 'ongoing:', false);
        }
        
        // 最多推荐3种食物
        if (recommendedFoods.length >= 3) {
          break;
        }
      }
      
      console.log('最终推荐列表:', recommendedFoods.map(food => ({name: food.name, ongoing: food.ongoing, sensitivityDays: food.sensitivityDays})));
      
      return recommendedFoods;
    } catch (error) {
      console.error('获取推荐排敏食物失败:', error);
      // 出错时返回空数组
      return [];
    }
  }

  /**
   * 更新排敏状态
   * @param {string} userId - 用户ID
   * @param {string} babyId - 宝宝ID
   * @param {string} foodId - 食物ID
   * @param {number} status - 新状态
   * @returns {Promise<Object>} 更新结果
   */
  static async updateSensitivityStatus(userId, babyId, foodId, status) {
    try {
      const result = await db.collection('sensitivity_records').where({
        userId: userId,
        babyId: babyId,
        foodId: foodId
      }).update({
        data: {
          status: status,
          updatedAt: new Date()
        }
      });
      return result;
    } catch (error) {
      handleDatabaseError(error, '更新排敏状态', 'sensitivity_records');
    }
  }
}

module.exports = SensitivityService;

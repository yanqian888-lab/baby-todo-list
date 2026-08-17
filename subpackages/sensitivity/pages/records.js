// pages/sensitivity/records.js
const app = getApp();
const sensitivityService = require('../../../services/sensitivityService');
const familyService = require('../../../services/familyService');
const { getUserId, getBabyId, safeDateFormat, getAllergyStatusText, getLikeStatusText } = require('../../../utils/helpers');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    records: [],
    activeFilter: 'all',
    loading: true,
    families: [],
    currentFamilyId: null,
    currentFamilyName: '我的家庭'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查用户登录状态
    if (!this.checkLogin()) return;
    this.loadFamilyInfo().then(() => {
      this.cleanupLocalRecords();
      this.getSensitivityRecords();
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    if (!this.checkLogin()) return;
    // 每次显示页面时先加载家庭信息，再刷新
    this.loadFamilyInfo().then(() => {
      this.cleanupLocalRecords();
      this.getSensitivityRecords();
    });
  },

  /**
   * 检查用户登录状态
   */
  checkLogin: function() {
    const token = wx.getStorageSync('token');
    if (!token) {
      // 用户未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  /**
   * 加载家庭信息并设置当前家庭
   */
  loadFamilyInfo: async function() {
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const currentOpenId = currentUserInfo.openId || currentUserInfo._id || currentUserInfo.openid || currentUserInfo.openID || '';

    try {
      const result = await familyService.getMyFamilies();
      const familiesRaw = result.families || [];
      const createdFamilies = [];
      const joinedFamilies = [];
      const families = [];

      familiesRaw.forEach(family => {
        const rawBabyNickname = family.babyInfo?.nickname || family.babyNickname || '宝宝';
        const sanitizedBabyNickname = /^(微信用户|家庭成员)/.test(rawBabyNickname) ? '宝宝' : rawBabyNickname;
        const sanitizedFamilyName = family.familyName && !/^(微信用户|家庭成员)/.test(family.familyName) ? family.familyName : '';
        const familyData = {
          ...family,
          babyNickname: sanitizedBabyNickname,
          creatorOpenId: family.creatorOpenId || family.creator || family.ownerOpenId || '',
          name: sanitizedFamilyName || `${sanitizedBabyNickname}的家`,
          displayName: sanitizedFamilyName || `${sanitizedBabyNickname}的家`
        };

        families.push(familyData);
        if (familyData.creatorOpenId && familyData.creatorOpenId === currentOpenId) {
          createdFamilies.push(familyData);
        } else {
          joinedFamilies.push(familyData);
        }
      });

      // 自己创建的家庭排在前面
      families.sort((a, b) => {
        const aOwner = a.creatorOpenId === currentOpenId ? 1 : 0;
        const bOwner = b.creatorOpenId === currentOpenId ? 1 : 0;
        return bOwner - aOwner;
      });

      let currentFamilyId = this.data.currentFamilyId;
      let currentFamily = families.find(f => f._id === currentFamilyId);
      
      if (!currentFamily) {
        currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
        currentFamily = families.find(f => f._id === currentFamilyId);
      }
      
      if (!currentFamily) {
        if (createdFamilies.length > 0) {
          currentFamily = createdFamilies[0];
        } else if (joinedFamilies.length > 0) {
          currentFamily = joinedFamilies[0];
        }
      }

      if (currentFamily) {
        currentFamilyId = currentFamily._id;
        wx.setStorageSync('currentFamilyId', currentFamilyId);
        const currentFamilyName = currentFamily.displayName || currentFamily.name || `${currentFamily.babyNickname || '宝宝'}的家`;
        this.setData({
          families,
          currentFamilyId,
          currentFamilyName
        });
      } else {
        this.setData({
          families,
          currentFamilyId: null,
          currentFamilyName: '我的家庭'
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 切换家庭 tab
   */
  switchFamilyTab: async function(e) {
    const familyId = e.currentTarget.dataset.tabId;
    if (!familyId || familyId === this.data.currentFamilyId) {
      return;
    }

    const family = this.data.families.find(f => f._id === familyId);
    if (!family) return;

    try {
      wx.showLoading({ title: '切换中...' });
      await familyService.switchFamily(familyId);
      this.setData({
        currentFamilyId: familyId,
        currentFamilyName: family.displayName || family.name || `${family.babyNickname || '宝宝'}的家`
      });
      this.cleanupLocalRecords();
      this.getSensitivityRecords();
    } catch (error) {
      console.error('切换家庭失败:', error);
      wx.showToast({ title: '切换家庭失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 清理本地存储中的重复记录
   */
  cleanupLocalRecords: function() {
    try {
      const userId = app.globalData.userInfo._id;
      const babyId = app.globalData.userInfo.babyInfo ? app.globalData.userInfo.babyInfo._id : 'local-baby-id';
      const familyId = this.data.currentFamilyId;
      
      // 从本地存储获取所有记录
      let allRecords = wx.getStorageSync('sensitivity_records') || [];
      console.log('清理前的本地存储记录数量:', allRecords.length);
      
      // 对所有记录进行严格去重（按家庭隔离）
      const uniqueRecordsMap = new Map();
      allRecords.forEach(record => {
        // 只处理属于当前家庭或没有 familyId 的旧记录
        const recordFamilyId = record.familyId || null;
        if (familyId && recordFamilyId && recordFamilyId !== familyId) {
          return; // 跳过其他家庭的记录
        }
        
        // 确保记录有必要字段
        const recordUserId = record.userId || userId;
        const recordBabyId = record.babyId || babyId;
        const foodName = record.foodName || '';
        
        // 处理日期
        let recordDate = record.date;
        if (!recordDate) {
          recordDate = record.createTime || new Date().toISOString();
        }
        if (typeof recordDate !== 'string') {
          recordDate = new Date(recordDate).toISOString();
        }
        const dateKey = safeDateFormat(recordDate);
        
        // 创建复合键（加入家庭ID，避免跨家庭去重）
        const foodId = record.foodId || foodName;
        const compositeKey = `${recordUserId}-${recordBabyId}-${foodId}-${dateKey}-${recordFamilyId || ''}`;
        
        // 只保留最新的记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        if (!existingRecord) {
          // 确保记录有唯一ID和正确的date字段
          if (!record._id) {
            record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          record.date = recordDate;
          uniqueRecordsMap.set(compositeKey, record);
        } else {
          // 如果有重复，保留 updatedAt 更新的记录
          const existingUpdatedAt = existingRecord.updatedAt ? new Date(existingRecord.updatedAt).getTime() : 0;
          const currentUpdatedAt = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
          if (currentUpdatedAt > existingUpdatedAt) {
            uniqueRecordsMap.set(compositeKey, record);
          }
        }
      });
      
      // 转换为数组：保留当前家庭去重后的记录 + 其他家庭的原始记录
      const otherFamilyRecords = allRecords.filter(r => {
        const rFamilyId = r.familyId || null;
        return familyId && rFamilyId && rFamilyId !== familyId;
      });
      const uniqueRecords = Array.from(uniqueRecordsMap.values()).concat(otherFamilyRecords);
      
      // 保存回本地存储
      wx.setStorageSync('sensitivity_records', uniqueRecords);
      console.log('清理后的本地存储记录数量:', uniqueRecords.length);
    } catch (error) {
      console.error('清理本地存储记录失败:', error);
    }
  },

  /**
   * 获取排敏记录
   */
  getSensitivityRecords: function() {
    if (!this.checkLogin()) return;
    
    this.setData({ loading: true });
    
    // 先清理本地存储中的重复记录
    this.cleanupLocalRecords();
    
    // 获取用户ID（使用辅助函数）
    const userInfo = app.globalData?.userInfo;
    if (!userInfo) {
      console.warn('用户未登录');
      this.setData({ records: [], loading: false });
      return;
    }
    
    const userId = getUserId(userInfo);
    const babyId = getBabyId(userInfo.babyInfo);
    
    // 获取筛选条件
    const filter = this.data.activeFilter;
    
    const familyId = this.data.currentFamilyId;
    
    // 同时获取排敏记录、宝宝信息中的已排敏食物、以及所有食物列表（用于补全分类）
    Promise.all([
      sensitivityService.getUserSensitivityRecords(userId, babyId, familyId),
      sensitivityService.getFamilyBabyInfo(familyId),
      sensitivityService.getSensitivityFoods()
    ]).then(([records, babyInfo, allFoods]) => {
      // 提取宝宝信息中已标记为已排敏的食物名称集合
      const babySafeFoodNames = new Set();
      const safeFoodsList = babyInfo?.safeFoodsList || [];
      safeFoodsList.forEach(food => {
        const foodName = typeof food === 'string' ? food : (food.foodName || food.name);
        if (foodName) babySafeFoodNames.add(foodName);
      });
      console.log('👶 宝宝信息中的已排敏食物:', Array.from(babySafeFoodNames));
      
      // 处理记录，确保所有必需的字段都存在且格式正确
      const processedRecords = records.map(record => {
        console.log('处理前的记录:', record);
        
        // 确保date字段是字符串且不为空
        let recordDate = '';
        let displayDate = '';
        
        // 尝试多种方式获取日期
        if (record.date) {
          if (typeof record.date === 'string') {
            recordDate = record.date;
          } else if (record.date instanceof Date) {
            recordDate = record.date.toISOString();
          } else {
            recordDate = String(record.date);
          }
        } else if (record.createTime) {
          // 如果没有date字段，使用createTime
          if (typeof record.createTime === 'string') {
            recordDate = record.createTime;
          } else if (record.createTime instanceof Date) {
            recordDate = record.createTime.toISOString();
          } else {
            recordDate = String(record.createTime);
          }
        } else {
          // 如果都没有，使用当前日期
          recordDate = new Date().toISOString();
        }
        
        // 解析日期并格式化显示
        try {
          const parsedDate = new Date(recordDate);
          if (!isNaN(parsedDate.getTime())) {
            // 格式化日期为 YYYY-MM-DD 格式用于显示
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            displayDate = `${year}-${month}-${day}`;
            recordDate = parsedDate.toISOString();
          } else {
            // 如果日期无效，使用当前日期
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            displayDate = `${year}-${month}-${day}`;
            recordDate = now.toISOString();
          }
        } catch (e) {
          // 如果转换失败，使用当前日期
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          displayDate = `${year}-${month}-${day}`;
          recordDate = now.toISOString();
        }
        
        console.log('处理后的日期:', { recordDate, displayDate });
        
        // 确定食物分类
        let foodCategory = record.category || '';
        if (!foodCategory) {
          // 如果没有分类，根据食物名称判断
          if (record.foodName && record.foodName.includes('自定义')) {
            foodCategory = '自定义食物';
          } else {
            foodCategory = '未知';
          }
        }
        
        // 获取过敏状态和喜好程度
        const allergyStatus = record.allergyStatus !== undefined ? record.allergyStatus : 0;
        const likeStatus = record.likeStatus !== undefined ? record.likeStatus : 0;
        
        // 计算排敏进度 - 统计该食物的唯一记录日期数（仅在当前家庭记录中计算）
        const foodName = record.foodName || '';
        const uniqueDates = new Set();
        records.forEach(r => {
          if (r.foodName === foodName) {
            let rDate = r.date || r.createTime;
            if (rDate) {
              const d = new Date(rDate);
              if (!isNaN(d.getTime())) {
                uniqueDates.add(safeDateFormat(d));
              }
            }
          }
        });
        const sensitivityDays = uniqueDates.size;
        
        const allergyLevel = record.allergyLevel || 1;
        const totalDays = allergyLevel === 3 ? 5 : 3;
        let progressText = '';
        
        // 如果宝宝信息页已标记该食物为已排敏，直接显示已完成
        if (babySafeFoodNames.has(foodName)) {
          progressText = '排敏完成';
        } else if (sensitivityDays >= totalDays) {
          progressText = '排敏完成';
        } else {
          progressText = `${sensitivityDays}/${totalDays}`;
        }
        
        // 添加状态文本，避免在WXML中直接调用函数
        const getStatusText = (status) => {
          switch (status) {
            case -1:
              return '未记录';
            case 0:
              return '不过敏';
            case 1:
              return '轻微过敏';
            case 2:
              return '重度过敏';
            default:
              return '未记录';
          }
        };
        
        const getLikeText = (status) => {
          switch (status) {
            case -1:
              return '未记录';
            case 0:
              return '不喜欢';
            case 1:
              return '一般';
            case 2:
              return '喜欢';
            default:
              return '未记录';
          }
        };
        
        // 计算状态标签和样式
        let statusTag = '未记录';
        let statusClass = 'status-unrecorded';
        if (allergyStatus === 0) {
          statusTag = '安全';
          statusClass = 'status-safe';
        } else if (allergyStatus === 1 || allergyStatus === 2) {
          statusTag = '过敏';
          statusClass = 'status-allergy';
        }
        
        const processedRecord = {
          _id: record._id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          foodName: record.foodName || '',
          category: foodCategory,
          date: recordDate,
          displayDate: displayDate,
          allergyStatus: allergyStatus,
          likeStatus: likeStatus,
          statusText: getStatusText(allergyStatus),
          likeText: getLikeText(likeStatus),
          progressText: progressText,
          sensitivityDays: sensitivityDays,
          totalDays: totalDays,
          statusTag: statusTag,
          statusClass: statusClass
        };
        
        console.log('处理后的记录:', processedRecord);
        return processedRecord;
      });
      
      // 再次去重，确保最终返回的记录中没有重复（按家庭隔离）
      const uniqueRecordsMap = new Map();
      processedRecords.forEach(record => {
        // 确保userId和babyId存在
        const userId = record.userId || app.globalData.userInfo._id;
        const babyId = record.babyId || app.globalData.userInfo.babyInfo?._id || 'local-baby-id';
        const foodName = record.foodName || '';
        const dateKey = record.date.substring(0, 10); // 只取日期部分
        const recordFamilyId = record.familyId || '';
        // 使用更严格的复合键（包含家庭ID），确保去重效果
        const compositeKey = `${userId}-${babyId}-${foodName}-${dateKey}-${recordFamilyId}`;
        
        // 只保留最新的记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        if (!existingRecord) {
          uniqueRecordsMap.set(compositeKey, record);
        } else {
          // 如果有重复，保留 updatedAt 更新的记录
          const existingUpdatedAt = existingRecord.updatedAt ? new Date(existingRecord.updatedAt).getTime() : 0;
          const currentUpdatedAt = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
          if (currentUpdatedAt > existingUpdatedAt) {
            uniqueRecordsMap.set(compositeKey, record);
          }
        }
      });
      
      // 转换为数组并排序
      const finalRecords = Array.from(uniqueRecordsMap.values());
      finalRecords.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA; // 倒序排列，最新的记录在前
      });
      
      console.log('最终去重后的记录数量:', finalRecords.length);
      console.log('最终去重后的记录:', finalRecords);
      
      // 补充宝宝信息页添加的已排敏食物（没有每日排敏记录的）
      const dailyFoodNames = new Set(finalRecords.map(r => r.foodName));
      const foodMap = new Map();
      if (Array.isArray(allFoods)) {
        allFoods.forEach(food => foodMap.set(food.name, food));
      }
      babySafeFoodNames.forEach(foodName => {
        if (!dailyFoodNames.has(foodName)) {
          const food = foodMap.get(foodName);
          const todayStr = safeDateFormat(new Date());
          finalRecords.push({
            _id: `baby-safe-${foodName}`,
            foodName: foodName,
            category: food ? food.category : '',
            date: new Date().toISOString(),
            displayDate: todayStr,
            allergyStatus: -1,
            likeStatus: -2,
            statusText: '未记录',
            likeText: '未记录',
            progressText: '排敏完成',
            sensitivityDays: food ? (food.allergyLevel === 3 ? 5 : 3) : 3,
            totalDays: food ? (food.allergyLevel === 3 ? 5 : 3) : 3,
            statusTag: '未记录',
            statusClass: 'status-unrecorded'
          });
          console.log(`✅ 补充宝宝信息页记录: ${foodName}`);
        }
      });
      
      // 再次排序，确保补充记录排在合适位置
      finalRecords.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
      
      // 根据筛选条件过滤记录
      let filteredRecords = finalRecords;
      if (filter === 'safe') {
        filteredRecords = finalRecords.filter(record => record.allergyStatus === 0);
      } else if (filter === 'allergy') {
        filteredRecords = finalRecords.filter(record => record.allergyStatus > 0);
      }
      
      // 最后一步：对过滤后的记录再次去重，确保万无一失
      const finalFilteredMap = new Map();
      filteredRecords.forEach(record => {
        finalFilteredMap.set(record._id, record);
      });
      const finalFilteredRecords = Array.from(finalFilteredMap.values());
      
      console.log('最终显示的记录数量:', finalFilteredRecords.length);
      
      this.setData({
        records: finalFilteredRecords,
        loading: false
      });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({
        title: '获取记录失败',
        icon: 'none'
      });
    });
  },

  /**
   * 设置筛选条件
   */
  setFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      activeFilter: filter
    });
    // 重新获取记录
    this.getSensitivityRecords();
  },

  /**
   * 查看记录详情
   */
  viewRecordDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/sensitivity/pages/detail?id=${id}`
    });
  },

  /**
   * 返回上一页
   */
  navigateBack: function() {
    wx.navigateBack();
  },

  /**
   * 获取状态文本
   */
  getStatusText: function(status) {
    switch (status) {
      case 0:
        return '安全';
      case 1:
        return '轻微过敏';
      case 2:
        return '重度过敏';
      default:
        return '未记录';
    }
  },

  /**
   * 获取喜好文本
   */
  getLikeText: function(status) {
    switch (status) {
      case 2:
        return '喜欢';
      case 1:
        return '一般';
      case 0:
        return '不喜欢';
      default:
        return '未记录';
    }
  },

  /**
   * 计算排敏天数
   * @param {string} recordDateStr - 记录日期字符串 (YYYY-MM-DD)
   * @returns {number} 排敏天数
   */
  calculateSensitivityDays: function(recordDateStr) {
    if (!recordDateStr) return 0;
    
    try {
      const recordDate = new Date(recordDateStr);
      const today = new Date();
      
      // 将时间部分设为0，只比较日期
      recordDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      // 计算天数差
      const diffTime = today.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 表示当天是第1天
      
      return diffDays > 0 ? diffDays : 1;
    } catch (error) {
      console.error('计算排敏天数失败:', error);
      return 0;
    }
  }
});
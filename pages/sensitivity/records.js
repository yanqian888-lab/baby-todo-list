// pages/sensitivity/records.js
const app = getApp();
const sensitivityService = require('../../services/sensitivityService');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    records: [],
    activeFilter: 'all',
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查用户登录状态
    this.checkLogin();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时先清理重复记录，再刷新
    this.cleanupLocalRecords();
    this.getSensitivityRecords();
  },

  /**
   * 检查用户登录状态
   */
  checkLogin: function() {
    const token = wx.getStorageSync('token');
    if (!token) {
      // 用户未登录，跳转到登录页
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  /**
   * 清理本地存储中的重复记录
   */
  cleanupLocalRecords: function() {
    try {
      const userId = app.globalData.userInfo._id;
      const babyId = app.globalData.userInfo.babyInfo ? app.globalData.userInfo.babyInfo._id : 'local-baby-id';
      
      // 从本地存储获取所有记录
      let allRecords = wx.getStorageSync('sensitivity_records') || [];
      console.log('清理前的本地存储记录数量:', allRecords.length);
      
      // 对所有记录进行严格去重
      const uniqueRecordsMap = new Map();
      allRecords.forEach(record => {
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
        const dateKey = new Date(recordDate).toISOString().split('T')[0];
        
        // 创建复合键
        const foodId = record.foodId || foodName;
        const compositeKey = `${recordUserId}-${recordBabyId}-${foodId}-${dateKey}`;
        
        // 只保留最新的记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        if (!existingRecord) {
          // 确保记录有唯一ID和正确的date字段
          if (!record._id) {
            record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          record.date = recordDate;
          uniqueRecordsMap.set(compositeKey, record);
        }
      });
      
      // 转换为数组
      const uniqueRecords = Array.from(uniqueRecordsMap.values());
      
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
    
    // 获取用户ID
    const userId = app.globalData.userInfo._id;
    const babyId = app.globalData.userInfo.babyInfo ? app.globalData.userInfo.babyInfo._id : 'local-baby-id';
    
    // 获取筛选条件
    const filter = this.data.activeFilter;
    
    // 调用静态方法获取排敏记录
    sensitivityService.getUserSensitivityRecords(userId, babyId).then((records) => {
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
        
        // 计算排敏进度
        const sensitivityDays = this.calculateSensitivityDays(displayDate);
        const allergyLevel = record.allergyLevel || 1;
        const totalDays = allergyLevel === 3 ? 5 : 3;
        let progressText = '';
        
        if (sensitivityDays >= totalDays) {
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
          totalDays: totalDays
        };
        
        console.log('处理后的记录:', processedRecord);
        return processedRecord;
      });
      
      // 再次去重，确保最终返回的记录中没有重复
      // 关键改进：使用严格的去重逻辑，确保userId和babyId存在
      const uniqueRecordsMap = new Map();
      processedRecords.forEach(record => {
        // 确保userId和babyId存在
        const userId = record.userId || app.globalData.userInfo._id;
        const babyId = record.babyId || app.globalData.userInfo.babyInfo?._id || 'local-baby-id';
        const foodName = record.foodName || '';
        const dateKey = record.date.substring(0, 10); // 只取日期部分
        // 使用更严格的复合键，确保去重效果
        const compositeKey = `${userId}-${babyId}-${foodName}-${dateKey}`;
        
        // 只保留最新的记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        if (!existingRecord) {
          uniqueRecordsMap.set(compositeKey, record);
        } else {
          // 如果有重复，保留日期更新的记录
          const existingRecordDate = new Date(existingRecord.date).getTime();
          const currentRecordDate = new Date(record.date).getTime();
          if (currentRecordDate > existingRecordDate) {
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
      url: `/pages/sensitivity/detail?id=${id}`
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
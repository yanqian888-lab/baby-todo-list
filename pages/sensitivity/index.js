// pages/sensitivity/index.js
// 食物排敏记录页面
const app = getApp();
const sensitivityService = require('../../services/sensitivityService');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    babyInfo: null,
    recommendedFoods: [],
    sensitivityProgress: 0,
    todaySensitivityRecord: null, // 今日排敏记录
    likeStatusText: '', // 喜欢程度文本
    allergyStatusText: '', // 过敏情况文本
    showBabyInfoModal: false,
    recommendationTitle: '今日推荐排敏食物', // 推荐食物标题，默认为今日
    selectedDate: new Date().toISOString().split('T')[0], // 默认选择当前日期
    showDatePicker: false // 是否显示日期选择器
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 确保userInfo存在
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    } else {
      // 如果没有用户信息，设置为空对象，避免后续操作出错
      this.setData({
        userInfo: null
      });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.checkBabyInfo();
    // 确保每次页面显示时都重新获取今日排敏记录，避免数据丢失
    this.getTodaySensitivityRecord();
  },

  /**
   * 检查宝宝信息是否存在
   */
  checkBabyInfo: async function () {
    try {
      // 确保用户信息存在
      if (!app.globalData.userInfo || !app.globalData.userInfo.openId) {
        console.error('用户信息不存在');
        return;
      }

      console.log('当前用户信息:', app.globalData.userInfo);

      let babyInfo = null;
      
      // 从本地存储直接获取宝宝信息
      const localBabyInfo = wx.getStorageSync('babyInfo');
      console.log('从本地存储获取的宝宝信息:', localBabyInfo);
      
      if (localBabyInfo) {
        babyInfo = localBabyInfo;
      } else if (app.globalData.userInfo.babyInfo) {
        // 从全局用户信息获取宝宝信息
        babyInfo = app.globalData.userInfo.babyInfo;
      } else {
        // 尝试从数据库获取宝宝信息
        try {
          babyInfo = await sensitivityService.getBabyInfo(app.globalData.userInfo.openId);
          console.log('从数据库获取的宝宝信息:', babyInfo);
        } catch (dbError) {
          console.warn('从数据库获取宝宝信息失败:', dbError);
        }
      }
      
      // 如果仍然没有宝宝信息，构建一个默认的宝宝信息对象
      if (!babyInfo) {
        babyInfo = {
          nickname: app.globalData.userInfo.babyName || '',
          birthday: '',
          gender: '',
          safeFoods: '',
          safeFoodsList: [],
          babyAge: app.globalData.userInfo.babyAge || '',
          selectedFoods: '',
          selectedFoodsList: []
        };
      }
      
      console.log('最终使用的宝宝信息:', babyInfo);
      
      this.setData({
        babyInfo: babyInfo,
        showBabyInfoModal: false
      });
      
      // 获取推荐排敏食物
      this.getRecommendedFoods();
      // 获取排敏进度
      this.getSensitivityProgress();
      // 获取今日排敏记录
      this.getTodaySensitivityRecord();
    } catch (error) {
      console.error('检查宝宝信息失败:', error);
      wx.showToast({
        title: '获取宝宝信息失败',
        icon: 'none'
      });
    }
  },

  /**
   * 获取推荐排敏食物
   */
  getRecommendedFoods: async function () {
    try {
      // 确保必要参数存在
      if (!app.globalData.userInfo || !app.globalData.userInfo.openId || !this.data.babyInfo) {
        console.error('获取推荐食物缺少必要参数');
        return;
      }

      // 检查今日是否已有排敏记录
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const allRecords = wx.getStorageSync('sensitivity_records') || [];
      const todayRecords = allRecords.filter(record => {
        const recordDate = new Date(record.date);
        const recordDateStr = recordDate.toISOString().split('T')[0];
        return record.userId === app.globalData.userInfo.openId && recordDateStr === todayStr;
      });

      // 获取推荐排敏食物
      // 使用local-baby-id作为默认值，确保不会因为缺少_id而导致错误
      const recommendedFoods = await sensitivityService.getRecommendedFoods(
        app.globalData.userInfo.openId,
        this.data.babyInfo._id || 'local-baby-id'
      );
      
      // 根据今日是否已有排敏记录，设置推荐模块标题
      const recommendationTitle = todayRecords.length > 0 ? '明日推荐排敏食物' : '今日推荐排敏食物';
      
      this.setData({
        recommendedFoods: recommendedFoods || [],
        recommendationTitle: recommendationTitle
      });
      
      // 默认选择第一个食物
      if (recommendedFoods && recommendedFoods.length > 0) {
        this.setData({
          selectedFood: recommendedFoods[0]
        });
      } else {
        this.setData({
          selectedFood: null
        });
      }
    } catch (error) {
      console.error('获取推荐排敏食物失败:', error);
      wx.showToast({
        title: '获取推荐食物失败',
        icon: 'none'
      });
      // 出错时确保有默认值
      this.setData({
        recommendedFoods: [],
        selectedFood: null,
        recommendationTitle: '今日推荐排敏食物'
      });
    }
  },

  /**
   * 获取排敏进度
   */
  getSensitivityProgress: async function () {
    try {
      // 确保必要参数存在
      if (!app.globalData.userInfo || !app.globalData.userInfo.openId || !this.data.babyInfo) {
        console.error('获取排敏进度缺少必要参数');
        return;
      }

      const progress = await sensitivityService.getSensitivityProgress(
        app.globalData.userInfo.openId,
        this.data.babyInfo._id || 'local-baby-id'
      );
      this.setData({
        sensitivityProgress: progress ? progress.progress : 0
      });
    } catch (error) {
      console.error('获取排敏进度失败:', error);
      // 出错时确保有默认值
      this.setData({
        sensitivityProgress: 0
      });
    }
  },

  /**
   * 获取今日排敏记录
   */
  getTodaySensitivityRecord: async function () {
    try {
      // 确保必要参数存在
      if (!app.globalData.userInfo || !app.globalData.userInfo.openId || !this.data.babyInfo) {
        console.error('获取今日排敏记录缺少必要参数');
        return;
      }

      // 获取今日日期（YYYY-MM-DD格式）
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 从本地存储获取所有排敏记录
      const allRecords = wx.getStorageSync('sensitivity_records') || [];
      
      // 过滤今日的排敏记录
      const todayRecords = allRecords.filter(record => {
        const recordDate = new Date(record.date);
        const recordDateStr = recordDate.toISOString().split('T')[0];
        return record.userId === app.globalData.userInfo.openId && 
               recordDateStr === todayStr;
      });

      // 获取第一条记录（今日仅可选择一个）
      if (todayRecords.length > 0) {
        const todayRecord = todayRecords[0];
        
        // 转换状态为文本
        const likeStatusText = ['', '喜欢', '一般', '不喜欢'][todayRecord.likeStatus + 1];
        const allergyStatusText = ['', '不过敏', '轻微过敏', '重度过敏'][todayRecord.allergyStatus + 1];
        
        this.setData({
          todaySensitivityRecord: todayRecord,
          likeStatusText: likeStatusText,
          allergyStatusText: allergyStatusText
        });
      } else {
        this.setData({
          todaySensitivityRecord: null,
          likeStatusText: '',
          allergyStatusText: ''
        });
      }
    } catch (error) {
      console.error('获取今日排敏记录失败:', error);
      this.setData({
        todaySensitivityRecord: null,
        likeStatusText: '',
        allergyStatusText: ''
      });
    }
  },

  /**
   * 跳转到排敏食物选择页面
   */
  navigateToFoodSelect: function () {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 检查所选日期是否已有排敏记录
    const allRecords = wx.getStorageSync('sensitivity_records') || [];
    const userId = app.globalData.userInfo?.openId;
    
    const selectedDate = this.data.selectedDate || todayStr;
    
    const existingRecord = allRecords.find(record => {
      const recordDateStr = new Date(record.date).toISOString().split('T')[0];
      return record.userId === userId && recordDateStr === selectedDate;
    });
    
    let url = `/pages/sensitivity/food-select?selectedDate=${selectedDate}`;
    
    if (existingRecord) {
      url += `&modify=true&record=${encodeURIComponent(JSON.stringify(existingRecord))}`;
    }
    
    wx.navigateTo({ url });
  },

  /**
   * 修改今日排敏记录
   */
  modifyTodayRecord: function () {
    // 获取今日排敏记录
    const todayRecord = this.data.todaySensitivityRecord;
    
    if (todayRecord) {
      // 获取原记录的日期
      const recordDate = new Date(todayRecord.date).toISOString().split('T')[0];
      // 跳转到排敏食物选择页面，并传递今日排敏记录和记录日期
      wx.navigateTo({
        url: `/pages/sensitivity/food-select?modify=true&record=${encodeURIComponent(JSON.stringify(todayRecord))}&selectedDate=${recordDate}`
      });
    } else {
      // 没有今日排敏记录，直接跳转到排敏食物选择页面
      this.navigateToFoodSelect();
    }
  },



  /**
   * 打开宝宝信息填写页
   */
  openBabyInfoPage: function () {
    wx.navigateTo({
      url: '/pages/profile/baby-info'
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    if (this.data.babyInfo) {
      this.getRecommendedFoods();
      this.getSensitivityProgress();
    }
    wx.stopPullDownRefresh();
  },

  /**
   * 接收从食物选择页面返回的已选择食物
   * @param {Array} selectedFoods - 已选择的食物列表
   */
  onFoodsSelected: function (selectedFoods) {
    // 确保selectedFoods存在且有数据
    if (selectedFoods && selectedFoods.length > 0) {
      const food = selectedFoods[0];
      
      // 更新今日排敏记录
      const todayRecord = {
        foodId: food.foodId,
        foodName: food.foodName,
        category: food.category,
        likeStatus: food.likeIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
        allergyStatus: food.allergyIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
        date: new Date().toISOString()
      };
      
      // 转换状态为文本
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
      
      const likeStatusText = getLikeText(todayRecord.likeStatus);
      const allergyStatusText = getStatusText(todayRecord.allergyStatus);
      
      this.setData({
        todaySensitivityRecord: todayRecord,
        likeStatusText: likeStatusText,
        allergyStatusText: allergyStatusText
      });
      
      // 更新推荐模块标题
      this.setData({
        recommendationTitle: '明日推荐排敏食物'
      });
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '宝宝辅食排敏记录',
      path: '/pages/sensitivity/index'
    };
  }
})
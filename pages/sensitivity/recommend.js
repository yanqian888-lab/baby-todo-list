// pages/sensitivity/recommend.js
const app = getApp();
const sensitivityService = require('../../services/sensitivityService');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    babyInfo: null,        // 宝宝信息
    recommendedFoods: [],  // 推荐食物列表
    loading: false,        // 加载状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.initData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.initData();
  },

  /**
   * 初始化数据
   */
  initData: function () {
    this.setData({
      loading: true
    });
    
    // 获取宝宝信息
    this.getBabyInfo();
    
    // 获取推荐食物
    this.getRecommendations();
  },

  /**
   * 获取宝宝信息
   */
  getBabyInfo: function () {
    // 从全局获取用户信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && (userInfo.babyInfo || userInfo.babyName)) {
      // 构建宝宝信息对象
      const babyInfo = {
        nickname: userInfo.babyName || userInfo.babyInfo?.babyName || userInfo.babyInfo?.nickname || '',
        birthday: userInfo.babyInfo?.birthday || '',
        gender: userInfo.babyInfo?.gender || '',
        safeFoods: userInfo.babyInfo?.safeFoods || '',
        safeFoodsList: userInfo.babyInfo?.safeFoodsList || (userInfo.babyInfo?.safeFoods ? userInfo.babyInfo.safeFoods.split(',').filter(food => food.trim()) : []),
        babyAge: userInfo.babyAge || '',
        selectedFoods: userInfo.babyInfo?.selectedFoods || userInfo.babyInfo?.safeFoods || '',
        selectedFoodsList: userInfo.babyInfo?.selectedFoodsList || (userInfo.babyInfo?.selectedFoods ? userInfo.babyInfo.selectedFoods : [])
      };
      this.setData({ babyInfo: babyInfo });
    }
  },

  /**
   * 获取排敏推荐
   */
  getRecommendations: async function () {
    try {
      // 确保必要参数存在
      if (!app.globalData.userInfo || !app.globalData.userInfo.openId) {
        console.error('获取推荐食物缺少必要参数');
        this.setData({ 
          recommendedFoods: [],
          loading: false
        });
        return;
      }

      // 获取宝宝ID
      const babyId = this.data.babyInfo?._id || 'local-baby-id';
      
      // 获取推荐排敏食物
      const recommendedFoods = await sensitivityService.getRecommendedFoods(
        app.globalData.userInfo.openId,
        babyId
      );
      
      this.setData({
        recommendedFoods: recommendedFoods || [],
        loading: false
      });
    } catch (err) {
      console.error('获取排敏推荐失败:', err);
      this.setData({ 
        recommendedFoods: [],
        loading: false
      });
      wx.showToast({
        title: '获取推荐失败',
        icon: 'none'
      });
    }
  },

  /**
   * 查看食物详情
   */
  viewFoodDetail: function (e) {
    const foodId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/sensitivity/detail?id=${foodId}`
    });
  },

  /**
   * 编辑宝宝信息
   */
  editBabyInfo: function () {
    wx.navigateTo({
      url: '/pages/profile/baby-info'
    });
  },

  /**
   * 返回上一页
   */
  navigateBack: function () {
    wx.navigateBack();
  },
});
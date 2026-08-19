// pages/sensitivity/detail.js
import sensitivityService from '../../services/sensitivityService';
import authService from '../../services/authService';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    foodId: '',           // 食物ID
    foodDetail: null,     // 食物详情
    loading: false,       // 加载状态
    error: '',            // 错误信息
    isLoggedIn: false     // 登录状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    const foodId = options.id;
    if (foodId) {
      this.setData({ foodId });
      this.setData({ isLoggedIn: true });
    } else {
      this.setData({ error: '食物ID不存在' });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    if (this.data.foodId) {
      this.loadFoodDetail();
    }
  },

  /**
   * 检查登录状态
   */
  checkLogin: function () {
    const isLoggedIn = authService.isLoggedIn();
    if (!isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ isLoggedIn: true });
  },

  /**
   * 加载食物详情
   */
  loadFoodDetail: function () {
    this.setData({ loading: true, error: '' });
    
    sensitivityService.getFoodDetail(this.data.foodId)
      .then(res => {
        if (!res || !res.success || !res.data) {
          throw new Error((res && res.error) || '获取食物详情失败');
        }
        this.setData({
          foodDetail: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('获取食物详情失败:', err);
        this.setData({
          loading: false,
          error: '获取食物详情失败，请重试'
        });
        wx.showToast({
          title: '获取详情失败',
          icon: 'none'
        });
      });
  },

  /**
   * 添加排敏记录
   */
  addSensitivityRecord: function () {
    if (!this.data.foodDetail) return;
    
    wx.navigateTo({
      url: `/subpackages/sensitivity/pages/add-record?foodId=${this.data.foodId}&foodName=${this.data.foodDetail.name}&foodType=${this.data.foodDetail.type}`
    });
  },

  /**
   * 返回上一页
   */
  navigateBack: function () {
    wx.navigateBack();
  },
});
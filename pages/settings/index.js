// pages/settings/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    settings: {
      notifications: true,
      reminderSound: true,
      autoSync: true,
      darkMode: false,
      language: 'zh'
    },
    languages: [
      { id: 'zh', name: '简体中文' },
      { id: 'en', name: 'English' }
    ],
    cacheSize: '12.3MB',
    version: '1.0.0'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    // 加载设置
    this.loadSettings();
    // 计算缓存大小
    this.calculateCacheSize();
  },

  onShow: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
  },
  
  /**
   * 返回上一页
   */
  navigateBack: function () {
    wx.navigateBack();
  },

  /**
   * 加载用户设置
   */
  loadSettings: function () {
    // 从本地存储加载设置
    const savedSettings = wx.getStorageSync('userSettings');
    if (savedSettings) {
      this.setData({
        settings: savedSettings
      });
    }
  },

  /**
   * 保存设置
   */
  saveSettings: function (settings) {
    wx.setStorageSync('userSettings', settings);
  },

  /**
   * 计算缓存大小
   */
  calculateCacheSize: function () {
    // 模拟计算缓存大小
    // 实际项目中应使用wx.getStorageInfoSync()
    const cacheSize = (Math.random() * 20 + 5).toFixed(1) + 'MB';
    this.setData({ cacheSize });
  },

  /**
   * 开关设置项
   */
  toggleSetting: function (e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    
    const newSettings = {
      ...this.data.settings,
      [key]: value
    };
    
    this.setData({ settings: newSettings });
    this.saveSettings(newSettings);
    
    // 根据设置项做相应处理
    if (key === 'notifications') {
      this.handleNotificationSetting(value);
    } else if (key === 'darkMode') {
      this.handleDarkModeSetting(value);
    }
  },

  /**
   * 处理通知设置
   */
  handleNotificationSetting: function (enabled) {
    if (enabled) {
      // 请求通知权限
      wx.requestSubscribeMessage({
        tmplIds: ['your-template-id'],
        success: (res) => {
          console.log('通知权限请求结果:', res);
        }
      });
    }
  },

  /**
   * 处理深色模式设置
   */
  handleDarkModeSetting: function (enabled) {
    // 应用深色模式
    if (enabled) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#1a1a1a'
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#ffffff'
      });
    }
  },

  /**
   * 选择语言
   */
  selectLanguage: function (e) {
    const languageId = e.currentTarget.dataset.id;
    
    const newSettings = {
      ...this.data.settings,
      language: languageId
    };
    
    this.setData({ settings: newSettings });
    this.saveSettings(newSettings);
    
    wx.showToast({
      title: '语言已切换',
      icon: 'success'
    });
  },

  /**
   * 清除缓存
   */
  clearCache: function () {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.clearStorageSync();
          
          this.setData({ cacheSize: '0KB' });
          
          wx.showToast({
            title: '缓存已清除',
            icon: 'success'
          });
          
          // 重新加载设置
          this.loadSettings();
        }
      }
    });
  },

  /**
   * 检查更新
   */
  checkUpdate: function () {
    wx.showLoading({ title: '检查更新中...' });
    
    // 模拟检查更新
    setTimeout(() => {
      wx.hideLoading();
      
      wx.showToast({
        title: '已是最新版本',
        icon: 'none'
      });
    }, 1000);
  },

  /**
   * 关于我们
   */
  aboutUs: function () {
    wx.navigateTo({
      url: '/subpackages/profile/pages/about'
    });
  },

  /**
   * 用户协议
   */
  userAgreement: function () {
    wx.showToast({
      title: '用户协议功能开发中',
      icon: 'none'
    });
  },

  /**
   * 隐私政策
   */
  privacyPolicy: function () {
    wx.showToast({
      title: '隐私政策功能开发中',
      icon: 'none'
    });
  }
});
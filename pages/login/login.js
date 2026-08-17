// pages/login/login.js
const userService = require('../../services/userService.js');
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLoading: false,
    isAgreed: false,
    loginAttempts: 0,
    maxAttempts: 3,
    networkAvailable: true,
    userInfo: null,
    avatarUrl: '',
    nickName: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    // 检查网络状态
    this.checkNetworkStatus();
    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      this.setData({ networkAvailable: res.isConnected });
      if (!res.isConnected) {
        wx.showToast({
          title: '网络连接已断开',
          icon: 'none'
        });
      }
    });
    // 检查是否已登录
    this.checkLoginStatus();
  },
  
  /**
   * 检查网络状态
   */
  checkNetworkStatus: function() {
    wx.getNetworkType({  
      success: (res) => {
        const networkAvailable = res.networkType !== 'none';
        this.setData({ networkAvailable });
        if (!networkAvailable) {
          wx.showToast({
            title: '请检查网络连接',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function () {
    const isLoggedIn = userService.checkLoginStatus();
    if (isLoggedIn) {
      // 已登录则跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 同意用户协议和隐私政策
   */
  toggleAgreement: function () {
    this.setData({
      isAgreed: !this.data.isAgreed
    });
  },

  /**
   * 跳转到用户协议页面
   */
  navigateToAgreement: function () {
    wx.navigateTo({
      url: '/pages/user-agreement/index'
    });
  },

  /**
   * 跳转到隐私政策页面
   */
  navigateToPrivacy: function () {
    wx.navigateTo({
      url: '/pages/privacy-policy/index'
    });
  },

  /**
   * 微信登录
   */
  // 微信登录主方法
  wxLogin: async function (userInfo) {
    // 检查是否同意协议
    if (!this.data.isAgreed) {
      wx.showToast({
        title: '请先阅读并同意用户协议和隐私政策',
        icon: 'none'
      });
      return;
    }

    // 检查网络状态
    if (!this.data.networkAvailable) {
      wx.showToast({
        title: '请检查网络连接后重试',
        icon: 'none'
      });
      return;
    }

    // 检查登录尝试次数
    if (this.data.loginAttempts >= this.data.maxAttempts) {
      wx.showModal({
        title: '提示',
        content: '登录失败次数过多，请稍后再试',
        showCancel: false
      });
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 1. 获取用户信息授权（由按钮点击直接触发）
      // 2. 调用微信登录接口获取code
      const { code } = await this.getWxCode();
      console.log('微信登录code获取成功');

      // 3. 调用云函数或后端API进行登录
      const loginResult = await userService.login(code, userInfo);
      console.log('登录结果:', loginResult);
      
      if (loginResult.success) {
        // 登录成功，重置尝试次数
        this.setData({ loginAttempts: 0 });
        
        console.log('准备保存用户信息:', loginResult.data);
        
        // 保存用户信息到本地存储
        if (loginResult.data && loginResult.data.userInfo && loginResult.data.token) {
          userService.saveUserInfo(loginResult.data.userInfo, loginResult.data.token);
        } else {
          console.warn('登录结果数据不完整:', loginResult);
        }
        
        // 更新全局用户信息
        if (loginResult.data && loginResult.data.userInfo) {
          app.updateUserInfo(loginResult.data.userInfo);
        }
        
        // 立即跳转到首页，不显示 toast 避免延迟
        console.log('登录成功，立即跳转到首页...');
        
        // 使用 reLaunch 跳转到首页（可以关闭所有页面，包括非 tabBar 页面）
        // 注意：路径必须以 / 开头表示绝对路径
        wx.reLaunch({
          url: '/pages/index/index',
          success: () => {
            console.log('reLaunch 到首页成功');
          },
          fail: (err) => {
            console.error('reLaunch 失败:', err);
            // 备用方案：尝试 switchTab
            wx.switchTab({
              url: '/pages/index/index',
              success: () => {
                console.log('switchTab 成功');
              },
              fail: (err2) => {
                console.error('switchTab 也失败:', err2);
                wx.showToast({
                  title: '跳转失败，请手动返回',
                  icon: 'none'
                });
              }
            });
          }
        });
      } else {
        throw new Error(loginResult.error || '登录失败');
      }

    } catch (error) {
      console.error('登录失败:', error);
      
      // 增加失败次数
      this.setData({
        loginAttempts: this.data.loginAttempts + 1
      });
      
      // 根据错误类型显示不同提示
      let errorMsg = '登录失败，请重试';
      if (error) {
        if (error.message) {
          if (error.message.includes('授权')) {
            errorMsg = '请授权以使用完整功能';
          } else if (error.message.includes('网络')) {
            errorMsg = '网络异常，请检查网络连接';
          } else if (error.message.includes('access_token missing') || error.message.includes('需要重新登录')) {
            errorMsg = '请重新登录';
            // 清除本地存储的登录信息，确保下次登录时重新获取
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('authInfo');
          }
        } else if (error.errMsg) {
          // 处理微信API直接返回的errMsg
          if (error.errMsg.includes('access_token missing') || error.errMsg.includes('需要重新登录')) {
            errorMsg = '请重新登录';
            // 清除本地存储的登录信息，确保下次登录时重新获取
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('authInfo');
          }
        }
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },
  
  // 头像昵称填写能力：选择头像（wx.getUserProfile 已废弃）
  onChooseAvatar: function (e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      // 临时路径，可直接展示并随登录链路传给云函数
      this.setData({ avatarUrl: avatarUrl });
    }
  },

  // 头像昵称填写能力：输入昵称
  onNicknameInput: function (e) {
    this.setData({ nickName: (e.detail.value || '').trim() });
  },

  // 确认并登录：使用用户选择的头像和昵称，未填写时走随机昵称/默认头像兜底
  handleConfirmLogin: async function () {
    // 防止重复点击
    if (this._isLoggingIn) {
      console.log('登录正在处理中，忽略重复点击');
      return;
    }
    this._isLoggingIn = true;

    try {
      // 未填昵称时传 undefined，由云函数生成唯一随机昵称（保留原有兜底逻辑）
      // 未选头像时使用默认头像兜底
      const userInfo = {
        nickName: this.data.nickName || undefined,
        avatarUrl: this.data.avatarUrl || '/images/touxiang_moren.png',
        gender: 0
      };

      console.log('确认登录，用户信息:', userInfo);

      // 保存用户信息到data
      this.setData({ userInfo: userInfo });

      // 执行登录流程
      await this.wxLogin(userInfo);
    } finally {
      this._isLoggingIn = false;
    }
  },

  /**
   * 获取微信登录code - 兼容处理access_token missing错误
   */
  getWxCode: function () {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve(res);
          } else {
            // 如果没有code，返回一个默认值，让登录流程能继续
            resolve({ code: 'default-code' });
          }
        },
        fail: (err) => {
          console.error('获取登录code失败:', err);
          // 如果获取code失败，检查错误类型
          if (err.errMsg && (err.errMsg.includes('access_token missing') || err.errMsg.includes('需要重新登录'))) {
            // 清除本地存储的登录信息
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('authInfo');
            // 返回一个默认值，让登录流程能继续
            resolve({ code: 'default-code' });
          } else {
            // 其他错误，返回一个默认值，让登录流程能继续
            resolve({ code: 'default-code' });
          }
        }
      });
    });
  },

  /**
   * 获取用户信息 - 兼容处理各种错误情况
   */
  /**
   * 处理用户拒绝授权
   */
  handleUserReject: function () {
    wx.showModal({
      title: '提示',
      content: '需要您的授权才能使用完整功能',
      showCancel: false
    });
  }
});
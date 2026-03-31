// pages/auth/auth.js
/**
 * 用户授权页面
 * 用于获取用户详细信息和权限
 */

const userService = require('../../services/userService');

Page({
  data: {
    isLoading: false,
    userInfo: null,
    canIUseGetUserProfile: false
  },

  onLoad: function() {
    // 检查是否支持 getUserProfile API
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
    
    // 获取上一页传递的参数
    const options = this.options || {};
    this.setData({
      code: options.code || '',
      from: options.from || ''
    });
  },

  /**
   * 获取用户信息
   */
  getUserProfile: function() {
    const that = this;
    
    if (that.data.isLoading) return;
    
    that.setData({
      isLoading: true
    });
    
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功', res.userInfo);
        that.handleUserInfo(res.userInfo);
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        that.setData({
          isLoading: false
        });
        wx.showToast({
          title: '授权失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 处理用户信息，完成登录流程
   */
  handleUserInfo: function(userInfo) {
    const that = this;
    
    // 调用登录接口
    userService.login(that.data.code, userInfo)
      .then(res => {
        if (res.success) {
          // 保存用户信息
          userService.saveUserInfo(res.data.userInfo, res.data.token);
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          
          // 延迟跳转，让用户看到成功提示
          setTimeout(() => {
            that.navigateToTargetPage();
          }, 1500);
        } else {
          throw new Error('登录失败');
        }
      })
      .catch(err => {
        console.error('登录失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      })
      .finally(() => {
        that.setData({
          isLoading: false
        });
      });
  },

  /**
   * 跳转到目标页面
   */
  navigateToTargetPage: function() {
    const from = this.data.from;
    
    if (from) {
      // 如果有来源页面，跳转到来源页面
      wx.navigateTo({
        url: from
      });
    } else {
      // 默认跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 拒绝授权
   */
  onRefuse: function() {
    wx.showToast({
      title: '授权后才能使用全部功能',
      icon: 'none'
    });
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function() {
    return {
      title: '母婴打卡，记录宝宝成长的每一天',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.jpg'
    };
  }
});
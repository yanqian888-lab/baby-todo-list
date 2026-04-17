// pages/family/join.js
const familyService = require('../../services/familyService');
const app = getApp();

Page({
  data: {
    inviteCode: '',
    familyId: '',
    loading: true,
    error: '',
    familyName: '',
    hasVerified: false
  },

  onLoad: function(options) {
    if (!this.checkLogin()) return;

    // 从分享链接获取参数
    const { inviteCode, familyId } = options;
    
    if (!inviteCode || !familyId) {
      this.setData({
        loading: false,
        error: '无效的邀请链接'
      });
      return;
    }
    
    this.setData({
      inviteCode: inviteCode,
      familyId: familyId
    });
  },

  onShow: function() {
    this.checkLogin();
  },

  // 检查登录状态
  checkLogin: function() {
    if (this.data.hasVerified) return true;

    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      // 未登录，先登录
      wx.showModal({
        title: '请先登录',
        content: '加入家庭需要先登录账号',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/login/login?redirect=/pages/family/join&inviteCode=' + this.data.inviteCode + '&familyId=' + this.data.familyId
          });
        }
      });
      return false;
    }
    
    // 已登录且参数有效，验证邀请码
    if (this.data.inviteCode && this.data.familyId) {
      this.setData({ hasVerified: true });
      this.verifyInvite();
    }
    return true;
  },

  // 验证邀请
  verifyInvite: async function() {
    try {
      // 调用加入家庭
      const result = await familyService.joinFamily(this.data.inviteCode);
      
      this.setData({
        loading: false,
        familyName: result.familyName || '家庭'
      });
      
      wx.showToast({
        title: '加入成功',
        icon: 'success',
        duration: 2000
      });
      
      // 延迟跳转到家庭页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/family/index'
        });
      }, 2000);
      
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '邀请码无效或已过期'
      });
    }
  },

  // 返回首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 返回家庭页
  goToFamily: function() {
    wx.redirectTo({
      url: '/pages/family/index'
    });
  }
});

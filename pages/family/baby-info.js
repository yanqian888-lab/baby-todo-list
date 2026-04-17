// pages/family/baby-info.js
const familyService = require('../../services/familyService');

Page({
  data: {
    familyId: '',
    babyInfo: {
      nickname: '',
      gender: 'boy',
      birthday: ''
    }
  },

  onLoad: function(options) {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      familyId: options.familyId || ''
    });
    this.loadBabyInfo();
  },

  onShow: function() {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
  },

  // 加载宝宝信息
  loadBabyInfo: async function() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const result = await familyService.getMyFamilies();
      const families = result.families || [];
      const targetFamily = families.find(f => f._id === this.data.familyId);
      
      if (targetFamily && targetFamily.babyInfo) {
        this.setData({
          babyInfo: {
            nickname: targetFamily.babyInfo.nickname || '',
            gender: targetFamily.babyInfo.gender || 'boy',
            birthday: targetFamily.babyInfo.birthday || ''
          }
        });
      }
      
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('加载宝宝信息失败:', error);
    }
  },

  // 昵称输入
  onNicknameInput: function(e) {
    this.setData({
      'babyInfo.nickname': e.detail.value
    });
  },

  // 选择性别
  onSelectGender: function(e) {
    this.setData({
      'babyInfo.gender': e.currentTarget.dataset.gender
    });
  },

  // 选择生日
  onBirthdayChange: function(e) {
    this.setData({
      'babyInfo.birthday': e.detail.value
    });
  },

  // 保存宝宝信息
  saveBabyInfo: async function() {
    const { babyInfo, familyId } = this.data;
    
    if (!babyInfo.nickname.trim()) {
      wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
      return;
    }
    if (!babyInfo.birthday) {
      wx.showToast({ title: '请选择宝宝生日', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });
      
      await familyService.updateBabyInfo(familyId, {
        nickname: babyInfo.nickname.trim(),
        gender: babyInfo.gender,
        birthday: babyInfo.birthday
      });
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    }
  }
});

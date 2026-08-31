// pages/family/index.js
const app = getApp();
const db = wx.cloud.database();
const _ = db.command;
const familyService = require('../../services/familyService');

Page({
  data: {
    createdFamilies: [], // 我创建的家庭
    joinedFamilies: [],  // 我加入的家庭
    currentUserId: '',
    showJoinModal: false,
    showInviteModal: false,
    inviteCode: '',
    currentFamilyId: '',
    joinForm: {
      inviteCode: ''
    }
  },

  onLoad: function() {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ hasLoaded: true });
    this.loadFamilyData();
  },

  onShow: function() {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    if (this.data.hasLoaded) {
      this.loadFamilyData();
    } else {
      this.setData({ hasLoaded: true });
    }
  },

  // 获取当前用户ID
  getCurrentUserId: function() {
    const userInfo = app.globalData.userInfo || {};
    const storedUserInfo = wx.getStorageSync('userInfo') || {};
    return userInfo.openId || userInfo._id || userInfo.openid || storedUserInfo.openId;
  },

  // 加载家庭数据
  loadFamilyData: async function() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const userId = this.getCurrentUserId();
      if (!userId) {
        wx.hideLoading();
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      
      this.setData({ currentUserId: userId });

      // 使用云函数获取家庭数据（绕过权限限制）
      try {
        console.log('🏠 调用云函数获取家庭列表...');
        const result = await wx.cloud.callFunction({
          name: 'familyManager',
          data: {
            action: 'getMyFamilies'
          }
        });
        
        console.log('🏠 云函数返回:', result.result);
        
        if (result.result.success) {
          const families = result.result.families || [];
          
          // 分离创建的和加入的
          const createdFamilies = [];
          const joinedFamilies = [];
          
          for (const family of families) {
            const isCreator = family.creatorOpenId === userId;
            const babyNickname = family.babyInfo?.nickname || family.babyNickname || '宝宝';
            const familyData = {
              ...family,
              name: family.familyName || `${babyNickname}的家`,
              babyNickname: babyNickname,
              members: family.members ? family.members.map(m => ({
                userId: m.openId,
                nickName: m.nickName || '家庭成员',
                role: m.role
              })) : []
            };
            
            if (isCreator) {
              createdFamilies.push(familyData);
            } else {
              joinedFamilies.push(familyData);
            }
          }

          this.setData({
            createdFamilies,
            joinedFamilies
          });
        } else {
          console.error('🏠 云函数返回错误:', result.result.error);
        }

      } catch (cloudError) {
        console.error('🏠 调用云函数失败:', cloudError);
      }
      
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('加载家庭数据失败:', error);
    }
  },

  // 显示加入家庭弹窗
  showJoinModal: function() {
    this.setData({ 
      showJoinModal: true,
      joinForm: { inviteCode: '' }
    });
  },

  // 隐藏加入家庭弹窗
  hideJoinModal: function() {
    this.setData({ showJoinModal: false });
  },

  // 显示邀请弹窗
  showInviteModal: async function(e) {
    const familyId = e.currentTarget.dataset.familyId;
    
    this.setData({
      currentFamilyId: familyId
    });
    
    // 调用云函数生成邀请码
    try {
      wx.showLoading({ title: '生成中...' });
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'inviteMember',
          familyId: familyId
        }
      });
      
      console.log('📨 云函数返回:', result.result);
      
      if (result.result.success) {
        this.setData({
          showInviteModal: true,
          inviteCode: result.result.inviteCode
        });
      } else {
        wx.showToast({ title: result.result.error || '生成失败', icon: 'none' });
      }
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('📨 调用云函数失败:', error);
      wx.showToast({ title: '邀请码生成失败', icon: 'none' });
    }
  },

  // 隐藏邀请弹窗
  hideInviteModal: function() {
    this.setData({ showInviteModal: false });
  },

  // 邀请码输入
  onJoinCodeInput: function(e) {
    this.setData({ 'joinForm.inviteCode': e.detail.value });
  },

  // 加入家庭
  joinFamily: async function() {
    const { inviteCode } = this.data.joinForm;
    
    if (!inviteCode || inviteCode.length !== 6 || !/^[A-Z0-9]{6}$/i.test(inviteCode)) {
      wx.showToast({ title: '请输入6位字母数字邀请码', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '加入中...' });
      
      // 获取用户昵称
      const userInfo = app.globalData.userInfo || {};
      const nickName = userInfo.nickName || userInfo.userInfo?.nickName || '家庭成员';
      
      // 调用云函数加入家庭
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'joinFamily',
          inviteCode: inviteCode.toUpperCase(),
          nickName: nickName
        }
      });
      
      console.log('🔑 云函数返回:', result.result);
      
      wx.hideLoading();
      
      if (result.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' });
        wx.setStorageSync('currentFamilyId', result.result.familyId);
        familyService.clearCache(); // 直接调 familyManager 写操作，手动清 getMyFamilies 缓存
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentFamilyId = result.result.familyId;
        }
        this.hideJoinModal();
        this.loadFamilyData();
      } else {
        wx.showToast({ title: result.result.error || '加入失败', icon: 'none' });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('🔑 加入家庭失败:', error);
      wx.showToast({ title: '加入失败: ' + error.message, icon: 'none' });
    }
  },

  // 确认退出家庭（二次确认）
  confirmExitFamily: function(e) {
    const { familyId, familyName } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认退出',
      content: `是否确认退出家庭"${familyName || '该家庭'}"？`,
      confirmColor: '#8B7355',
      success: (res) => {
        if (res.confirm) {
          this.exitFamily(familyId);
        }
      }
    });
  },

  // 退出家庭
  exitFamily: async function(familyId) {
    try {
      wx.showLoading({ title: '退出中...' });
      
      // 调用云函数退出家庭
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'exitFamily',
          familyId: familyId
        }
      });
      
      console.log('退出家庭云函数返回:', result.result);

      wx.hideLoading();
      
      if (result.result.success) {
        wx.showToast({ title: '已退出', icon: 'success' });
        familyService.clearCache(); // 直接调 familyManager 写操作，手动清 getMyFamilies 缓存
        // 清理本地与全局缓存
        wx.removeStorageSync('currentFamilyId');
        wx.removeStorageSync('currentFamily');
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentFamilyId = null;
        }
        this.loadFamilyData();
      } else {
        wx.showToast({ title: result.result.error || '退出失败', icon: 'none' });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('退出家庭失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 复制邀请码（隐私授权由微信原生弹窗处理）
  copyInviteCode: function() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '复制成功，快去分享给家人吧！', icon: 'none' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
      }
    });
  },

  // 确认移出成员（二次确认）
  confirmRemoveMember: function(e) {
    const { familyId, memberId, memberName } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认移出',
      content: `是否确认移出成员"${memberName || '该成员'}"？`,
      confirmColor: '#8B7355',
      success: (res) => {
        if (res.confirm) {
          this.removeMember(familyId, memberId);
        }
      }
    });
  },

  // 移出成员
  removeMember: async function(familyId, memberId) {
    try {
      wx.showLoading({ title: '移出中...' });
      
      // 调用云函数移出成员
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'removeMember',
          familyId: familyId,
          memberOpenId: memberId
        }
      });
      
      console.log('移出成员云函数返回:', result.result);

      wx.hideLoading();
      
      if (result.result.success) {
        wx.showToast({ title: '已移出', icon: 'success' });
        familyService.clearCache(); // 直接调 familyManager 写操作，手动清 getMyFamilies 缓存
        this.loadFamilyData();
      } else {
        wx.showToast({ title: result.result.error || '移出失败', icon: 'none' });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('移出成员失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 分享
  onShareAppMessage: function() {
    return {
      title: '加入我的家庭，一起记录宝宝成长',
      path: `/pages/family/join?inviteCode=${this.data.inviteCode}&familyId=${this.data.currentFamilyId}`,
      imageUrl: '/images/logo.png'
    };
  }
});

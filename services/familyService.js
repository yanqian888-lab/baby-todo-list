// services/familyService.js
// 家庭共享服务

const familyService = {
  // 创建家庭
  createFamily: async function(familyName, babyInfo) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'createFamily',
          familyName: familyName,
          babyInfo: babyInfo
        }
      });
      
      if (result.result.success) {
        // 保存当前家庭到本地
        wx.setStorageSync('currentFamilyId', result.result.familyId);
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('创建家庭失败:', error);
      throw error;
    }
  },

  // 获取我的家庭列表
  getMyFamilies: async function() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'getMyFamilies'
        }
      });
      
      if (result.result.success) {
        // 保存当前家庭ID
        if (result.result.currentFamilyId) {
          wx.setStorageSync('currentFamilyId', result.result.currentFamilyId);
        }
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('获取家庭列表失败:', error);
      throw error;
    }
  },

  // 切换家庭
  switchFamily: async function(familyId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'switchFamily',
          familyId: familyId
        }
      });
      
      if (result.result.success) {
        wx.setStorageSync('currentFamilyId', familyId);
        wx.setStorageSync('currentFamily', result.result.family);
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('切换家庭失败:', error);
      throw error;
    }
  },

  // 生成邀请码
  inviteMember: async function(familyId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'inviteMember',
          familyId: familyId
        }
      });
      
      if (result.result.success) {
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('生成邀请码失败:', error);
      throw error;
    }
  },

  // 加入家庭
  joinFamily: async function(inviteCode) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'joinFamily',
          inviteCode: inviteCode
        }
      });
      
      if (result.result.success) {
        wx.setStorageSync('currentFamilyId', result.result.familyId);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentFamilyId = result.result.familyId;
        }
        return {
          ...result.result,
          familyName: result.result.familyName || '家庭'
        };
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('加入家庭失败:', error);
      throw error;
    }
  },

  // 退出家庭
  exitFamily: async function(familyId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'exitFamily',
          familyId: familyId
        }
      });
      
      if (result.result.success) {
        // 清除当前家庭缓存
        const currentFamilyId = wx.getStorageSync('currentFamilyId');
        if (currentFamilyId === familyId) {
          wx.removeStorageSync('currentFamilyId');
          wx.removeStorageSync('currentFamily');
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.currentFamilyId = null;
          }
        }
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('退出家庭失败:', error);
      throw error;
    }
  },

  // 移除成员
  removeMember: async function(familyId, memberOpenId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'removeMember',
          familyId: familyId,
          memberOpenId: memberOpenId
        }
      });
      
      if (result.result.success) {
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('移除成员失败:', error);
      throw error;
    }
  },

  // 更新宝宝信息
  updateBabyInfo: async function(familyId, babyInfo) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'updateBabyInfo',
          familyId: familyId,
          babyInfo: babyInfo
        }
      });
      
      if (result.result.success) {
        return result.result;
      } else {
        throw new Error(result.result.error);
      }
    } catch (error) {
      console.error('更新宝宝信息失败:', error);
      throw error;
    }
  },

  // 获取当前家庭ID
  getCurrentFamilyId: function() {
    return wx.getStorageSync('currentFamilyId');
  },

  // 分享邀请
  shareInvite: function(familyId, inviteCode) {
    return {
      title: '邀请您加入家庭',
      path: `/pages/family/join?inviteCode=${inviteCode}&familyId=${familyId}`,
      imageUrl: '/images/share-family.png'
    };
  }
};

module.exports = familyService;

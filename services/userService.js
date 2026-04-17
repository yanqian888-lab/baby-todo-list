// services/userService.js
/**
 * 用户服务模块
 * 处理用户登录、授权和信息管理
 */

const userService = {
  /**
   * 登录接口 - 调用云函数进行真实登录
   * @param {string} code - 微信登录code
   * @param {Object} userInfo - 用户信息对象
   * @returns {Promise} 登录结果
   */
  login: async function(code, userInfo) {
    console.log('登录服务调用', code, userInfo);
    
    try {
      // 调用云函数进行登录
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: code,
          userInfo: userInfo || {}
        }
      });
      
      console.log('云函数返回:', result);
      
      if (result.result && result.result.success) {
        // 优先使用云函数返回的用户信息（包含自动生成的随机昵称）
        const cloudUserInfo = result.result.userInfo || {};
        // 构建用户信息
        const userInfoData = {
          openId: result.result.openid,
          unionId: result.result.unionid,
          nickName: cloudUserInfo.nickName || (userInfo && userInfo.nickName) || '用户',
          avatarUrl: cloudUserInfo.avatarUrl || (userInfo && userInfo.avatarUrl) || '/images/logo.png',
          gender: cloudUserInfo.gender !== undefined ? cloudUserInfo.gender : ((userInfo && userInfo.gender) || 0)
        };
        
        const token = 'token-' + Date.now() + '-' + result.result.openid;
        
        // 保存到本地存储
        this.saveUserInfo(userInfoData, token);
        
        return {
          success: true,
          data: {
            token: token,
            userInfo: userInfoData
          }
        };
      } else {
        throw new Error(result.result?.error || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      throw new Error(error.message || '登录失败，请检查网络后重试');
    }
  },

  /**
   * 获取用户信息
   * @returns {Promise} 用户信息
   */
  getUserInfo: function() {
    return new Promise((resolve, reject) => {
      const userInfo = wx.getStorageSync('userInfo');
      const token = wx.getStorageSync('token');
      
      if (userInfo && token) {
        resolve(userInfo);
      } else {
        reject(new Error('未登录'));
      }
    });
  },

  /**
   * 检查登录状态
   * @returns {boolean} 是否已登录
   */
  checkLoginStatus: function() {
    const token = wx.getStorageSync('token');
    return !!token;
  },

  /**
   * 保存用户信息到本地
   * @param {Object} userInfo - 用户信息
   * @param {string} token - 登录凭证
   */
  saveUserInfo: function(userInfo, token) {
    // 使用同步方法保存，确保立即生效
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('token', token);
    console.log('用户信息和token保存成功:', userInfo, token);
  },

  /**
   * 退出登录
   */
  logout: function() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      (storageInfo.keys || []).forEach(key => {
        wx.removeStorageSync(key);
      });
    } catch (e) {
      // 降级：手动清理已知 key
      ['userInfo','token','authInfo','currentFamilyId','currentFamily','babyInfo','sensitivity_records','custom_sensitivity_foods','userSettings','pendingFamilyCreation'].forEach(k => wx.removeStorageSync(k));
    }
    
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userInfo = null;
      app.globalData.currentFamilyId = null;
      app.globalData.babyInfo = null;
      app.globalData.lastSyncTime = null;
    }
  },

  /**
   * 更新用户信息
   * @param {Object} userInfo - 要更新的用户信息
   * @returns {Promise} 更新结果
   */
  updateUserInfo: function(userInfo) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const currentUserInfo = wx.getStorageSync('userInfo');
        const updatedUserInfo = { ...currentUserInfo, ...userInfo };
        wx.setStorageSync('userInfo', updatedUserInfo);
        
        resolve({
          success: true,
          data: updatedUserInfo
        });
      }, 500);
    });
  },

  /**
   * 获取用户统计信息
   * @returns {Promise} 统计信息
   */
  getUserStats: function() {
    return new Promise((resolve, reject) => {
      // 检查用户是否已登录
      const token = wx.getStorageSync('token');
      const userInfo = wx.getStorageSync('userInfo');
      
      if (!token || !userInfo || !userInfo.openId) {
        // 如果用户未登录，返回空数据
        console.log('ℹ️ 用户未登录，返回空统计数据');
        resolve({
          success: true,
          data: {
            totalTasks: 0,
            completedTasks: 0,
            streakDays: 0,
            totalCheckIns: 0
          }
        });
        return;
      }
      
      // 调用云函数获取真实的用户统计数据（汇总所有关联家庭，不限制当前家庭）
      const requestData = {
        openid: userInfo.openId
      };
      console.log('📞 调用getUserStatistics云函数', requestData);
      wx.cloud.callFunction({
        name: 'getUserStatistics',
        data: requestData
      }).then(res => {
        console.log('📥 云函数返回结果:', res);
        
        if (res.result && res.result.success) {
          resolve({
            success: true,
            data: res.result.data
          });
        } else {
          console.error('❌ 云函数执行失败:', res.result?.error || '未知错误');
          // 云函数执行失败，返回空数据
          resolve({
            success: true,
            data: {
              totalTasks: 0,
              completedTasks: 0,
              streakDays: 0,
              totalCheckIns: 0
            }
          });
        }
      }).catch(error => {
        console.error('❌ 调用云函数失败:', error);
        // 云函数调用失败，返回空数据
        resolve({
          success: true,
          data: {
            totalTasks: 0,
            completedTasks: 0,
            streakDays: 0,
            totalCheckIns: 0
          }
        });
      });
    });
  }
};

module.exports = userService;
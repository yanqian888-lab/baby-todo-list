// services/authService.js
/**
 * 认证服务模块
 * 处理用户授权、登录状态和权限验证
 */

const authService = {
  /**
   * 检查用户是否授权
   * @returns {Promise} 授权状态
   */
  checkAuthStatus: function() {
    return new Promise((resolve) => {
      const authInfo = wx.getStorageSync('authInfo');
      if (authInfo) {
        resolve({
          isAuthorized: true,
          authInfo: authInfo
        });
      } else {
        resolve({
          isAuthorized: false
        });
      }
    });
  },

  /**
   * 请求用户授权
   * @param {Array} scopeList - 权限列表
   * @returns {Promise} 授权结果
   */
  requestAuthorize: function(scopeList = []) {
    return new Promise((resolve, reject) => {
      // 对于每个权限进行授权请求
      const authorizePromises = scopeList.map(scope => {
        return new Promise((resolveAuth, rejectAuth) => {
          wx.authorize({
            scope: scope,
            success: () => {
              resolveAuth({ scope, success: true });
            },
            fail: (error) => {
              resolveAuth({ scope, success: false, error });
            }
          });
        });
      });

      Promise.all(authorizePromises)
        .then(results => {
          const successResults = results.filter(item => item.success);
          const failResults = results.filter(item => !item.success);

          if (failResults.length > 0) {
            // 保存成功授权的信息
            const authInfo = {
              authorizedScopes: successResults.map(item => item.scope),
              timestamp: Date.now()
            };
            wx.setStorageSync('authInfo', authInfo);
            
            resolve({
              allSuccess: false,
              successScopes: successResults.map(item => item.scope),
              failScopes: failResults.map(item => item.scope)
            });
          } else {
            // 全部授权成功
            const authInfo = {
              authorizedScopes: successResults.map(item => item.scope),
              timestamp: Date.now()
            };
            wx.setStorageSync('authInfo', authInfo);
            
            resolve({
              allSuccess: true,
              successScopes: successResults.map(item => item.scope)
            });
          }
        })
        .catch(error => {
          reject(error);
        });
    });
  },

  /**
   * 打开权限设置页面
   */
  openSetting: function() {
    return new Promise((resolve, reject) => {
      wx.openSetting({
        success: (res) => {
          resolve(res);
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  /**
   * 检查是否有权限
   * @param {string} scope - 权限名称
   * @returns {boolean} 是否有权限
   */
  hasPermission: function(scope) {
    const authInfo = wx.getStorageSync('authInfo');
    return authInfo && authInfo.authorizedScopes && authInfo.authorizedScopes.includes(scope);
  },

  /**
   * 获取用户信息授权
   * @returns {Promise} 授权结果
   */
  getUserProfile: function() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          // 更新授权信息
          const authInfo = wx.getStorageSync('authInfo') || { authorizedScopes: [] };
          if (!authInfo.authorizedScopes.includes('scope.userInfo')) {
            authInfo.authorizedScopes.push('scope.userInfo');
            authInfo.timestamp = Date.now();
            wx.setStorageSync('authInfo', authInfo);
          }
          resolve(res);
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  /**
   * 清空授权信息
   */
  clearAuthInfo: function() {
    wx.removeStorageSync('authInfo');
  },

  /**
   * 验证会话是否有效
   * @returns {Promise} 验证结果
   */
  checkSession: function() {
    return new Promise((resolve, reject) => {
      wx.checkSession({
        success: () => {
          resolve(true);
        },
        fail: () => {
          reject(new Error('Session expired'));
        }
      });
    });
  },

  /**
   * 检查用户是否已登录
   * @returns {boolean} 是否已登录
   */
  isLoggedIn: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    return !!userInfo && !!token;
  }
};

module.exports = authService;
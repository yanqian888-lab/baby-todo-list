// pages/profile/index.js
const userService = require('../../services/userService');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      avatarUrl: '/images/logo.png',
      nickName: '未登录',
      babyName: '',
      babyAge: ''
    },
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      streakDays: 0
    },
    sensitivityProgress: {
      completed: 0,
      total: 0,
      percentage: 0
    },
    menuItems: [
      {
        id: 'family',
        icon: '👨‍👩‍👧',
        title: '我的家庭',
        showArrow: true
      },
      {
        id: 'baby-info',
        icon: '👶',
        title: '宝宝信息',
        showArrow: true
      },
      {
        id: 'sensitivity-records',
        icon: '📋',
        title: '排敏记录',
        showArrow: true
      },
      {
        id: 'privacy-policy',
        icon: '📖',
        title: '隐私政策',
        showArrow: true
      },
      {
        id: 'user-agreement',
        icon: '📄',
        title: '用户协议',
        showArrow: true
      }
    ],
    hasUserInfo: false,
    isNavigating: false
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
    this.setData({ hasLoaded: true });
    // 页面加载时初始化数据（置初始化标志，onShow 在此期间跳过，避免 onLoad/onShow 重复请求）
    this._initializing = true;
    Promise.resolve(this.initData()).finally(() => {
      this._initializing = false;
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    if (!this._initializing) {
      if (this.data.hasLoaded) {
        // 从其他页面返回时刷新数据
        this.initData();
      } else {
        this.setData({ hasLoaded: true });
      }
    }
    // 重置导航状态
    this.setData({ isNavigating: false });
  },

  /**
   * 初始化页面数据
   */
  initData: function () {
    return userService.getUserInfo().then((userInfo) => {
      this.setData({
        userInfo: this._sanitizeUserInfo(userInfo),
        hasUserInfo: true
      });
      // 获取用户统计信息
      this.getUserStats();
      // 获取排敏进度
      this.getSensitivityProgress();
      // 从云端同步最新用户信息（确保随机昵称等数据最新）
      this.syncUserInfoFromCloud();
    }).catch(() => {
      this.setData({
        userInfo: {
          avatarUrl: '/images/logo.png',
          nickName: '未登录',
          babyName: '',
          babyAge: ''
        },
        hasUserInfo: false,
        sensitivityProgress: {
          completed: 0,
          total: 0,
          percentage: 0
        }
      });
    });
  },

  /**
   * 判断是否为微信默认头像
   */
  _isWechatDefaultAvatar: function(url) {
    return typeof url === 'string' && (url.includes('thirdwx.qlogo.cn') || url.includes('mmopen'));
  },

  /**
   * 判断是否为微信默认昵称
   */
  _isWechatDefaultNickName: function(name) {
    return name === '微信用户';
  },

  /**
   * 清理微信默认信息，避免覆盖系统生成的随机昵称
   */
  _sanitizeUserInfo: function(userInfo) {
    if (!userInfo) return userInfo;
    const sanitized = { ...userInfo };
    if (this._isWechatDefaultAvatar(sanitized.avatarUrl)) {
      sanitized.avatarUrl = '';
    }
    return sanitized;
  },

  /**
   * 从云端同步用户信息
   */
  syncUserInfoFromCloud: function() {
    // 当前未部署 getUserInfo 云函数，改为从本地缓存和 login 云函数已缓存的数据读取
    // 如需实时同步，建议后续部署 getUserInfo 云函数
    const localUserInfo = wx.getStorageSync('userInfo') || {};
    if (localUserInfo.nickName) {
      this.setData({ userInfo: this._sanitizeUserInfo(localUserInfo) });
    }
  },

  /**
   * 获取用户统计信息
   */
  getUserStats: function() {
    userService.getUserStats().then((res) => {
      if (res.success) {
        this.setData({
          stats: res.data
        });
      }
    }).catch(() => {
      console.error('获取统计信息失败');
    });
  },

  /**
   * 选择头像（头像昵称填写能力，wx.getUserProfile/wx.getUserInfo 已废弃）
   */
  onChooseAvatar: function (e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    // 立即更新本地展示（临时路径），并走原有 updateUserInfo 云函数链路持久化
    this.setData({
      userInfo: { ...this.data.userInfo, avatarUrl: avatarUrl }
    });
    this.updateUserProfile({ avatarUrl: avatarUrl });
  },

  /**
   * 修改昵称（头像昵称填写能力）
   */
  onNicknameChange: function (e) {
    const nickName = (e.detail.value || '').trim();
    if (!nickName || nickName === this.data.userInfo.nickName) return;

    this.setData({
      userInfo: { ...this.data.userInfo, nickName: nickName }
    });
    this.updateUserProfile({ nickName: nickName });
  },

  /**
   * 更新用户头像昵称到云端
   */
  updateUserProfile: function(userInfo) {
    const openId = this.data.userInfo.openId || this.data.userInfo.openid;
    if (!openId) return;

    // 过滤微信默认信息，避免覆盖系统随机昵称
    const payload = {};
    if (userInfo.nickName && !this._isWechatDefaultNickName(userInfo.nickName)) {
      payload.nickName = userInfo.nickName;
    }
    if (!this._isWechatDefaultAvatar(userInfo.avatarUrl)) {
      payload.avatarUrl = userInfo.avatarUrl;
    }
    if (userInfo.gender !== undefined) {
      payload.gender = userInfo.gender;
    }

    // 如果没有有效字段需要更新，直接提示成功
    if (Object.keys(payload).length === 0) {
      wx.showToast({ title: '无需更新', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '更新中...' });

    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        userInfo: payload
      }
    }).then(() => {
      wx.hideLoading();
      const updated = {
        ...this.data.userInfo,
        ...payload
      };
      wx.setStorageSync('userInfo', this._sanitizeUserInfo(updated));
      this.setData({ userInfo: this._sanitizeUserInfo(updated) });
      wx.showToast({ title: '更新成功', icon: 'success' });
    }).catch((err) => {
      wx.hideLoading();
      console.error('更新用户信息失败:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  processUserLogin: function (userInfo) {
    wx.login({  
      success: (res) => {
        if (res.code) {
          userService.login(res.code, userInfo).then((loginRes) => {
            if (loginRes.success) {
              // 保存用户信息
              userService.saveUserInfo(loginRes.data.userInfo, loginRes.data.token);
              
              this.setData({
                userInfo: {
                  ...loginRes.data.userInfo,
                  babyName: '',
                  babyAge: ''
                },
                hasUserInfo: true
              });
              
              // 获取统计信息
              this.getUserStats();
            }
          }).catch(() => {
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 获取排敏进度
   */
  getSensitivityProgress: function() {
    const sensitivityService = require('../../services/sensitivityService');
    
    if (this.data.userInfo && this.data.userInfo.openId) {
      const userId = this.data.userInfo.openId;
      const babyId = this.data.userInfo.babyInfo ? this.data.userInfo.babyInfo._id : 'local-baby-id';
      
      sensitivityService.getSensitivityProgress(userId, babyId)
        .then((progress) => {
          this.setData({
            sensitivityProgress: progress
          });
        }).catch(() => {
          console.error('获取排敏进度失败');
        });
    }
  },

  /**
   * 跳转到任务列表
   */
  goToTaskList: function (e) {
    const type = e.currentTarget.dataset.type;
    let url = '/pages/task/index';
    
    switch (type) {
      case 'completed':
        // 定位到已完成标签
        url += '?tab=completed';
        break;
      case 'streak':
        // 定位到顶部（默认待办标签）
        url += '?tab=pending';
        break;
      default:
        // 总任务，显示全部
        url += '?tab=all';
    }
    
    wx.navigateTo({
      url: url
    });
  },

  /**
   * 菜单项点击处理
   */
  navigateToLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  onMenuItemTap: function (e) {
    if (this.data.isNavigating) return;
    this.setData({ isNavigating: true });

    const id = e.currentTarget.dataset.id;
    const urlMap = {
      'family': '/pages/family/index',
      'baby-info': '/subpackages/profile/pages/baby-info',
      'sensitivity-records': '/subpackages/sensitivity/pages/records',
      'privacy-policy': '/pages/privacy-policy/index',
      'user-agreement': '/pages/user-agreement/index',
      'settings': '/pages/settings/index',
      'help': '/subpackages/profile/pages/help',
      'about': '/subpackages/profile/pages/about'
    };

    if (urlMap[id]) {
      wx.navigateTo({
        url: urlMap[id],
        fail: () => {
          this.setData({ isNavigating: false });
        }
      });
    } else if (id === 'growth-records') {
      wx.showToast({ title: '成长记录功能开发中', icon: 'none' });
      this.setData({ isNavigating: false });
    } else {
      this.setData({ isNavigating: false });
    }
  },

  /**
   * 查看统计详情
   */
  viewStatsDetail: function () {
    wx.navigateTo({
      url: '/pages/statistics/index'
    });
  },

  /**
   * 退出登录
   */
  logout: function () {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 使用用户服务退出登录
          userService.logout();
          
          this.setData({
            userInfo: {
              avatarUrl: '/images/logo.png',
              nickName: '未登录',
              babyName: '',
              babyAge: ''
            },
            hasUserInfo: false,
            stats: {
              totalTasks: 0,
              completedTasks: 0,
              streakDays: 0
            }
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  },

  /**
   * 分享页面
   */
  onShareAppMessage: function () {
    return {
      title: '朵叽排敏生活全家记 - 记录宝宝成长的每一天',
      path: '/pages/index/index',
      imageUrl: '/assets/share-cover.png'
    };
  },

  /**
   * 注销账号 - 清除所有用户数据
   */
  deleteAccount: function () {
    wx.showModal({
      title: '注销账号',
      content: '注销账号将清除所有数据（包括云端和本地的宝宝信息、排敏记录、任务数据等），此操作不可恢复，确定要继续吗？',
      confirmText: '确定注销',
      confirmColor: '#ff4444',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 执行注销操作
          this.performDeleteAccount();
        }
      }
    });
  },

  /**
   * 执行账号注销
   */
  performDeleteAccount: async function () {
    const app = getApp();
    
    // 显示加载中
    wx.showLoading({
      title: '正在注销...',
      mask: true
    });
    
    try {
      // 1. 获取当前用户ID
      const userInfo = this.data.userInfo;
      const userId = userInfo && (userInfo.openId || userInfo.openid);
      
      console.log('开始注销，用户ID:', userId);
      
      // 2. 调用云函数删除云端数据
      if (userId) {
        try {
          console.log('调用云函数删除云端数据...');
          const result = await wx.cloud.callFunction({
            name: 'deleteUserData',
            data: {
              userId: userId
            }
          });
          console.log('云端数据删除结果:', result);
          // 打印详细的删除结果
          if (result.result) {
            console.log('云函数返回结果:', result.result);
            console.log('删除详情:', result.result.details);
          }
        } catch (cloudError) {
          console.warn('删除云端数据失败:', cloudError);
          // 继续执行本地清理，不中断流程
        }
      }
      
      // 3. 先获取所有存储的 key，然后全部删除
      try {
        const res = wx.getStorageInfoSync();
        console.log('当前所有存储的 keys:', res.keys);
        
        // 删除所有 key
        res.keys.forEach(key => {
          try {
            wx.removeStorageSync(key);
            console.log(`已删除: ${key}`);
          } catch (e) {
            console.warn(`删除 ${key} 失败:`, e);
          }
        });
      } catch (e) {
        console.warn('获取存储信息失败:', e);
      }
      
      // 4. 再次尝试清除所有缓存
      try {
        wx.clearStorageSync();
        console.log('clearStorageSync 执行完成');
      } catch (e) {
        console.warn('清除所有缓存失败:', e);
      }
      
      // 5. 验证是否已清空
      try {
        const checkRes = wx.getStorageInfoSync();
        console.log('清除后的 keys:', checkRes.keys);
      } catch (e) {
        console.warn('验证存储失败:', e);
      }
      
      // 6. 清除全局数据
      app.globalData.userInfo = null;
      
      wx.hideLoading();
      
      // 6. 更新页面状态
      this.setData({
        userInfo: {
          avatarUrl: '/images/logo.png',
          nickName: '未登录',
          babyName: '',
          babyAge: ''
        },
        hasUserInfo: false,
        stats: {
          totalTasks: 0,
          completedTasks: 0,
          streakDays: 0
        },
        sensitivityProgress: {
          completed: 0,
          total: 0,
          percentage: 0
        }
      });
      
      wx.showToast({
        title: '账号已注销',
        icon: 'success',
        duration: 2000
      });
      
      // 7. 延迟后跳转到登录页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);
      
    } catch (error) {
      wx.hideLoading();
      console.error('注销账号失败:', error);
      wx.showToast({
        title: '注销失败，请重试',
        icon: 'none'
      });
    }
  }
});
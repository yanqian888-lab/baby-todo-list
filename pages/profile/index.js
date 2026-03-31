// pages/profile/index.js
const userService = require('../../services/userService');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      avatarUrl: '/images/default-avatar.svg',
      nickName: '未登录',
      babyName: '',
      babyAge: ''
    },
    stats: {
      totalTasks: 42,
      completedTasks: 38,
      streakDays: 7
    },
    sensitivityProgress: {
      completed: 0,
      total: 0,
      percentage: 0
    },
    menuItems: [
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
        id: 'growth-records',
        icon: '📈',
        title: '成长记录',
        showArrow: true
      },
      {
        id: 'settings',
        icon: '⚙️',
        title: '设置',
        showArrow: true
      },
      {
        id: 'help',
        icon: '❓',
        title: '帮助与反馈',
        showArrow: true
      },
      {
        id: 'about',
        icon: 'ℹ️',
        title: '关于我们',
        showArrow: true
      }
    ],
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    // 页面加载时初始化数据
    this.initData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时刷新数据
    this.initData();
  },

  /**
   * 初始化页面数据
   */
  initData: function () {
    userService.getUserInfo().then((userInfo) => {
      this.setData({
        userInfo: userInfo,
        hasUserInfo: true
      });
      // 获取用户统计信息
      this.getUserStats();
      // 获取排敏进度
      this.getSensitivityProgress();
    }).catch(() => {
      this.setData({
        userInfo: {
          avatarUrl: '/images/default-avatar.svg',
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
   * 获取用户信息
   */
  getUserInfo: function (e) {
    if (e.detail.userInfo) {
      // 用户同意授权
      const { userInfo } = e.detail;
      // 调用登录服务
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
            });
          }
        }
      });
      
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } else {
      // 用户拒绝授权
      wx.showToast({
        title: '登录被取消',
        icon: 'none'
      });
    }
  },

  /**
   * 获取排敏进度
   */
  getSensitivityProgress: function() {
    // 引入排敏服务
    const sensitivityService = require('../../services/sensitivityService');
    
    // 检查用户是否已登录
    if (this.data.userInfo && this.data.userInfo.openId) {
      sensitivityService.getSensitivityProgress(this.data.userInfo.openId, this.data.userInfo.openId) // 这里使用openId作为babyId临时替代
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
   * 菜单项点击处理
   */
  onMenuItemTap: function (e) {
    const id = e.currentTarget.dataset.id;
    
    switch (id) {
      case 'baby-info':
        wx.navigateTo({
          url: '/pages/profile/baby-info'
        });
        break;
      case 'sensitivity-records':
        wx.navigateTo({
          url: '/pages/sensitivity/records'
        });
        break;
      case 'growth-records':
        // 成长记录页面暂时未实现，显示提示
        wx.showToast({
          title: '成长记录功能开发中',
          icon: 'none'
        });
        break;
      case 'settings':
        wx.navigateTo({
          url: '/pages/settings/index'
        });
        break;
      case 'help':
        wx.navigateTo({
          url: '/pages/profile/help'
        });
        break;
      case 'about':
        wx.navigateTo({
          url: '/pages/profile/about'
        });
        break;
      default:
        break;
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
              avatarUrl: '/images/default-avatar.svg',
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
        }
      }
    });
  },

  /**
   * 分享页面
   */
  onShareAppMessage: function () {
    return {
      title: '母婴打卡 - 记录宝宝成长的每一天',
      path: '/pages/index/index',
      imageUrl: '/assets/share-cover.png'
    };
  }
});
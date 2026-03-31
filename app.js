// 母婴打卡小程序入口文件
App({
  /**
   * 小程序初始化时执行
   */
  onLaunch: function() {
    console.log('小程序启动');
    
    try {
      // 初始化云开发环境
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前环境
        traceUser: true
      });
      
      // 初始化数据库引用
      this.globalData.db = wx.cloud.database();
      
      console.log('云开发环境初始化成功');
      
      // 不在这里检查用户登录状态，避免页面跳转冲突
      // 登录检查移到首页onLoad中处理
    } catch (error) {
      console.error('初始化失败:', error);
      wx.showToast({
        title: '初始化失败，请重试',
        icon: 'none'
      });
    }
  },
  
  /**
   * 小程序显示时执行
   */
  onShow: function() {
    console.log('小程序显示');
  },
  
  /**
   * 小程序隐藏时执行
   */
  onHide: function() {
    console.log('小程序隐藏');
  },
  
  /**
   * 检查用户登录状态
   */
  checkUserLogin: function() {
    const that = this;
    
    // 先检查本地存储
    wx.getStorage({
      key: 'userInfo',
      success: function(res) {
        if (res.data && res.data.openId) {
          that.globalData.userInfo = res.data;
          console.log('用户信息已从本地加载');
          
          // 验证token有效性（如果有）
          if (res.data.token) {
            that.verifyToken();
          }
        } else {
          console.log('本地用户信息不完整');
          that.navigateToLogin();
        }
      },
      fail: function() {
        console.log('用户未登录或本地无存储');
        that.navigateToLogin();
      }
    });
  },
  
  /**
   * 验证登录令牌
   */
  verifyToken: function() {
    const that = this;
    
    // 调用云函数验证用户身份
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        console.log('登录验证成功');
      },
      fail: err => {
        console.error('登录验证失败:', err);
        that.navigateToLogin();
      }
    });
  },
  
  /**
   * 跳转到登录页面
   */
  navigateToLogin: function() {
    // 延迟跳转，避免在页面加载过程中频繁跳转
    setTimeout(() => {
      const pages = getCurrentPages();
      // 如果当前不是登录页，才进行跳转
      if (pages.length === 0 || pages[pages.length - 1].route !== 'pages/login/login') {
        // 使用redirectTo而不是navigateTo，避免首次打开时pages.length为0导致的跳转失败
        wx.redirectTo({
          url: '/pages/login/login'
        });
      }
    }, 500);
  },
  
  /**
   * 更新全局用户信息
   * @param {Object} userInfo - 用户信息对象
   */
  updateUserInfo: function(userInfo) {
    // 确保userInfo存在且有必要的字段
    if (userInfo && userInfo.nickName && userInfo.avatarUrl) {
      this.globalData.userInfo = userInfo;
      // 使用同步方法保存，确保立即生效
      wx.setStorageSync('userInfo', userInfo);
      console.log('全局用户信息更新成功:', userInfo);
    } else {
      console.error('更新用户信息失败: 用户信息不完整', userInfo);
    }
  },
  
  /**
   * 全局数据
   */
  globalData: {
    userInfo: null,
    appName: '母婴打卡',
    themeColor: '#FF7A85',
    db: null, // 数据库引用
    lastSyncTime: null, // 上次同步时间
    networkStatus: true // 网络状态
  }
});

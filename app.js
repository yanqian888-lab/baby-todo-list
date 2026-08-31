// 朵叽排敏生活全家记小程序入口文件
App({
  /**
   * 小程序初始化时执行
   */
  onLaunch: function() {
    console.log('小程序启动');
    // 隐私授权交由微信原生弹窗处理（app.json 已开启 __usePrivacyCheck__）
    // 不再自定义 wx.onNeedPrivacyAuthorization，避免 resolve 回调与 wx.showModal 冲突

    try {
      // 初始化云开发环境
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前环境
        traceUser: true
      });
      
      // 初始化数据库引用
      this.globalData.db = wx.cloud.database();
      
      console.log('云开发环境初始化成功');
      
      // 监听云开发错误
      this.checkCloudStatus();
      
      // 初始化/清理排敏食材数据（确保云端和本地与最新Excel一致）
      this.initSensitivityData();
      
    } catch (error) {
      console.error('云开发初始化失败:', error);
      this.showCloudError('云开发初始化失败，请检查网络或重新登录开发者工具');
    }
  },

  /**
   * 全局未处理异常捕获（定位线上/调试期的隐藏报错来源）
   */
  onUnhandledRejection: function(res) {
    const reason = res && res.reason;
    console.error('[全局] 未处理的 Promise 拒绝:', reason && (reason.stack || reason.errMsg || reason.message || JSON.stringify(reason)));
  },

  onError: function(err) {
    console.error('[全局] 页面错误:', err);
  },

  /**
   * 检查云开发状态
   */
  checkCloudStatus: function() {
    // 有登录凭证时才检查，避免未登录时产生无效云函数调用
    const token = wx.getStorageSync('token');
    if (!token) {
      console.log('⏸️ 跳过云开发连接检查（未登录）');
      return;
    }
    // 延迟检查，等待云开发初始化完成
    setTimeout(() => {
      wx.cloud.callFunction({
        name: 'login',
        data: {}
      }).then(res => {
        console.log('✅ 云开发连接正常');
      }).catch(err => {
        if (err.errMsg && err.errMsg.includes('access_token')) {
          console.error('❌ 开发者工具登录状态失效');
          this.showCloudError('开发者工具登录状态失效，请重新扫码登录');
        }
      });
    }, 1000);
  },
  
  /**
   * 显示云开发错误提示
   */
  showCloudError: function(msg) {
    wx.showModal({
      title: '连接错误',
      content: msg + '\n\n解决方案:\n1. 关闭开发者工具重新打开\n2. 用微信重新扫码登录\n3. 确保是当前小程序的管理员',
      showCancel: false,
      confirmText: '我知道了'
    });
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
   * 初始化排敏食材数据：版本变更时触发云端食材字典重导（仅管理员可成功执行），
   * 只清理本地食材字典缓存，不触碰用户的排敏记录
   */
  initSensitivityData: function() {
    const CURRENT_VERSION = '1.3.72';
    const storedVersion = wx.getStorageSync('sensitivityDataVersion');
    
    if (storedVersion === CURRENT_VERSION) {
      console.log('✅ 排敏食材数据已是最新版本，跳过初始化');
      return;
    }
    
    console.log('🔄 检测到排敏食材数据需要更新，开始清理旧字典缓存...');
    
    // 1. 清空本地食材字典缓存（不清 stores.sensitivityRecords，那是用户的排敏记录）
    try {
      wx.removeStorageSync('sensitivity_foods');
      wx.removeStorageSync('sensitivityFoodsCache');
      // 清理默认 babyInfo 中的 safeFoodsList
      const defaultBabyInfo = wx.getStorageSync('babyInfo') || {};
      if (defaultBabyInfo.safeFoodsList) {
        defaultBabyInfo.safeFoodsList = [];
        defaultBabyInfo.safeFoods = '';
        wx.setStorageSync('babyInfo', defaultBabyInfo);
      }
      // 清理按家庭隔离的 babyInfo 中的 safeFoodsList
      const keys = wx.getStorageInfoSync().keys || [];
      keys.forEach(key => {
        if (key.startsWith('babyInfo_')) {
          const info = wx.getStorageSync(key) || {};
          if (info.safeFoodsList) {
            info.safeFoodsList = [];
            info.safeFoods = '';
            wx.setStorageSync(key, info);
          }
        }
      });
      console.log('✅ 本地食材字典缓存已清理');
    } catch (e) {
      console.error('清理本地旧数据失败:', e);
    }
    
    // 2. 调用云函数重导食材字典
    // 无论成功失败（含无权限）都记录版本号，避免每次启动都重复调用
    wx.cloud.callFunction({
      name: 'initSensitivityFoods',
      data: {}
    }).then(res => {
      console.log('✅ 云端排敏食材初始化结果:', res.result);
      wx.setStorageSync('sensitivityDataVersion', CURRENT_VERSION);
      console.log('✅ 排敏食材数据版本已更新为', CURRENT_VERSION);
      if (!res.result || !res.result.success) {
        console.error('❌ 食材字典重导未成功（需管理员在云函数环境变量 ADMIN_OPENIDS 中配置管理员 openid 后才会执行重导），本次跳过');
      }
    }).catch(err => {
      console.error('❌ 云端排敏食材初始化失败:', err);
      wx.setStorageSync('sensitivityDataVersion', CURRENT_VERSION);
    });
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
    appName: '朵叽排敏生活全家记',
    themeColor: '#FF7A85',
    db: null, // 数据库引用
    lastSyncTime: null, // 上次同步时间
    networkStatus: true // 网络状态
  }
});

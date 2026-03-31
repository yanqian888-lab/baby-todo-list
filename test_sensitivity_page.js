// 测试排敏页面的显示逻辑
// 模拟微信小程序环境
const fs = require('fs');
const path = require('path');

// 模拟微信API
global.wx = {
  cloud: {
    database: () => ({
      collection: () => ({
        where: () => ({
          get: async () => ({
            data: []
          })
        })
      })
    }),
    DYNAMIC_CURRENT_ENV: 'test-env'
  },
  showToast: (options) => {
    console.log('showToast:', options);
  },
  showModal: (options) => {
    console.log('showModal:', options);
  },
  navigateTo: (options) => {
    console.log('navigateTo:', options);
  },
  getStorage: (options) => {
    options.fail();
  },
  setStorageSync: (key, value) => {
    console.log('setStorageSync:', key, value);
  }
};

// 模拟getCurrentPages
global.getCurrentPages = () => [];

// 模拟App对象
global.App = (config) => {
  global.appConfig = config;
  return {
    globalData: {
      userInfo: {
        openId: 'test-user-id',
        nickName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    },
    onLaunch: config.onLaunch,
    checkUserLogin: config.checkUserLogin
  };
};

// 模拟Page对象
global.Page = (config) => {
  global.pageConfig = config;
  return config;
};

// 模拟getApp
global.getApp = () => ({
  globalData: {
    userInfo: {
      openId: 'test-user-id',
      nickName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg'
    }
  }
});

// 导入sensitivityService
const sensitivityService = require('./services/sensitivityService');

// 导入app.js
require('./app.js');

// 导入排敏页面
require('./pages/sensitivity/index.js');

// 测试页面加载
console.log('测试页面加载...');
try {
  // 测试onLoad
  global.pageConfig.onLoad({});
  console.log('✅ onLoad函数执行成功');
  
  // 测试checkBabyInfo
  global.pageConfig.checkBabyInfo().then(() => {
    console.log('✅ checkBabyInfo函数执行成功');
    
    // 测试getRecommendedFoods
    return global.pageConfig.getRecommendedFoods();
  }).then(() => {
    console.log('✅ getRecommendedFoods函数执行成功');
    
    // 测试getSensitivityProgress
    return global.pageConfig.getSensitivityProgress();
  }).then(() => {
    console.log('✅ getSensitivityProgress函数执行成功');
    console.log('\n🎉 所有测试通过！排敏页面应该能正常显示了！');
  }).catch((error) => {
    console.error('❌ 测试失败:', error);
  });
} catch (error) {
  console.error('❌ 页面加载失败:', error);
}
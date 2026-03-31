// 测试用户头像和昵称获取逻辑
const app = getApp();
const userService = require('./services/userService.js');

console.log('=== 测试用户信息获取逻辑 ===');

// 测试1: 获取全局用户信息
console.log('\n测试1: 获取全局用户信息');
if (app.globalData.userInfo) {
  console.log('✅ 全局用户信息:', app.globalData.userInfo);
} else {
  console.log('❌ 全局用户信息为空');
}

// 测试2: 从本地存储获取用户信息
console.log('\n测试2: 从本地存储获取用户信息');
try {
  const userInfo = wx.getStorageSync('userInfo');
  if (userInfo) {
    console.log('✅ 本地存储用户信息:', userInfo);
  } else {
    console.log('❌ 本地存储用户信息为空');
  }
} catch (error) {
  console.error('❌ 获取本地存储失败:', error);
}

// 测试3: 调用userService.getUserInfo
console.log('\n测试3: 调用userService.getUserInfo');
userService.getUserInfo()
  .then(userInfo => {
    console.log('✅ userService.getUserInfo成功:', userInfo);
  })
  .catch(error => {
    console.log('❌ userService.getUserInfo失败:', error.message);
  });

console.log('\n=== 测试完成 ===');
// 测试getUserStats方法的修复 - 使用模拟wx对象
// 模拟wx对象
const wx = {
  getStorageSync: () => null, // 返回null模拟未登录状态
  cloud: {
    callFunction: () => Promise.reject(new Error('模拟云函数调用失败'))
  }
};

// 将wx对象添加到全局
global.wx = wx;

// 引入userService
const userService = require('./services/userService');

console.log('=== 测试getUserStats方法的修复 - 模拟wx对象 ===\n');

// 测试1: 未登录状态
console.log('测试1: 未登录状态');
userService.getUserStats().then(res => {
  console.log('✅ getUserStats调用成功');
  console.log('返回结果:', res);
  if (res.success && res.data.totalTasks === 42) {
    console.log('✅ 未登录状态返回了正确的模拟数据');
  } else {
    console.log('❌ 未登录状态返回的数据不正确');
  }
  
  // 测试2: 登录但云函数调用失败
  console.log('\n测试2: 登录但云函数调用失败');
  // 修改wx对象模拟登录但云函数调用失败
  wx.getStorageSync = (key) => key === 'token' ? 'mock_token' : null;
  
  userService.getUserStats().then(res => {
    console.log('✅ getUserStats调用成功');
    console.log('返回结果:', res);
    if (res.success && res.data.totalTasks === 42) {
      console.log('✅ 云函数调用失败时返回了正确的模拟数据');
    } else {
      console.log('❌ 云函数调用失败时返回的数据不正确');
    }
    
    console.log('\n=== 修复验证完成 ===');
  }).catch(err => {
    console.error('❌ getUserStats调用失败:', err);
    console.log('\n=== 修复验证完成 ===');
  });
}).catch(err => {
  console.error('❌ getUserStats调用失败:', err);
  console.log('\n=== 修复验证完成 ===');
});
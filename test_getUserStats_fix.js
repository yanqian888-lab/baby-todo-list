// 测试getUserStats方法的修复
const userService = require('./services/userService');

console.log('=== 测试getUserStats方法的修复 ===\n');

// 调用getUserStats方法
try {
  userService.getUserStats().then(res => {
    console.log('✅ getUserStats调用成功');
    console.log('返回结果:', res);
    console.log('\n=== 修复验证完成 ===');
  }).catch(err => {
    console.error('❌ getUserStats调用失败:', err);
    console.log('\n=== 修复验证完成 ===');
  });
} catch (err) {
  console.error('❌ 调用过程中发生错误:', err);
  console.log('\n=== 修复验证完成 ===');
}
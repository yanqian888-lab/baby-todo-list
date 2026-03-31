// 直接测试userService的用户信息处理逻辑
const userService = require('./services/userService.js');

console.log('=== 测试userService用户信息处理逻辑 ===\n');

// 测试1: 测试login方法
console.log('测试1: login方法');
const mockCode = 'test_code_123';
const mockUserInfo = {
  nickName: '测试用户',
  avatarUrl: 'https://example.com/avatar.jpg',
  gender: 1
};

userService.login(mockCode, mockUserInfo)
  .then(result => {
    console.log('✅ login成功:', result);
  })
  .catch(error => {
    console.log('❌ login失败:', error);
  });

// 测试2: 测试getUserInfo方法
console.log('\n测试2: getUserInfo方法');
userService.getUserInfo()
  .then(userInfo => {
    console.log('✅ getUserInfo成功:', userInfo);
  })
  .catch(error => {
    console.log('❌ getUserInfo失败:', error);
  });

// 测试3: 测试saveUserInfo方法
console.log('\n测试3: saveUserInfo方法');
const newUserInfo = {
  nickName: '新测试用户',
  avatarUrl: 'https://example.com/new-avatar.jpg',
  gender: 0
};

userService.saveUserInfo(newUserInfo)
  .then(result => {
    console.log('✅ saveUserInfo成功:', result);
    // 保存后再次获取
    return userService.getUserInfo();
  })
  .then(updatedUserInfo => {
    console.log('✅ 保存后获取用户信息:', updatedUserInfo);
  })
  .catch(error => {
    console.log('❌ saveUserInfo或获取更新后信息失败:', error);
  });

console.log('\n=== 测试完成 ===');
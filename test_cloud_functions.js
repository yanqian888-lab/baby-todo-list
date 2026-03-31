// 测试脚本：检查云函数返回结果
// 可以在小程序的开发者工具中直接执行这段代码

// 测试getTasks云函数（获取已完成任务）
console.log('🔍 测试getTasks云函数（已完成任务）...');
wx.cloud.callFunction({
  name: 'getTasks',
  data: {
    status: 'completed'
  }
}).then(res => {
  console.log('✅ getTasks云函数返回结果:', res);
  if (res.result && res.result.success) {
    console.log('📋 已完成任务数量:', res.result.tasks.length);
    console.log('📋 已完成任务列表:', JSON.stringify(res.result.tasks, null, 2));
  } else {
    console.error('❌ getTasks云函数执行失败:', res.result);
  }
}).catch(error => {
  console.error('❌ 调用getTasks云函数失败:', error);
});

// 测试getUserStatistics云函数
console.log('🔍 测试getUserStatistics云函数...');
wx.cloud.callFunction({
  name: 'getUserStatistics'
}).then(res => {
  console.log('✅ getUserStatistics云函数返回结果:', res);
  if (res.result && res.result.success) {
    console.log('📋 用户统计信息:', JSON.stringify(res.result.data, null, 2));
  } else {
    console.error('❌ getUserStatistics云函数执行失败:', res.result);
  }
}).catch(error => {
  console.error('❌ 调用getUserStatistics云函数失败:', error);
});
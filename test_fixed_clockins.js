// 测试脚本：验证修复后的getTaskClockIns云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

async function testGetTaskClockIns() {
  console.log('=== 开始测试getTaskClockIns云函数 ===');
  
  try {
    // 调用云函数
    const result = await cloud.callFunction({
      name: 'getTaskClockIns',
      data: {
        taskId: '你的测试任务ID', // 请替换为实际的任务ID
        todayOnly: true
      }
    });
    
    console.log('✅ 云函数调用成功');
    console.log('返回结果:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ 云函数调用失败:', error);
    return error;
  }
}

// 执行测试
getTaskClockIns();
// 测试getTasks云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec'
});

// 调用云函数测试
async function testGetTasks() {
  try {
    console.log('开始测试getTasks云函数...');
    
    // 调用云函数
    const result = await cloud.callFunction({
      name: 'getTasks',
      data: {
        type: 'week'
      }
    });
    
    console.log('云函数调用成功！');
    console.log('返回结果:', JSON.stringify(result, null, 2));
    
    // 分析结果
    if (result.result.success) {
      console.log('✅ 云函数执行成功');
      console.log(`✅ 任务总数: ${result.result.total}`);
      console.log(`✅ 任务列表:`, result.result.tasks);
    } else {
      console.log('❌ 云函数执行失败:', result.result.errMsg);
    }
    
  } catch (error) {
    console.error('❌ 调用云函数失败:', error);
  }
}

// 执行测试
testGetTasks();
// 测试打卡流程的调试脚本
const cloud = require('wx-server-sdk');
cloud.init();

async function testClockInFlow() {
  console.log('=== 开始测试打卡流程 ===');
  
  try {
    const db = cloud.database();
    const openid = 'test_openid'; // 替换为实际的openid
    const taskId = 'test_task_id'; // 替换为实际的任务ID
    
    // 1. 测试创建打卡记录
    console.log('1. 测试创建打卡记录...');
    const createResult = await db.collection('task_clock_ins').add({
      data: {
        _openid: openid,
        taskId: taskId,
        checkinTime: new Date(),
        checkinCount: 1,
        cycleTimes: 3,
        taskName: '测试任务',
        createTime: new Date()
      }
    });
    console.log('创建打卡记录结果:', createResult);
    
    // 2. 测试查询打卡记录
    console.log('2. 测试查询打卡记录...');
    const queryResult = await db.collection('task_clock_ins')
      .where({
        _openid: openid,
        taskId: taskId
      })
      .orderBy('checkinTime', 'desc')
      .get();
    console.log('查询打卡记录结果:', queryResult);
    
    // 3. 测试获取今日打卡次数
    console.log('3. 测试获取今日打卡次数...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayResult = await db.collection('task_clock_ins')
      .where({
        _openid: openid,
        taskId: taskId,
        checkinTime: db.command.gte(today).lt(tomorrow)
      })
      .orderBy('checkinTime', 'desc')
      .get();
    
    console.log('今日打卡记录:', todayResult.data);
    
    let todayCount = 0;
    if (todayResult.data.length > 0) {
      todayCount = todayResult.data[0].checkinCount || 0;
    }
    console.log('今日打卡次数:', todayCount);
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testClockInFlow();
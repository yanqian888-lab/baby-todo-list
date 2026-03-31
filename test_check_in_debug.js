// 打卡功能调试脚本
// 用于排查打卡次数显示为0的问题
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 模拟测试数据
const testData = {
  taskId: '', // 将在测试时填入实际任务ID
  openid: '', // 将在测试时填入实际用户openid
  checkins: 1,
  cycleTimes: 5
};

async function testCheckInFlow() {
  console.log('=== 开始测试打卡功能流程 ===');
  
  try {
    // 步骤1: 检查是否有任务数据
    console.log('\n1. 检查任务数据...');
    const tasks = await db.collection('tasks')
      .where({
        status: _.neq('deleted'),
        isTemplate: false
      })
      .limit(1)
      .get();
    
    if (tasks.data.length === 0) {
      console.log('❌ 没有找到任务数据');
      return;
    }
    
    const task = tasks.data[0];
    testData.taskId = task._id;
    testData.openid = task._openid;
    
    console.log('✅ 找到任务:', {
      id: task._id,
      title: task.title,
      openid: task._openid,
      cycleTimes: task.cycleTimes || 1,
      checkins: task.checkins || 0
    });
    
    // 步骤2: 测试打卡记录是否正确保存
    console.log('\n2. 测试打卡记录保存...');
    const clockInResult = await db.collection('task_clock_ins').add({
      data: {
        _openid: testData.openid,
        taskId: testData.taskId,
        checkinTime: db.serverDate(),
        checkinCount: testData.checkins,
        cycleTimes: testData.cycleTimes,
        taskName: task.title,
        createTime: db.serverDate()
      }
    });
    
    console.log('✅ 打卡记录保存成功:', clockInResult._id);
    
    // 步骤3: 测试打卡记录查询
    console.log('\n3. 测试打卡记录查询...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const queryResult = await db.collection('task_clock_ins')
      .where({
        _openid: testData.openid,
        taskId: testData.taskId,
        checkinTime: _.gte(today).lt(tomorrow)
      })
      .orderBy('checkinTime', 'desc')
      .get();
    
    console.log('✅ 打卡记录查询结果:', queryResult.data.length, '条记录');
    if (queryResult.data.length > 0) {
      console.log('   最新打卡记录:', {
        id: queryResult.data[0]._id,
        checkinCount: queryResult.data[0].checkinCount,
        checkinTime: queryResult.data[0].checkinTime
      });
    }
    
    // 步骤4: 测试getTaskClockIns云函数逻辑
    console.log('\n4. 测试getTaskClockIns云函数逻辑...');
    let todayCount = 0;
    if (queryResult.data.length > 0) {
      todayCount = queryResult.data[0].checkinCount || 0;
    }
    
    console.log('✅ 今日打卡次数:', todayCount);
    
    // 步骤5: 测试前端显示逻辑
    console.log('\n5. 测试前端显示逻辑...');
    console.log('   任务标题:', task.title);
    console.log('   总循环次数:', task.cycleTimes || 1);
    console.log('   今日打卡次数:', todayCount);
    console.log('   显示格式:', `(${todayCount}/${task.cycleTimes || 1})次`);
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 执行测试
testCheckInFlow();
// 打卡功能测试脚本
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const taskClockIns = db.collection('task_clock_ins');

/**
 * 测试今日打卡次数查询功能
 */
async function testTodayClockInsCount() {
  console.log('开始测试今日打卡次数查询...');
  
  try {
    // 获取当前日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 查询今日打卡记录
    const result = await taskClockIns.where({
      checkinTime: db.command.gte(today.toISOString()),
      // _openid: 'test_openid' // 可以根据需要添加openid筛选
    }).get();
    
    console.log('今日打卡记录:', result.data);
    console.log('今日打卡次数:', result.data.length);
    
    return result.data.length;
  } catch (error) {
    console.error('测试今日打卡次数查询失败:', error);
    return 0;
  }
}

/**
 * 测试打卡记录保存功能
 */
async function testSaveClockInRecord(taskId, checkinCount, cycleTimes) {
  console.log('开始测试打卡记录保存功能...');
  
  try {
    const result = await taskClockIns.add({
      data: {
        taskId: taskId,
        checkinTime: new Date().toISOString(),
        checkinCount: checkinCount,
        cycleTimes: cycleTimes
      }
    });
    
    console.log('打卡记录保存成功:', result);
    return result._id;
  } catch (error) {
    console.error('测试打卡记录保存失败:', error);
    return null;
  }
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('开始运行打卡功能测试...');
  
  // 测试1: 保存打卡记录
  const taskId = 'test_task_id_' + Date.now();
  const checkinId = await testSaveClockInRecord(taskId, 1, 3);
  
  if (checkinId) {
    // 测试2: 查询今日打卡次数
    const todayCount = await testTodayClockInsCount();
    console.log('今日打卡次数测试结果:', todayCount);
  }
  
  console.log('所有测试完成!');
}

// 运行测试
runTests().catch(console.error);
// 查询打卡记录脚本
// 在云函数环境中运行
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function queryClockIns() {
  console.log('=== 开始查询打卡记录 ===');
  
  try {
    // 1. 查询任务数据
    console.log('\n1. 查询任务数据...');
    const tasks = await db.collection('tasks')
      .where({
        status: _.neq('deleted'),
        isTemplate: false
      })
      .limit(5)
      .get();
    
    if (tasks.data.length === 0) {
      console.log('❌ 没有找到任务数据');
      return;
    }
    
    console.log(`✅ 找到 ${tasks.data.length} 个任务`);
    tasks.data.forEach((task, index) => {
      console.log(`${index + 1}. 任务: ${task.title} (${task._id})`);
      console.log(`   OpenID: ${task._openid}`);
      console.log(`   循环次数: ${task.cycleTimes || 1}`);
      console.log(`   打卡次数: ${task.checkins || 0}`);
    });
    
    // 2. 查询打卡记录
    console.log('\n2. 查询打卡记录...');
    const clockIns = await db.collection('task_completions')
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get();
    
    console.log(`✅ 找到 ${clockIns.data.length} 条打卡记录`);
    clockIns.data.forEach((clockIn, index) => {
      console.log(`${index + 1}. 打卡记录:`);
      console.log(`   任务ID: ${clockIn.taskId}`);
      console.log(`   用户ID: ${clockIn._openid}`);
      console.log(`   打卡时间: ${clockIn.completedAt}`);
      console.log(`   打卡次数: ${clockIn.checkinCount || 0}`);
      console.log(`   循环次数: ${clockIn.cycleTimes || 1}`);
    });
    
    // 3. 查询今日打卡记录
    console.log('\n3. 查询今日打卡记录...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayClockIns = await db.collection('task_completions')
      .where({
        completedAt: _.gte(today).lt(tomorrow)
      })
      .orderBy('completedAt', 'desc')
      .get();
    
    console.log(`✅ 今日打卡记录: ${todayClockIns.data.length} 条`);
    todayClockIns.data.forEach((clockIn, index) => {
      console.log(`${index + 1}. 今日打卡:`);
      console.log(`   任务ID: ${clockIn.taskId}`);
      console.log(`   打卡次数: ${clockIn.checkinCount || 0}`);
    });
    
  } catch (error) {
    console.error('❌ 查询过程中发生错误:', error);
  }
}

// 执行查询
queryClockIns();
// 数据库查询脚本，直接连接到云数据库并查询数据
const cloud = require('wx-server-sdk');

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库实例
const db = cloud.database();

// 查询已完成任务
async function query_completed_tasks() {
  console.log('=== 查询已完成任务 ===');
  
  try {
    // 查询所有已完成任务
    const tasksQuery = await db.collection('tasks')
      .where({
        status: 'completed'
      })
      .get();
    
    const completedTasks = tasksQuery.data || [];
    
    console.log('已完成任务总数:', completedTasks.length);
    console.log('已完成任务列表:', JSON.stringify(completedTasks, null, 2));
    
    return completedTasks;
  } catch (error) {
    console.error('查询已完成任务失败:', error);
    return [];
  }
}

// 查询所有任务
async function query_all_tasks() {
  console.log('\n=== 查询所有任务 ===');
  
  try {
    // 查询所有任务
    const tasksQuery = await db.collection('tasks')
      .get();
    
    const allTasks = tasksQuery.data || [];
    
    console.log('所有任务总数:', allTasks.length);
    
    // 按状态分类
    const pendingTasks = allTasks.filter(task => task.status === 'pending');
    const completedTasks = allTasks.filter(task => task.status === 'completed');
    
    console.log('待完成任务数:', pendingTasks.length);
    console.log('已完成任务数:', completedTasks.length);
    
    return allTasks;
  } catch (error) {
    console.error('查询所有任务失败:', error);
    return [];
  }
}

// 查询打卡记录
async function query_checkins() {
  console.log('\n=== 查询打卡记录 ===');
  
  try {
    // 查询所有打卡记录
    const checkinsQuery = await db.collection('taskClockIns')
      .orderBy('date', 'desc')
      .get();
    
    const allCheckins = checkinsQuery.data || [];
    
    console.log('打卡记录总数:', allCheckins.length);
    console.log('打卡记录列表:', JSON.stringify(allCheckins, null, 2));
    
    // 按用户分组统计打卡天数
    const userCheckins = {};
    allCheckins.forEach(checkin => {
      if (!userCheckins[checkin.userId]) {
        userCheckins[checkin.userId] = [];
      }
      userCheckins[checkin.userId].push(checkin);
    });
    
    console.log('\n按用户分组的打卡记录:');
    Object.keys(userCheckins).forEach(userId => {
      console.log(`用户 ${userId} 的打卡天数:`, userCheckins[userId].length);
      console.log(`用户 ${userId} 的打卡日期:`, userCheckins[userId].map(c => c.date).join(', '));
    });
    
    return allCheckins;
  } catch (error) {
    console.error('查询打卡记录失败:', error);
    return [];
  }
}

// 查询用户信息
async function query_users() {
  console.log('\n=== 查询用户信息 ===');
  
  try {
    // 查询所有用户
    const usersQuery = await db.collection('users')
      .get();
    
    const allUsers = usersQuery.data || [];
    
    console.log('用户总数:', allUsers.length);
    console.log('用户列表:', JSON.stringify(allUsers, null, 2));
    
    // 显示每个用户的统计信息
    console.log('\n用户统计信息:');
    allUsers.forEach(user => {
      if (user.statistics) {
        console.log(`用户 ${user.openid} 的连续打卡天数:`, user.statistics.streakDays);
        console.log(`用户 ${user.openid} 的总打卡天数:`, user.statistics.totalDays);
      } else {
        console.log(`用户 ${user.openid} 没有统计信息`);
      }
    });
    
    return allUsers;
  } catch (error) {
    console.error('查询用户信息失败:', error);
    return [];
  }
}

// 运行所有查询
async function run_all_queries() {
  console.log('开始运行数据库查询...');
  
  // 查询所有任务
  const allTasks = await query_all_tasks();
  
  // 查询已完成任务
  const completedTasks = await query_completed_tasks();
  
  // 查询打卡记录
  const allCheckins = await query_checkins();
  
  // 查询用户信息
  const allUsers = await query_users();
  
  console.log('\n查询完成!');
  
  // 分析结果
  console.log('\n=== 数据分析结果 ===');
  console.log('1. 数据库中共有任务:', allTasks.length);
  console.log('2. 数据库中已完成任务:', allTasks.filter(task => task.status === 'completed').length);
  console.log('3. 数据库中待完成任务:', allTasks.filter(task => task.status === 'pending').length);
  console.log('4. 数据库中打卡记录总数:', allCheckins.length);
  console.log('5. 数据库中用户总数:', allUsers.length);
  
  // 检查用户统计信息
  allUsers.forEach(user => {
    if (user.statistics) {
      console.log(`6. 用户 ${user.openid} 的连续打卡天数:`, user.statistics.streakDays);
      console.log(`7. 用户 ${user.openid} 的总打卡天数:`, user.statistics.totalDays);
    }
  });
}

// 执行查询
run_all_queries();
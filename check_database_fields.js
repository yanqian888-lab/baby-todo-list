// 检查数据库中实际的字段名
const cloud = require('wx-server-sdk');

// 模拟云函数环境
cloud.init({
  env: 'your-env-id', // 请替换为你的环境ID
  traceUser: true
});

const db = cloud.database();

async function checkDatabaseFields() {
  try {
    console.log('🔍 开始检查数据库字段...');
    
    // 检查tasks集合的字段
    console.log('📋 检查tasks集合的字段:');
    const tasks = await db.collection('tasks').limit(5).get();
    if (tasks.data.length > 0) {
      console.log('✅ 成功获取tasks集合数据');
      console.log('📝 第一条任务的字段:', Object.keys(tasks.data[0]));
      console.log('📋 任务数据示例:', JSON.stringify(tasks.data[0], null, 2));
    } else {
      console.log('⚠️ tasks集合中没有数据');
    }
    
    // 检查task_completions集合的字段
    console.log('\n📋 检查task_completions集合的字段:');
    const taskCompletions = await db.collection('task_completions').limit(5).get();
    if (taskCompletions.data.length > 0) {
      console.log('✅ 成功获取task_completions集合数据');
      console.log('📝 第一条打卡记录的字段:', Object.keys(taskCompletions.data[0]));
      console.log('📋 打卡记录示例:', JSON.stringify(taskCompletions.data[0], null, 2));
    } else {
      console.log('⚠️ task_completions集合中没有数据');
    }
    
    // 检查users集合的字段
    console.log('\n📋 检查users集合的字段:');
    const users = await db.collection('users').limit(5).get();
    if (users.data.length > 0) {
      console.log('✅ 成功获取users集合数据');
      console.log('📝 第一条用户记录的字段:', Object.keys(users.data[0]));
      console.log('📋 用户记录示例:', JSON.stringify(users.data[0], null, 2));
    } else {
      console.log('⚠️ users集合中没有数据');
    }
    
  } catch (error) {
    console.error('❌ 检查数据库字段时出错:', error);
  }
}

// 执行检查
checkDatabaseFields();
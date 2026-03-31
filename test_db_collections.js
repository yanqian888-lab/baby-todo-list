// 测试脚本：直接检查task_completions集合是否存在
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function checkCollections() {
  console.log('=== 开始检查数据库集合 ===');
  
  try {
    // 检查task_completions集合
    console.log('\n1. 检查task_completions集合...');
    const taskCompletionsResult = await db.collection('task_completions').count();
    console.log('✅ task_completions集合存在，文档数量:', taskCompletionsResult.total);
    
    // 获取一些样本数据
    if (taskCompletionsResult.total > 0) {
      console.log('\n2. 获取task_completions集合样本数据...');
      const sampleResult = await db.collection('task_completions').limit(2).get();
      console.log('✅ 样本数据:', JSON.stringify(sampleResult.data, null, 2));
    }
    
    // 检查tasks集合是否存在
    console.log('\n3. 检查tasks集合...');
    const tasksResult = await db.collection('tasks').count();
    console.log('✅ tasks集合存在，文档数量:', tasksResult.total);
    
    return {
      success: true,
      taskCompletionsCount: taskCompletionsResult.total,
      tasksCount: tasksResult.total
    };
  } catch (error) {
    console.error('❌ 集合检查失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
checkCollections();
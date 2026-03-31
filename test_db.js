// 测试数据库连接和集合是否存在
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec'
});

const db = cloud.database();

async function testDatabaseConnection() {
  console.log('开始测试数据库连接...');
  
  try {
    // 测试tasks集合是否存在
    console.log('测试tasks集合...');
    const tasksResult = await db.collection('tasks').limit(1).get();
    console.log('✅ tasks集合存在，查询结果:', tasksResult);
    
    // 测试task_clock_ins集合是否存在
    console.log('测试task_clock_ins集合...');
    const clockInsResult = await db.collection('task_clock_ins').limit(1).get();
    console.log('✅ task_clock_ins集合存在，查询结果:', clockInsResult);
    
    console.log('🎉 所有数据库测试通过！');
    return true;
  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    
    // 尝试列出所有集合
    try {
      console.log('尝试列出所有集合...');
      const collectionsResult = await db.collection('tasks').where({}).get();
      console.log('列出集合结果:', collectionsResult);
    } catch (listError) {
      console.error('列出集合失败:', listError);
    }
    
    return false;
  }
}

testDatabaseConnection();
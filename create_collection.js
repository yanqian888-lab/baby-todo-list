// 创建task_completions集合的脚本
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 创建task_completions集合
 * 如果集合已存在则不操作，如果不存在则通过创建测试文档的方式隐式创建
 */
async function createTaskCompletionsCollection() {
  console.log('=== 开始创建task_completions集合 ===');
  
  try {
    // 检查集合是否已存在
    console.log('1. 检查task_completions集合是否存在...');
    const countResult = await db.collection('task_completions').count();
    console.log(`✅ task_completions集合已存在，文档数量: ${countResult.total}`);
    return {
      success: true,
      exists: true,
      message: 'task_completions集合已存在'
    };
  } catch (error) {
    if (error.errCode === -502005) {
      // 集合不存在，需要创建
      console.log('2. task_completions集合不存在，开始创建...');
      
      try {
        // 通过创建一个测试文档来隐式创建集合
        const testDocId = `test_${Date.now()}`;
        await db.collection('task_completions').doc(testDocId).set({
          data: {
            test: true,
            createdAt: db.serverDate(),
            taskId: 'test_task_id',
            completedAt: db.serverDate(),
            userId: 'test_user_id'
          }
        });
        
        console.log('3. 测试文档创建成功，集合已隐式创建');
        
        // 删除测试文档
        await db.collection('task_completions').doc(testDocId).remove();
        console.log('4. 已删除测试文档');
        
        console.log('✅ task_completions集合创建成功');
        return {
          success: true,
          exists: false,
          created: true,
          message: 'task_completions集合创建成功'
        };
      } catch (createError) {
        console.error(`❌ 创建集合失败: ${createError.message}`);
        return {
          success: false,
          error: createError.message,
          message: '创建task_completions集合失败'
        };
      }
    } else {
      console.error(`❌ 检查集合时发生未知错误: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: '检查task_completions集合时发生未知错误'
      };
    }
  }
}

// 执行创建函数
createTaskCompletionsCollection()
  .then(result => {
    console.log('\n=== 创建结果 ===');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n❌ 执行失败:', error);
  });
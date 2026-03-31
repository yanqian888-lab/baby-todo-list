// 测试脚本：检查并创建task_completions集合
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function checkAndCreateCollection() {
  console.log('=== 检查并创建task_completions集合 ===');
  
  try {
    // 尝试查询集合文档数，验证集合是否存在
    console.log('1. 检查task_completions集合是否存在...');
    const result = await db.collection('task_completions').count();
    console.log('✅ task_completions集合存在，文档数量:', result.total);
    
    // 获取一些样本数据
    if (result.total > 0) {
      console.log('2. 获取task_completions集合样本数据...');
      const sample = await db.collection('task_completions').limit(3).get();
      console.log('✅ 样本数据:', JSON.stringify(sample.data, null, 2));
    }
    
    return {
      success: true,
      message: 'task_completions集合已存在',
      count: result.total
    };
  } catch (error) {
    console.error('❌ 检查集合时出错:', error);
    
    // 如果错误是集合不存在，尝试创建集合
    if (error.errCode === -502005 || error.message.includes('集合不存在')) {
      console.log('3. 尝试创建task_completions集合...');
      try {
        // 注意：小程序云开发不支持通过代码创建集合，需要在控制台创建
        // 这里我们只是提示用户需要在控制台创建集合
        console.log('⚠️ 请在云开发控制台手动创建task_completions集合');
        console.log('   集合名称：task_completions');
        console.log('   建议添加的字段：');
        console.log('   - taskId: string (任务ID)');
        console.log('   - _openid: string (用户ID)');
        console.log('   - completedAt: date (完成时间)');
        
        return {
          success: false,
          message: '集合不存在，请在云开发控制台手动创建',
          error: error.message
        };
      } catch (createError) {
        console.error('❌ 创建集合失败:', createError);
        return {
          success: false,
          message: '创建集合失败',
          error: createError.message
        };
      }
    } else {
      // 其他错误
      return {
        success: false,
        message: '检查集合失败',
        error: error.message
      };
    }
  }
}

// 执行测试
checkAndCreateCollection();
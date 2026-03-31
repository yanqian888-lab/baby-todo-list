// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const requestId = context.requestID || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  console.log(`[${requestId}] 开始测试集合是否存在...`)
  
  try {
    // 检查task_completions集合是否存在
    console.log('1. 检查task_completions集合是否存在...')
    const taskCompletionsResult = await db.collection('task_completions').count()
    console.log('✅ task_completions集合存在，文档数量:', taskCompletionsResult.total)
    
    return {
      success: true,
      message: '集合检查完成',
      data: {
        task_completions: {
          exists: true,
          count: taskCompletionsResult.total
        }
      }
    }
  } catch (error) {
    console.error(`[${requestId}] 集合检查错误:`, error)
    
    // 分析错误类型
    const errors = {}
    
    // 检查task_completions集合
    try {
      await db.collection('task_completions').count()
      errors.task_completions = { exists: true }
    } catch (e) {
      errors.task_completions = { exists: false, error: e.message }
    }
    
    return {
      success: false,
      message: '集合检查失败',
      errors: errors
    }
  }
}
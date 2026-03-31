// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 数据库引用
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const startTime = Date.now()
  const requestId = context.requestID || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 获取调用上下文
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log(`[${requestId}] 开始处理 updateTaskStatus 请求`)
  console.log(`[${requestId}] 接收到的事件参数:`, JSON.stringify(event))
  
  try {
    // 1. 参数验证
    if (!event.taskId || typeof event.taskId !== 'string') {
      throw new Error('参数错误：缺少有效的taskId')
    }
    
    if (!['pending', 'completed'].includes(event.status)) {
      throw new Error('参数错误：status必须是pending或completed')
    }
    
    // 2. 提取并清理参数
    const sanitizedTaskId = event.taskId.trim()
    const status = event.status
    
    // 3. 获取任务当前状态（用于后续逻辑判断）
    let currentTask
    try {
      currentTask = await db.collection('tasks').doc(sanitizedTaskId).get()
    } catch (error) {
      if (error.errCode === 'INVALID_PARAMETER' && error.errMsg.includes('document not found')) {
        throw new Error('任务不存在或已被删除')
      }
      throw error
    }
    
    const currentStatus = currentTask.data.status
    
    // 4. 如果状态没有变化，直接返回成功
    if (currentStatus === status) {
      const endTime = Date.now()
      const totalProcessingTime = endTime - startTime
      
      console.log(`[${requestId}] 任务状态未变化，无需更新，总耗时:`, totalProcessingTime, 'ms')
      
      return {
        success: true,
        message: '任务状态未变化，无需更新',
        data: {
          taskId: sanitizedTaskId,
          status: status,
          hasOpenid: !!openid,
          updateTime: new Date().toISOString()
        },
        meta: {
          requestId: requestId,
          processingTime: totalProcessingTime,
          timestamp: new Date().toISOString(),
          environment: process.env.DYNAMIC_CURRENT_ENV || 'default'
        }
      }
    }
    
    // 5. 更新任务状态
    await db.collection('tasks').doc(sanitizedTaskId).update({
      data: {
        status: status,
        updatedAt: db.serverDate()
      }
    })
    
    // 6. 如果有openid，处理打卡记录
    if (openid) {
      // 6.1 记录每次打卡，无论任务是否完全完成
      try {
          await db.collection('task_completions').add({
            data: {
              taskId: sanitizedTaskId,
              _openid: openid, // 使用微信云开发默认的_openid字段
              completedAt: db.serverDate(),
              checkins: event.checkins || 1, // 记录当前打卡次数
              cycleTimes: 1, // 每日任务默认只能完成1次
              isAllCompleted: status === 'completed' // 标记是否完全完成
            }
          })
      } catch (completionError) {
        console.warn(`[${requestId}] 记录打卡历史失败:`, completionError)
        // 这个错误不影响主流程，继续执行
      }
      
      // 6.2 如果任务从待办变为已完成，增加用户完成任务数
      if (currentStatus === 'pending' && status === 'completed') {
        try {
          await db.collection('user_stats').where({
            openid: openid
          }).update({
            data: {
              completedTasks: _.inc(1)
            }
          })
        } catch (error) {
          console.warn(`[${requestId}] 更新用户完成任务数失败:`, error)
          // 这个错误不影响主流程，继续执行
        }
      }
      
      // 6.3 如果任务从已完成变为待办，减少用户完成任务数
      if (currentStatus === 'completed' && status === 'pending') {
        try {
          // 先检查用户的completedTasks是否大于0
          const userStats = await db.collection('user_stats').where({
            openid: openid,
            completedTasks: _.gt(0)
          }).get()
          
          if (userStats.data.length > 0) {
            await db.collection('user_stats').where({
              openid: openid
            }).update({
              data: {
                completedTasks: _.inc(-1)
              }
            })
          }
        } catch (error) {
          console.warn(`[${requestId}] 更新用户完成任务数失败:`, error)
          // 这个错误不影响主流程，继续执行
        }
      }
    }
    
    // 最后，返回结构化的成功响应
    const endTime = Date.now()
    const totalProcessingTime = endTime - startTime
    
    console.log(`[${requestId}] 处理完成，总耗时:`, totalProcessingTime, 'ms')
    
    return {
      success: true,
      message: '任务状态更新成功',
      data: {
        taskId: sanitizedTaskId,
        status: status,
        hasOpenid: !!openid,
        updateTime: new Date().toISOString()
      },
      meta: {
        requestId: requestId,
        processingTime: totalProcessingTime,
        timestamp: new Date().toISOString(),
        environment: process.env.DYNAMIC_CURRENT_ENV || 'default'
      }
    }
  } catch (error) {
    console.error('更新任务状态全局错误:', error)
    // 提供更友好、更具体的错误信息
    let errorMsg = error.message || '未知错误'
    
    // 详细处理各类错误场景
    if (errorMsg.includes('undefined')) {
      if (errorMsg.includes('查询参数对象值不能均为undefined')) {
        errorMsg = '数据库操作失败：查询参数无效'
      } else {
        errorMsg = '参数验证失败：请确保所有必要参数都有有效值'
      }
    } else if (errorMsg.includes('document not found')) {
      errorMsg = '任务不存在或已被删除'
    } else if (errorMsg.includes('permission denied')) {
      errorMsg = '没有足够权限执行此操作'
    }
    
    return {
      success: false,
      error: errorMsg,
      // 添加调试信息帮助排查问题
      debug: {
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    };
  }
}
// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 数据库引用
const db = cloud.database()
const _ = db.command

// 获取北京时间当天的起止时间（UTC Date）
function getBeijingTodayRange() {
  const now = new Date();
  const beijingOffset = 8 * 60 * 60 * 1000;
  const beijingNow = new Date(now.getTime() + beijingOffset);
  const year = beijingNow.getUTCFullYear();
  const month = beijingNow.getUTCMonth();
  const date = beijingNow.getUTCDate();
  const start = new Date(Date.UTC(year, month, date, -8, 0, 0));
  const end = new Date(Date.UTC(year, month, date + 1, -8, 0, 0));
  return { start, end };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const startTime = Date.now()
  const requestId = context.requestID || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 获取调用上下文
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  
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
      if (error.errMsg && error.errMsg.includes('document not found')) {
        throw new Error('任务不存在或已被删除')
      }
      throw error
    }
    
    const currentStatus = currentTask.data.status

    // 3.5 权限校验：只有任务创建者或家庭成员可以操作
    const taskFamilyId = currentTask.data.familyId || null;
    const taskOpenId = currentTask.data._openid || '';
    if (taskOpenId !== openid) {
      if (taskFamilyId) {
        const familyRes = await db.collection('families').doc(taskFamilyId).get().catch(() => null);
        const family = familyRes ? familyRes.data : null;
        const isMember = family && (family.members || []).some(m => m.openId === openid);
        if (!isMember) {
          throw new Error('无权操作此任务');
        }
      } else {
        throw new Error('无权操作此任务');
      }
    }
    
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
    // 对于循环任务（daily/weekly/monthly），打卡后不改变任务状态，保持为 pending
    // 只有单次任务（none）在打卡后才变为 completed
    const taskFrequency = currentTask.data.frequency || 'none';
    const isRecurringTask = ['daily', 'weekly', 'monthly'].includes(taskFrequency);
    
    // 如果循环任务当前是 pending，打卡后保持 pending
    // 如果当前是 completed 且用户取消完成，则改为 pending
    let newStatus = status;
    if (isRecurringTask && status === 'completed' && currentStatus === 'pending') {
      // 循环任务打卡后不改变状态
      newStatus = 'pending';
      console.log(`[${requestId}] 循环任务 ${taskFrequency} 打卡完成，保持 pending 状态`);
    }
    
    await db.collection('tasks').doc(sanitizedTaskId).update({
      data: {
        status: newStatus,
        updatedAt: db.serverDate()
      }
    })
    
    // 6. 如果有openid，处理打卡记录
    if (openid) {
      // 6.1 如果任务从已完成变为待办，删除最近一次打卡记录（取消完成）
      if (currentStatus === 'completed' && status === 'pending') {
        try {
          const latestCompletion = await db.collection('task_completions')
            .where({ taskId: sanitizedTaskId, _openid: openid })
            .orderBy('completedAt', 'desc')
            .limit(1)
            .get();
          if (latestCompletion.data.length > 0) {
            await db.collection('task_completions').doc(latestCompletion.data[0]._id).remove();
            console.warn(`[${requestId}] 已删除取消完成的打卡记录`);
          }
        } catch (removeError) {
          console.warn(`[${requestId}] 删除取消完成的打卡记录失败:`, removeError);
        }
      }

      // 6.2 记录每次打卡，无论任务是否完全完成（仅在变为已完成时添加）
      if (status === 'completed') {
        try {
          // 循环任务：检查今天是否已有打卡记录，防止重复
          let shouldAddCompletion = true;
          const { start: bjStart, end: bjEnd } = getBeijingTodayRange();
          if (isRecurringTask) {
            const dailyCheckWhere = {
              taskId: sanitizedTaskId,
              completedAt: db.command.gte(bjStart).and(db.command.lt(bjEnd))
            };
            // 家庭场景：只要家庭里有人打过卡就算已打卡；个人场景：仅查自己
            if (taskFamilyId) {
              dailyCheckWhere.familyId = taskFamilyId;
            } else {
              dailyCheckWhere._openid = openid;
            }
            const existingToday = await db.collection('task_completions').where(dailyCheckWhere).count();
            if (existingToday.total > 0) {
              shouldAddCompletion = false;
              console.warn(`[${requestId}] 今日已有打卡记录，跳过重复写入`);
            }
          }

          if (shouldAddCompletion) {
            // 二次校验：最小化竞态窗口
            if (isRecurringTask) {
              const dailyCheckWhere2 = {
                taskId: sanitizedTaskId,
                completedAt: db.command.gte(bjStart).and(db.command.lt(bjEnd))
              };
              if (taskFamilyId) {
                dailyCheckWhere2.familyId = taskFamilyId;
              } else {
                dailyCheckWhere2._openid = openid;
              }
              const doubleCheck = await db.collection('task_completions').where(dailyCheckWhere2).count();
              if (doubleCheck.total > 0) {
                console.warn(`[${requestId}] 二次校验发现今日已有打卡记录，跳过`);
                shouldAddCompletion = false;
              }
            }

            if (shouldAddCompletion) {
              await db.collection('task_completions').add({
                data: {
                  taskId: sanitizedTaskId,
                  _openid: openid, // 使用微信云开发默认的_openid字段
                  completedAt: db.serverDate(),
                  familyId: currentTask.data.familyId || null,
                  checkins: (typeof event.checkins === 'number' && event.checkins >= 1 && event.checkins <= 9999) ? event.checkins : 1, // 记录当前打卡次数
                  cycleTimes: 1, // 每日任务默认只能完成1次
                  isAllCompleted: !isRecurringTask && status === 'completed' // 单次任务标记为完成，循环任务标记为未完成
                }
              })
            }
          }
        } catch (completionError) {
          console.warn(`[${requestId}] 记录打卡历史失败:`, completionError)
          // 这个错误不影响主流程，继续执行
        }
      }
      
      // 6.3 如果任务从待办变为已完成，增加用户完成任务数（仅对单次任务）
      if (!isRecurringTask && currentStatus === 'pending' && status === 'completed') {
        try {
          await db.collection('users').where({
            openid: openid
          }).update({
            data: {
              'statistics.completedTasks': _.inc(1)
            }
          })
        } catch (error) {
          console.warn(`[${requestId}] 更新用户完成任务数失败:`, error)
          // 这个错误不影响主流程，继续执行
        }
      }
      
      // 6.4 如果任务从已完成变为待办，减少用户完成任务数（仅对单次任务）
      if (!isRecurringTask && currentStatus === 'completed' && status === 'pending') {
        try {
          // 先检查用户的completedTasks是否大于0
          const userStats = await db.collection('users').where({
            openid: openid,
            'statistics.completedTasks': _.gt(0)
          }).get()
          
          if (userStats.data.length > 0) {
            await db.collection('users').where({
              openid: openid
            }).update({
              data: {
                'statistics.completedTasks': _.inc(-1)
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
        status: newStatus,
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
// 云函数：获取特定任务的打卡历史记录
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { taskId, todayOnly } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 参数验证
    if (!taskId) {
      return {
        success: false,
        error: '缺少任务ID'
      };
    }
    
    // 对taskId进行trim()处理，确保与保存时的格式一致
    const sanitizedTaskId = taskId.trim();
    
    console.log('获取打卡记录参数:', {
      openid: openid,
      taskId: sanitizedTaskId,
      todayOnly: todayOnly
    });
    
    let clockInsResult;
    let clockIns = [];
    let todayCount = 0;
    
    try {
      // 构建查询条件对象
      let whereCondition = {
        taskId: sanitizedTaskId
      };
      
      // 如果只查询今日记录，添加时间范围条件到条件对象中
      if (todayOnly) {
        // 使用服务器时间计算今日日期范围，避免时区问题
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log('查询今日打卡记录的时间范围:', {
          today: today.toISOString(),
          tomorrow: tomorrow.toISOString()
        });
        
        // 将时间范围条件添加到条件对象中
        whereCondition.completedAt = _.gte(today).lt(tomorrow);
      }
      
      // 构建查询 - 先应用条件再排序
      let query = db.collection('task_completions')
        .where(whereCondition)
        .orderBy('completedAt', 'desc');
      
      // 执行查询
      clockInsResult = await query.get();
      
      clockIns = clockInsResult.data || [];
      console.log('今日打卡记录查询结果:', clockIns);
      
      // 获取今日打卡次数
      todayCount = clockIns.length;
      console.log('今日打卡次数:', todayCount);
      
      // 查询该任务的所有打卡记录，确保数据存在
      const allClockInsResult = await db.collection('task_completions')
        .where({ taskId: sanitizedTaskId })
        .orderBy('completedAt', 'desc')
        .limit(10)
        .get();
      console.log('该任务的所有打卡记录:', allClockInsResult.data);
      
      // 检查tasks集合中的checkins字段
      try {
        const taskResult = await db.collection('tasks').doc(sanitizedTaskId).get();
        console.log('任务信息:', taskResult.data);
        if (taskResult.data.checkins !== undefined) {
          console.log('任务的checkins字段值:', taskResult.data.checkins);
        }
      } catch (taskError) {
        console.error('获取任务信息失败:', taskError);
      }
    } catch (queryError) {
      console.error('查询打卡记录时出错:', queryError);
      
      // 检查是否是因为集合不存在导致的错误
      if (queryError.errCode === -502005) {
        console.log('检测到task_completions集合不存在，返回空数据');
        // 返回空数据作为降级处理
        return {
          success: true,
          data: {
            clockIns: [],
            todayCount: 0,
            debugInfo: {
              openid: openid,
              taskId: sanitizedTaskId,
              todayOnly: todayOnly,
              todayCount: 0,
              clockInsLength: 0,
              hasClockIns: false,
              collectionMissing: true,
              message: 'task_completions集合不存在，已启用降级处理'
            }
          }
        };
      } else {
        // 其他查询错误
        throw queryError;
      }
    }
    
    console.log('最终返回的今日打卡次数:', todayCount);
    
    // 返回打卡记录和今日打卡次数
    return {
      success: true,
      data: {
        clockIns: clockIns,
        todayCount: todayCount,
        debugInfo: {
          openid: openid,
          taskId: sanitizedTaskId,
          todayOnly: todayOnly,
          todayCount: todayCount,
          clockInsLength: clockIns.length,
          hasClockIns: clockIns.length > 0,
          firstRecordCompletedAt: clockIns.length > 0 ? clockIns[0].completedAt : null
        }
      }
    };
  } catch (error) {
    console.error('获取任务打卡记录失败:', error);
    console.error('错误详情:', JSON.stringify(error));
    
    // 检查是否是因为集合不存在导致的错误
    if (error.errCode === -502005) {
      // 集合不存在时返回空数据而不是错误，确保前端能正常显示打卡次数为0
      console.log('检测到task_completions集合不存在，返回空数据作为降级处理');
      return {
        success: true,
        data: {
          clockIns: [],
          todayCount: 0,
          debugInfo: {
            openid: openid,
            taskId: taskId,
            todayOnly: todayOnly,
            todayCount: 0,
            clockInsLength: 0,
            hasClockIns: false,
            collectionMissing: true,
            message: 'task_completions集合不存在，已启用降级处理'
          }
        }
      };
    }
    
    // 其他错误返回友好提示
    return {
      success: true,
      data: {
        clockIns: [],
        todayCount: 0,
        debugInfo: {
          openid: openid,
          taskId: taskId,
          todayOnly: todayOnly,
          error: error.message,
          errCode: error.errCode
        }
      }
    };
  }
}
// 云函数：获取特定任务的打卡历史记录
const cloud = require('wx-server-sdk')
cloud.init()

// 获取北京时间当天的起止时间（UTC Date）
function getBeijingTodayRange() {
  const now = new Date();
  const beijingOffset = 8 * 60 * 60 * 1000;
  const beijingNow = new Date(now.getTime() + beijingOffset);
  const year = beijingNow.getUTCFullYear();
  const month = beijingNow.getUTCMonth();
  const date = beijingNow.getUTCDate();
  // 北京时间 00:00:00 对应 UTC 当天 -8 小时
  const start = new Date(Date.UTC(year, month, date, -8, 0, 0));
  const end = new Date(Date.UTC(year, month, date + 1, -8, 0, 0));
  return { start, end };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { taskId, taskIds, todayOnly } = event
  
  try {
    const db = cloud.database()
    const _ = db.command

    // 批量查询模式
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      const sanitizedTaskIds = taskIds.map(id => id.trim());
      const { start, end } = getBeijingTodayRange();

      const whereCondition = {
        taskId: _.in(sanitizedTaskIds)
      };
      
      // 家庭场景：查询该家庭下所有成员的打卡记录；个人场景：仅查询自己的
      const { familyId } = event;
      if (familyId) {
        // 校验调用者是否为该家庭成员
        const familyRes = await db.collection('families').doc(familyId).get().catch(() => null);
        const family = familyRes ? familyRes.data : null;
        const isMember = family && (family.creatorOpenId === openid || (family.members || []).some(m => m.openId === openid || m.openid === openid));
        if (!isMember) {
          return { success: false, error: '无权访问该家庭数据' };
        }
        whereCondition.familyId = familyId;
        console.log('👨‍👩‍👧‍👦 批量查询家庭打卡记录:', familyId);
      } else {
        whereCondition._openid = openid;
      }
      
      if (todayOnly) {
        console.log('📅 批量查询今日打卡时间范围(北京时间):', start.toISOString(), '至', end.toISOString());
        whereCondition.completedAt = _.gte(start).lt(end);
      }

      let clockIns = [];
      try {
        const result = await db.collection('task_completions').where(whereCondition).get();
        clockIns = result.data || [];
      } catch (e) {
        if (e.errCode === -502005) {
          clockIns = [];
        } else {
          throw e;
        }
      }

      const counts = {};
      sanitizedTaskIds.forEach(id => { counts[id] = 0; });
      clockIns.forEach(record => {
        const id = record.taskId;
        if (counts[id] !== undefined) {
          counts[id]++;
        }
      });

      return {
        success: true,
        data: {
          todayCounts: counts,
          clockIns: clockIns
        }
      };
    }
    
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

    // 权限校验：验证调用者是否为任务创建者或家庭成员
    let taskData;
    try {
      taskData = (await db.collection('tasks').doc(sanitizedTaskId).get()).data;
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('document not found')) {
        return { success: false, error: '任务不存在' };
      }
      throw err;
    }
    const taskFamilyId = taskData.familyId || null;
    const taskOpenId = taskData._openid || '';
    if (taskOpenId !== openid) {
      if (taskFamilyId) {
        const familyRes = await db.collection('families').doc(taskFamilyId).get().catch(() => null);
        const family = familyRes ? familyRes.data : null;
        const isMember = family && (family.creatorOpenId === openid || (family.members || []).some(m => m.openId === openid || m.openid === openid));
        if (!isMember) {
          return { success: false, error: '无权查看此任务的打卡记录' };
        }
      } else {
        return { success: false, error: '无权查看此任务的打卡记录' };
      }
    }
    
    let clockInsResult;
    let clockIns = [];
    let todayCount = 0;
    
    try {
      // 构建查询条件对象
      let whereCondition = {
        taskId: sanitizedTaskId,
        _openid: openid
      };
      
      // 如果只查询今日记录，添加时间范围条件到条件对象中
      if (todayOnly) {
        const { start, end } = getBeijingTodayRange();
        
        console.log('查询今日打卡记录的时间范围(北京时间):', {
          start: start.toISOString(),
          end: end.toISOString()
        });
        
        // 将时间范围条件添加到条件对象中
        whereCondition.completedAt = _.gte(start).lt(end);
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
      
      // 已移除调试用的全局打卡记录查询，避免数据泄露
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
        todayCount: todayCount
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
    
    // 其他错误返回失败
    return {
      success: false,
      error: error.message,
      data: {
        clockIns: [],
        todayCount: 0
      }
    };
  }
}
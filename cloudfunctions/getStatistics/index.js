// 云函数：获取用户统计数据
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { timeRange, familyId } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 计算时间范围
    const now = new Date()
    let startTime = null
    
    if (timeRange === 'week') {
      startTime = new Date(now)
      startTime.setDate(startTime.getDate() - 7)
    } else if (timeRange === 'month') {
      startTime = new Date(now)
      startTime.setMonth(startTime.getMonth() - 1)
    } else if (timeRange === 'year') {
      startTime = new Date(now)
      startTime.setFullYear(startTime.getFullYear() - 1)
    }
    
    // 构建基础查询条件
    const baseQuery = { status: _.neq('deleted') }
    const timeQuery = startTime ? { createTime: _.gte(startTime) } : {}
    
    // 如果指定了家庭ID，按家庭过滤；否则查询用户关联的所有家庭任务
    if (familyId) {
      baseQuery.familyId = familyId
    } else {
      const familiesRes = await db.collection('families').where(_.or([
        { creatorOpenId: openid },
        { 'members.openId': openid }
      ])).get()
      const familyIds = familiesRes.data.map(f => f._id)
      if (familyIds.length > 0) {
        baseQuery.familyId = _.in(familyIds)
      } else {
        baseQuery._openid = openid
      }
    }
    
    // 获取任务统计
    const taskStats = await db.collection('tasks')
      .where({ ...baseQuery, ...timeQuery })
      .count()
    
    // 获取任务分类统计（提前查询，用于后续过滤）
    const tasks = await db.collection('tasks')
      .where({ ...baseQuery, ...timeQuery })
      .limit(1000)
      .get()

    // 获取已完成任务统计（基于 task_completions 去重 taskId，排除已删除任务）
    let completedTasksCount = 0
    try {
      const completionQuery = {}
      if (familyId) {
        completionQuery.familyId = familyId
      } else {
        completionQuery._openid = openid
      }
      if (startTime) {
        completionQuery.completedAt = _.gte(startTime)
      }
      const completions = await db.collection('task_completions')
        .where(completionQuery)
        .limit(1000)
        .get()
      // 过滤掉已删除任务的打卡记录
      const validTaskIds = new Set(tasks.data.map(t => t._id))
      const uniqueTaskIds = new Set(completions.data
        .filter(item => validTaskIds.has(item.taskId))
        .map(item => item.taskId)
        .filter(Boolean))
      completedTasksCount = uniqueTaskIds.size
    } catch (e) {
      console.warn('获取已完成任务统计失败:', e)
    }
    
    // 获取打卡统计（使用 task_completions 集合）
    const clockInQuery = {}
    if (familyId) {
      clockInQuery.familyId = familyId
    } else {
      clockInQuery._openid = openid
    }
    if (startTime) clockInQuery.completedAt = _.gte(startTime)
    
    const clockInStats = await db.collection('task_completions')
      .where(clockInQuery)
      .count()
    
    // 获取用户基本统计信息
    const userInfo = await db.collection('users').where({
      openid: openid
    }).get()
    
    let consecutiveDays = 0
    if (userInfo.data.length > 0) {
      consecutiveDays = userInfo.data[0].statistics?.consecutiveDays || 0
    }
    
    const categoryMap = {}
    tasks.data.forEach(task => {
      const category = task.category || '未分类'
      if (categoryMap[category]) {
        categoryMap[category]++
      } else {
        categoryMap[category] = 1
      }
    })
    
    const categories = { 
      data: Object.keys(categoryMap).map(category => ({
        _id: category,
        count: categoryMap[category]
      })) 
    }
    
    return {
      success: true,
      statistics: {
        totalTasks: taskStats.total,
        completedTasks: completedTasksCount,
        taskCompletionRate: taskStats.total > 0 ? Math.round((completedTasksCount / taskStats.total) * 100) : 0,
        totalClockIns: clockInStats.total,
        consecutiveDays,
        taskCategories: categories.data
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

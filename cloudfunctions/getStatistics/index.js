// 云函数：获取用户统计数据
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { timeRange } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 计算时间范围
    const now = new Date()
    let startTime = null
    
    if (timeRange === 'week') {
      // 最近一周
      startTime = new Date(now)
      startTime.setDate(startTime.getDate() - 7)
    } else if (timeRange === 'month') {
      // 最近一个月
      startTime = new Date(now)
      startTime.setMonth(startTime.getMonth() - 1)
    } else if (timeRange === 'year') {
      // 最近一年
      startTime = new Date(now)
      startTime.setFullYear(startTime.getFullYear() - 1)
    }
    
    // 构建查询条件
    const timeQuery = startTime ? { createTime: _.gte(startTime) } : {}
    
    // 获取任务统计
    const taskStats = await db.collection('tasks')
      .where({
        openid: openid,
        ...timeQuery
      })
      .count()
    
    const completedTaskStats = await db.collection('tasks')
      .where({
        openid: openid,
        status: 'completed',
        ...timeQuery
      })
      .count()
    
    // 获取打卡统计
    const clockInStats = await db.collection('clockIns')
      .where({
        openid: openid,
        ...timeQuery
      })
      .count()
    
    // 获取用户基本统计信息
    const userInfo = await db.collection('users').where({
      openid: openid
    }).get()
    
    // 获取最近的打卡记录，用于显示连续打卡天数
    let consecutiveDays = 0
    if (userInfo.data.length > 0) {
      consecutiveDays = userInfo.data[0].statistics?.consecutiveDays || 0
    }
    
    // 获取任务分类统计（使用更兼容的方式）
    const tasks = await db.collection('tasks')
      .where({ openid: openid })
      .get()
    
    // 手动计算分类统计
    const categoryMap = {};
    tasks.data.forEach(task => {
      const category = task.category || '未分类';
      if (categoryMap[category]) {
        categoryMap[category]++;
      } else {
        categoryMap[category] = 1;
      }
    });
    
    // 转换为数组格式
    const categories = { 
      data: Object.keys(categoryMap).map(category => ({
        _id: category,
        count: categoryMap[category]
      })) 
    };
    
    return {
      success: true,
      statistics: {
        totalTasks: taskStats.total,
        completedTasks: completedTaskStats.total,
        taskCompletionRate: taskStats.total > 0 ? Math.round((completedTaskStats.total / taskStats.total) * 100) : 0,
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
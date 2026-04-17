// 云函数：用户打卡
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { memo } = event
  
  try {
    const db = cloud.database()
    const now = new Date()
    
    // 获取今天的日期（只保留年月日部分）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // 检查今天是否已经打卡（统一查询 task_completions）
    const todayClockIn = await db.collection('task_completions').where({
      _openid: openid,
      completedAt: db.command.gte(today).and(db.command.lt(tomorrow))
    }).get()
    
    if (todayClockIn.data.length > 0) {
      return {
        success: false,
        error: '今天已经打卡'
      }
    }
    
    // 获取最近一次的打卡记录
    const lastClockIn = await db.collection('task_completions')
      .where({ _openid: openid })
      .orderBy('completedAt', 'desc')
      .limit(1)
      .get()
    
    // 计算连续打卡天数
    let consecutiveDays = 1
    
    if (lastClockIn.data.length > 0) {
      const lastDate = new Date(lastClockIn.data[0].completedAt)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      // 如果上次打卡是昨天，则连续打卡天数+1
      if (lastDate.getFullYear() === yesterday.getFullYear() &&
          lastDate.getMonth() === yesterday.getMonth() &&
          lastDate.getDate() === yesterday.getDate()) {
        consecutiveDays = (lastClockIn.data[0].consecutiveDays || 0) + 1
      }
    }
    
    // 二次校验：最小化竞态窗口
    const doubleCheck = await db.collection('task_completions').where({
      _openid: openid,
      completedAt: db.command.gte(today).and(db.command.lt(tomorrow))
    }).get();
    if (doubleCheck.data.length > 0) {
      return { success: false, error: '今天已经打卡' };
    }
    
    // 创建打卡记录（统一写入 task_completions）
    await db.collection('task_completions').add({
      data: {
        _openid: openid,
        memo: memo || '',
        completedAt: now,
        consecutiveDays,
        isGeneralClockIn: true
      }
    })
    
    // 更新用户统计信息
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        'statistics.totalClockIns': db.command.inc(1),
        'statistics.consecutiveDays': consecutiveDays
      }
    })
    
    return {
      success: true,
      consecutiveDays,
      message: '打卡成功'
    }
  } catch (error) {
    console.error('打卡失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
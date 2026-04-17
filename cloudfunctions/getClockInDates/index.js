// 云函数：获取用户在指定月份的打卡日期（统一从 task_completions 查询）
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { year, month } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 计算月份的开始和结束日期
    const startDate = new Date(year, month - 1, 1) // month是1-12，JavaScript中是0-11
    const endDate = new Date(year, month, 0) // 下个月的第0天就是当前月的最后一天
    endDate.setHours(23, 59, 59, 999)
    
    // 查询指定月份的打卡记录（从 task_completions 集合）
    const completionsRes = await db.collection('task_completions')
      .where({
        _openid: openid,
        completedAt: _.gte(startDate).and(_.lte(endDate))
      })
      .field({ // 只返回需要的字段
        completedAt: true
      })
      .get()
    
    // 提取日期，格式化为yyyy-MM-dd
    const clockInDates = completionsRes.data.map(item => {
      const date = new Date(item.completedAt)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    })
    
    // 去重
    const uniqueDates = [...new Set(clockInDates)]
    
    return {
      success: true,
      clockInDates: uniqueDates,
      year,
      month
    }
  } catch (error) {
    console.error('获取打卡日期失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 云函数：获取用户在指定月份的打卡日期
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { year, month } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 计算月份的开始和结束日期
    const startDate = new Date(year, month - 1, 1) // month是1-12，JavaScript中是0-11
    const endDate = new Date(year, month, 0) // 下个月的第0天就是当前月的最后一天
    endDate.setHours(23, 59, 59, 999)
    
    // 查询指定月份的打卡记录
    const clockIns = await db.collection('clockIns')
      .where({
        openid: openid,
        createTime: _.gte(startDate).and(_.lte(endDate))
      })
      .field({ // 只返回需要的字段
        createTime: true
      })
      .get()
    
    // 提取日期，格式化为yyyy-MM-dd
    const clockInDates = clockIns.data.map(item => {
      const date = new Date(item.createTime)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    })
    
    return {
      success: true,
      clockInDates,
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
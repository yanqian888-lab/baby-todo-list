// 云函数：获取用户打卡记录
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { startDate, endDate, page = 1, pageSize = 30 } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    const query = { openid }
    
    // 添加日期范围查询
    if (startDate) {
      query.createTime = query.createTime || {}
      query.createTime = _.gte(new Date(startDate))
    }
    
    if (endDate) {
      query.createTime = query.createTime || {}
      // 结束日期需要包含当天的23:59:59
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.createTime = _.lte(end)
    }
    
    // 计算分页偏移量
    const skip = (page - 1) * pageSize
    
    // 查询打卡记录
    const clockIns = await db.collection('clockIns')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取总数
    const countResult = await db.collection('clockIns')
      .where(query)
      .count()
    
    return {
      success: true,
      clockIns: clockIns.data,
      total: countResult.total,
      page,
      pageSize
    }
  } catch (error) {
    console.error('获取打卡记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
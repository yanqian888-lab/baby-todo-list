// 云函数：获取用户打卡记录（统一从 task_completions 查询）
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { startDate, endDate, page = 1, pageSize = 30 } = event
  
  try {
    const db = cloud.database()
    const _ = db.command
    const query = { _openid: openid }
    
    // 添加日期范围查询（基于 completedAt）
    if (startDate && endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.completedAt = _.and(_.gte(new Date(startDate)), _.lte(end))
    } else if (startDate) {
      query.completedAt = _.gte(new Date(startDate))
    } else if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.completedAt = _.lte(end)
    }
    
    // 计算分页偏移量
    const skip = (page - 1) * pageSize
    
    // 查询打卡记录（从 task_completions 集合）
    const completionsRes = await db.collection('task_completions')
      .where(query)
      .orderBy('completedAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取总数
    const countResult = await db.collection('task_completions')
      .where(query)
      .count()
    
    // 将 task_completions 字段映射为前端兼容的 clockIns 格式
    const clockIns = completionsRes.data.map(item => ({
      ...item,
      openid: item._openid,
      createTime: item.completedAt
    }))
    
    return {
      success: true,
      clockIns,
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

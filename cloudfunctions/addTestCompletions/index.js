// 云函数：添加测试打卡记录（仅用于调试）
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 添加测试打卡记录到指定任务
 * @param {string} taskId - 任务ID
 * @param {number} days - 要添加的天数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { taskId, days = 7 } = event
  const openid = wxContext.OPENID
  
  if (!taskId) {
    return {
      success: false,
      error: '缺少taskId参数'
    }
  }
  
  try {
    // 批量添加打卡记录
    const now = new Date()
    const addPromises = []
    
    // 添加最近N天的打卡记录
    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      // 检查是否已存在该日期的打卡记录
      const exists = await db.collection('task_completions')
        .where({
          openid: openid,
          taskId: taskId,
          // 使用日期范围查询
          completeTime: db.command.gte(date.setHours(0, 0, 0, 0)).and(db.command.lt(date.setHours(23, 59, 59, 999)))
        })
        .count()
      
      // 如果不存在，则添加新记录
      if (exists.total === 0) {
        addPromises.push(
          db.collection('task_completions').add({
            data: {
              openid: openid,
              taskId: taskId,
              completeTime: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
              createTime: db.serverDate()
            }
          })
        )
      }
    }
    
    // 等待所有添加操作完成
    if (addPromises.length > 0) {
      await Promise.all(addPromises)
    }
    
    // 获取添加后的总记录数
    const totalResult = await db.collection('task_completions')
      .where({
        openid: openid,
        taskId: taskId
      })
      .count()
    
    return {
      success: true,
      message: `成功添加${addPromises.length}条打卡记录`,
      totalRecords: totalResult.total,
      addedRecords: addPromises.length
    }
  } catch (error) {
    console.error('添加测试打卡记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
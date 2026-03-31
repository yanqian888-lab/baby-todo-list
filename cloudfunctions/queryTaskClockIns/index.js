// 云函数：查询task_completions集合的调试函数
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { taskId } = event
  
  try {
    const db = cloud.database()
    
    // 查询特定任务的打卡记录
    const result = await db.collection('task_completions')
      .where({
        _openid: openid,
        taskId: taskId
      })
      .orderBy('completedAt', 'desc')
      .get()
    
    console.log('查询task_completions集合结果:', result)
    
    // 返回所有打卡记录
    return {
      success: true,
      data: {
        records: result.data,
        count: result.data.length
      },
      message: '查询成功'
    }
  } catch (error) {
    console.error('查询task_completions集合失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
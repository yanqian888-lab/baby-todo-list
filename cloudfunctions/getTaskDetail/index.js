// 云函数：获取任务详情
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid || ''
  const { taskId } = event

  if (!openid) {
    return { success: false, error: '未能获取用户身份信息' }
  }

  if (!taskId) {
    return { success: false, error: '缺少任务ID' }
  }

  const db = cloud.database()

  try {
    let taskData
    try {
      taskData = (await db.collection('tasks').doc(taskId).get()).data
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('document not found')) {
        return { success: false, error: '任务不存在' }
      }
      throw err
    }

    const taskFamilyId = taskData.familyId || null
    const taskOpenId = taskData._openid || ''
    let hasPermission = false
    let familyCreatorOpenId = null

    if (taskOpenId === openid) {
      hasPermission = true
    } else if (taskFamilyId) {
      const familyRes = await db.collection('families').doc(taskFamilyId).get().catch(() => null)
      const family = familyRes ? familyRes.data : null
      const isMember = family && (family.members || []).some(m => m.openId === openid)
      const isCreator = family && family.creatorOpenId === openid
      if (isMember || isCreator) {
        hasPermission = true
      }
      if (family) {
        familyCreatorOpenId = family.creatorOpenId || null
      }
    }

    if (!hasPermission) {
      return { success: false, error: '无权查看此任务' }
    }

    // 将家庭创建者ID注入任务数据，方便前端判断编辑权限
    if (familyCreatorOpenId) {
      taskData.familyCreatorOpenId = familyCreatorOpenId
    }

    // 查询打卡记录（家庭任务返回所有成员记录）
    let clockIns = []
    try {
      let completionQuery = { taskId }
      if (taskFamilyId) {
        completionQuery.familyId = taskFamilyId
      } else {
        completionQuery._openid = openid
      }
      const clockInsRes = await db.collection('task_completions')
        .where(completionQuery)
        .orderBy('completedAt', 'desc')
        .get()
      clockIns = clockInsRes.data || []
    } catch (e) {
      console.warn('查询打卡记录失败:', e)
    }

    return {
      success: true,
      data: {
        task: taskData,
        clockIns
      }
    }
  } catch (error) {
    console.error('获取任务详情失败:', error)
    return {
      success: false,
      error: error.message || '获取任务详情失败'
    }
  }
}

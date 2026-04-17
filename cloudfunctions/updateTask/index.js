// 云函数：更新任务
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid || ''

  if (!openid) {
    return { success: false, error: '未能获取用户身份信息' }
  }

  const {
    taskId,
    title,
    description,
    category,
    priority,
    dueDate,
    frequency,
    selectedDays,
    selectedMonthDays
  } = event

  if (!taskId) {
    return { success: false, error: '缺少任务ID' }
  }

  if (!title || !title.trim()) {
    return { success: false, error: '任务标题不能为空' }
  }

  // 验证循环任务数组参数
  if (selectedDays !== undefined) {
    if (!Array.isArray(selectedDays) || selectedDays.length > 7 || selectedDays.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6)) {
      return { success: false, error: 'selectedDays 参数非法' }
    }
  }
  if (selectedMonthDays !== undefined) {
    if (!Array.isArray(selectedMonthDays) || selectedMonthDays.length > 31 || selectedMonthDays.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 31)) {
      return { success: false, error: 'selectedMonthDays 参数非法' }
    }
  }

  // weekly/monthly 任务必须至少选择一天
  if (frequency === 'weekly' && selectedDays !== undefined && selectedDays.length === 0) {
    return { success: false, error: 'weekly 任务至少需要选择一天' }
  }
  if (frequency === 'monthly' && selectedMonthDays !== undefined && selectedMonthDays.length === 0) {
    return { success: false, error: 'monthly 任务至少需要选择一天' }
  }

  const db = cloud.database()
  const _ = db.command

  try {
    // 查询任务并校验权限
    let taskData
    try {
      taskData = (await db.collection('tasks').doc(taskId).get()).data
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('document not found')) {
        return { success: false, error: '任务不存在' }
      }
      throw err
    }

    const taskOpenId = taskData._openid || ''
    const taskFamilyId = taskData.familyId || null
    let canEdit = false
    if (taskOpenId === openid) {
      canEdit = true
    } else if (taskFamilyId) {
      try {
        const familyRes = await db.collection('families').doc(taskFamilyId).get()
        const family = familyRes.data || null
        if (family && family.creatorOpenId === openid) {
          canEdit = true
        }
      } catch (e) {
        console.warn('校验家庭创建者身份失败:', e)
      }
    }
    if (!canEdit) {
      return { success: false, error: '只有任务创建者或家庭创建者可以修改任务' }
    }

    // 构建更新数据
    const updateData = {
      title: title.trim(),
      description: description || '',
      category: category || 'default',
      priority: typeof priority === 'number' ? priority : 0,
      frequency: frequency || 'none',
      updatedAt: db.serverDate()
    }
    if (selectedDays !== undefined) updateData.selectedDays = selectedDays;
    if (selectedMonthDays !== undefined) updateData.selectedMonthDays = selectedMonthDays;
    
    // 如果任务当前是已完成状态，编辑后重置为待完成（因为编辑通常意味着重新激活）
    if (taskData.status === 'completed') {
      updateData.status = 'pending';
    }

    // 根据频率清理无关字段
    if (frequency === 'weekly') {
      updateData.selectedMonthDays = [];
    } else if (frequency === 'monthly') {
      updateData.selectedDays = [];
    } else if (frequency === 'none' || frequency === 'daily') {
      updateData.selectedDays = [];
      updateData.selectedMonthDays = [];
    }

    if (dueDate) {
      updateData.dueDate = new Date(dueDate)
    } else {
      updateData.dueDate = null
    }
    
    console.log('updateTask 准备更新的数据:', JSON.stringify({ taskId, updateData }));

    await db.collection('tasks').doc(taskId).update({
      data: updateData
    })

    return {
      success: true,
      message: '任务更新成功'
    }
  } catch (error) {
    console.error('更新任务失败:', error)
    return {
      success: false,
      error: error.message || '更新任务失败'
    }
  }
}

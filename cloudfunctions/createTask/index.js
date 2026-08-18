// 云函数：创建任务
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid || ''
  
  // 仅输出脱敏后的调试信息
  console.log('createTask 调用, title长度:', (event.title || '').length)
  console.log('openid前缀:', (openid || '').slice(0, 4) + '****')

  // 检查openid是否存在
  if (!openid || openid === '') {
    console.error('严重错误：未能获取到openid！wxContext中可能不包含有效的openid字段')
    return { success: false, error: '未能获取用户身份信息' }
  }
  
  // 检查event对象是否存在
  if (!event) {
    console.error('严重错误：event参数为空')
    return { success: false, error: '参数错误' }
  }
  
  // 解构参数并提供默认值
  const title = event.title || ''
  const description = event.description || ''
  const dueDate = event.dueDate
  const category = event.category || 'default'
  const priority = event.priority || 0
  const reminderTime = event.reminderTime
  // 循环任务相关参数
  const frequency = event.frequency || 'none'
  const selectedDays = event.selectedDays || []
  const selectedMonthDays = event.selectedMonthDays || []
  
  // 验证必填字段
  if (!title.trim()) {
    console.error('任务标题不能为空')
    return { success: false, error: '任务标题不能为空' }
  }

  // 验证循环任务数组参数，防止文档膨胀
  if (!Array.isArray(selectedDays) || selectedDays.length > 7 || selectedDays.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6)) {
    return { success: false, error: 'selectedDays 参数非法' };
  }
  if (!Array.isArray(selectedMonthDays) || selectedMonthDays.length > 31 || selectedMonthDays.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 31)) {
    return { success: false, error: 'selectedMonthDays 参数非法' };
  }
  // weekly/monthly 任务必须至少选择一天
  if (frequency === 'weekly' && selectedDays.length === 0) {
    return { success: false, error: 'weekly 任务至少需要选择一天' };
  }
  if (frequency === 'monthly' && selectedMonthDays.length === 0) {
    return { success: false, error: 'monthly 任务至少需要选择一天' };
  }
  
  try {
    const db = cloud.database();
    const requestId = event.requestId || null;
    let familyId = event.familyId || null;

    // 并行执行三个相互独立的查询：幂等检查、家庭归属校验、用户信息（昵称+当前家庭）
    // 原来串行 4-5 次数据库往返是保存慢的主要原因
    const [existingTaskRes, familyRes, userRes] = await Promise.all([
      requestId
        ? db.collection('tasks').where({ _openid: openid, requestId }).limit(1).get().catch(() => null)
        : Promise.resolve(null),
      familyId
        ? db.collection('families').doc(familyId).get().catch(() => null)
        : Promise.resolve(null),
      db.collection('users').where({ openid }).get().catch(() => null)
    ]);

    // 幂等性校验：若存在相同 requestId 的任务，直接返回已有任务
    if (existingTaskRes && existingTaskRes.data.length > 0) {
      return { success: true, taskId: existingTaskRes.data[0]._id, message: '任务已存在' };
    }

    // 校验客户端传递的家庭ID归属权
    const checkMember = (family) => family && (family.creatorOpenId === openid || (family.members || []).some(m => m.openId === openid || m.openid === openid));
    if (familyId) {
      if (!checkMember(familyRes && familyRes.data)) {
        console.error('非法 familyId，用户不属于该家庭:', familyId);
        familyId = null;
      } else {
        console.log('👨‍👩‍👧‍👦 使用客户端传递的家庭ID:', familyId);
      }
    }
    // 兜底：从用户记录获取当前家庭（用户信息已在上面并行查出）
    const userDoc = userRes && userRes.data && userRes.data[0];
    if (!familyId && userDoc && userDoc.currentFamilyId) {
      try {
        const candidateRes = await db.collection('families').doc(userDoc.currentFamilyId).get();
        if (checkMember(candidateRes.data)) {
          familyId = userDoc.currentFamilyId;
          console.log('👨‍👩‍👧‍👦 从用户记录获取到当前家庭ID:', familyId);
        }
      } catch (e2) {
        console.warn('校验用户当前家庭ID失败:', e2);
      }
    }

    // 获取用户昵称用于标注创建人
    const creatorNickName = userDoc ? (userDoc.nickName || '') : '';

    // dueDate 有效性校验
    let taskDueDate = null;
    if (dueDate && String(dueDate).trim()) {
      const d = new Date(dueDate);
      if (isNaN(d.getTime())) {
        return { success: false, error: 'dueDate 格式非法' };
      }
      taskDueDate = d;
    }

    // 使用北京时间（UTC+8）
    const now = new Date();
    const beijingNow = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);

    // 创建任务
    const taskData = {
      _openid: openid,
      title,
      description: description || '',
      dueDate: taskDueDate,
      category: category || 'default',
      priority: priority || 0,
      status: 'pending',
      reminderTime: reminderTime ? new Date(reminderTime) : null,
      createTime: beijingNow,
      updateTime: beijingNow,
      isTemplate: false,
      templateId: null,
      creatorNickName,
      requestId: requestId || null,
      // 添加循环任务相关字段
      frequency: frequency || 'none',
      selectedDays: selectedDays || [],
      selectedMonthDays: selectedMonthDays || []
    }
    
    // 如果有家庭ID，添加到任务中
    if (familyId) {
      taskData.familyId = familyId;
    }
    
    const result = await cloud.database().collection('tasks').add({
      data: taskData
    })
    
    // 更新用户的总任务数
    try {
      console.log('准备更新用户统计，使用的条件：', { openidPrefix: (openid || '').slice(0, 4) + '****' })
      // 检查查询条件是否有效
      if (!openid || typeof openid !== 'string') {
        console.error('查询条件无效：', { openidPrefix: (openid || '').slice(0, 4) + '****' })
        throw new Error('查询参数对象值不能均为undefined')
      }
      
      await cloud.database().collection('users').where({
        openid: openid
      }).update({
        data: {
          'statistics.totalTasks': cloud.database().command.inc(1)
        }
      })
      console.log('用户统计更新成功')
    } catch (updateError) {
      console.error('更新用户统计失败:', updateError)
      // 即使更新统计失败，也不影响任务创建成功
      console.log('继续执行，任务创建已成功')
    }
    
    return {
      success: true,
      taskId: result._id
    }
  } catch (error) {
    console.error('创建任务失败:', error)
    console.error('错误类型:', typeof error)
    console.error('错误堆栈:', error.stack)
    console.error('创建任务时的参数状态：')
    console.error('openid前缀:', (openid || '').slice(0, 4) + '****')
    console.error('title长度:', (title || '').length)
    
    // 处理特定错误类型
    if (error.message && error.message.includes('查询参数对象值不能均为undefined')) {
      console.error('发现查询参数错误，可能是where条件构建问题')
      return {
        success: false,
        error: '数据查询参数错误',
        details: error.message
      }
    }
    
    return {
      success: false,
      error: error.message || '创建任务失败'
    }
  }
}
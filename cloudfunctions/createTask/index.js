// 云函数：创建任务
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  // 详细记录接收到的所有参数
  console.log('接收到的event参数：', event)
  console.log('接收到的context参数：', context)
  
  const wxContext = cloud.getWXContext()
  // 详细记录wxContext中的信息
  console.log('wxContext对象完整内容:', JSON.stringify(wxContext, null, 2))
  console.log('wxContext.openid值:', wxContext.openid)
  console.log('wxContext.OPENID值:', wxContext.OPENID)
  
  // 同时尝试获取大写和小写的openid，增加兼容性
  const openid = wxContext.openid || wxContext.OPENID || ''
  
  console.log('最终获取到的openid:', openid)
  
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
  
  console.log('构建任务数据前，各参数值：')
  console.log('title:', title)
  console.log('description:', description)
  console.log('category:', category)
  console.log('priority:', priority)
  console.log('frequency:', frequency)
  
  try {
    // 创建任务
    const result = await cloud.database().collection('tasks').add({
      data: {
        _openid: openid,
        title,
        description: description || '',
        dueDate: dueDate ? new Date(dueDate) : null,
        category: category || 'default',
        priority: priority || 0,
        status: 'pending',
        reminderTime: reminderTime ? new Date(reminderTime) : null,
        createTime: new Date(),
        updateTime: new Date(),
        isTemplate: false,
        templateId: null,
        // 添加循环任务相关字段
        frequency: frequency || 'none',
        selectedDays: selectedDays || [],
        selectedMonthDays: selectedMonthDays || []
      }
    })
    
    // 更新用户的总任务数
    try {
      console.log('准备更新用户统计，使用的条件：', { _openid: openid })
      // 检查查询条件是否有效
      if (!openid || typeof openid !== 'string') {
        console.error('查询条件无效：', { _openid: openid })
        throw new Error('查询参数对象值不能均为undefined')
      }
      
      await cloud.database().collection('users').where({
        _openid: openid
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
    console.error('openid:', openid)
    console.error('title:', title)
    
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
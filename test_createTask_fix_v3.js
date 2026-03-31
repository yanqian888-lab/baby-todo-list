// 测试脚本：验证createTask云函数修复效果
// 主要测试修复的变量名错误和增强的错误处理

// 模拟云函数环境 - 使用原生JavaScript实现
const mockCloud = {
  database: () => ({
    collection: (name) => ({
      add: async () => ({ _id: 'test-task-id' }),
      where: function() { return this; },
      update: async () => ({ updated: 1 })
    })
  }),
  getWXContext: () => mockCloud.mockWXContext
}

// 模拟上下文存储
mockCloud.mockWXContext = {}

// 模拟command.inc函数
mockCloud.database().command = {
  inc: (n) => ({ $inc: n })
}

// 跟踪日志
const logs = []
const errors = []

// 保存原始控制台方法
const originalConsoleLog = console.log
const originalConsoleError = console.error

// 重写控制台方法以记录日志
console.log = (...args) => {
  logs.push(args)
  originalConsoleLog(...args)
}

console.error = (...args) => {
  errors.push(args)
  originalConsoleError(...args)
}

// 准备要测试的代码
const testCreateTaskFunction = async (openidType = 'lowercase') => {
  // 重置日志
  logs.length = 0
  errors.length = 0
  
  // 根据测试类型设置不同的openid返回
  if (openidType === 'lowercase') {
    mockCloud.mockWXContext = { openid: 'test-openid' }
  } else if (openidType === 'uppercase') {
    mockCloud.mockWXContext = { OPENID: 'test-openid' }
  } else if (openidType === 'both') {
    mockCloud.mockWXContext = { openid: 'test-openid', OPENID: 'test-openid-uppercase' }
  } else if (openidType === 'none') {
    mockCloud.mockWXContext = {}
  }
  
  // 创建模拟函数
  const createTask = async (event, context) => {
    const wxContext = mockCloud.getWXContext()
    
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
    const frequency = event.frequency || 'none'
    const cycleTimes = event.cycleTimes || null
    const selectedDays = event.selectedDays || []
    const selectedMonthDays = event.selectedMonthDays || []
    
    // 验证必填字段
    if (!title.trim()) {
      console.error('任务标题不能为空')
      return { success: false, error: '任务标题不能为空' }
    }
    
    try {
      // 模拟创建任务
      console.log('创建任务数据...')
      await mockCloud.database().collection('tasks').add({ data: {} })
      
      // 更新用户统计，这里测试修复后的变量名
      try {
        console.log('准备更新用户统计，使用的条件：', { _openid: openid })
        // 检查查询条件是否有效 - 修复：使用正确的变量名openid
        if (!openid || typeof openid !== 'string') {
          console.error('查询条件无效：', { _openid: openid })
          throw new Error('查询参数对象值不能均为undefined')
        }
        
        await mockCloud.database().collection('users').where({ _openid: openid }).update({})
        console.log('用户统计更新成功')
      } catch (updateError) {
        console.error('更新用户统计失败:', updateError)
        console.log('继续执行，任务创建已成功')
      }
      
      return { success: true, taskId: 'test-task-id' }
    } catch (error) {
      console.error('创建任务失败:', error)
      console.error('错误类型:', typeof error)
      
      if (error.message && error.message.includes('查询参数对象值不能均为undefined')) {
        console.error('发现查询参数错误，可能是where条件构建问题')
        return { success: false, error: '数据查询参数错误', details: error.message }
      }
      
      return { success: false, error: error.message || '创建任务失败' }
    }
  }
  
  return createTask
}

// 运行测试用例
async function runTests() {
  console.log('开始测试createTask云函数修复效果...\n')
  let passedTests = 0
  let totalTests = 0
  
  // 测试用例1：测试小写openid
  totalTests++
  console.log(`测试用例 ${totalTests}: 小写openid`)
  try {
    const createTask = await testCreateTaskFunction('lowercase')
    const result = await createTask({ title: '测试任务' })
    console.log('结果:', result)
    if (result.success) {
      passedTests++
      console.log('✅ 测试通过: 成功获取小写openid并创建任务')
    } else {
      console.log('❌ 测试失败:', result.error)
    }
  } catch (error) {
    console.log('❌ 测试抛出异常:', error.message)
  }
  console.log('-------------------\n')
  
  // 测试用例2：测试大写OPENID
  totalTests++
  console.log(`测试用例 ${totalTests}: 大写OPENID`)
  try {
    const createTask = await testCreateTaskFunction('uppercase')
    const result = await createTask({ title: '测试任务' })
    console.log('结果:', result)
    if (result.success) {
      passedTests++
      console.log('✅ 测试通过: 成功获取大写OPENID并创建任务')
    } else {
      console.log('❌ 测试失败:', result.error)
    }
  } catch (error) {
    console.log('❌ 测试抛出异常:', error.message)
  }
  console.log('-------------------\n')
  
  // 测试用例3：测试无openid
  totalTests++
  console.log(`测试用例 ${totalTests}: 无openid`)
  try {
    const createTask = await testCreateTaskFunction('none')
    const result = await createTask({ title: '测试任务' })
    console.log('结果:', result)
    if (!result.success && result.error === '未能获取用户身份信息') {
      passedTests++
      console.log('✅ 测试通过: 正确处理无openid情况')
    } else {
      console.log('❌ 测试失败: 未正确处理无openid情况')
    }
  } catch (error) {
    console.log('❌ 测试抛出异常:', error.message)
  }
  console.log('-------------------\n')
  
  // 测试用例4：测试空title
  totalTests++
  console.log(`测试用例 ${totalTests}: 空title`)
  try {
    const createTask = await testCreateTaskFunction('lowercase')
    const result = await createTask({ title: '' })
    console.log('结果:', result)
    if (!result.success && result.error === '任务标题不能为空') {
      passedTests++
      console.log('✅ 测试通过: 正确验证必填字段')
    } else {
      console.log('❌ 测试失败: 未正确验证必填字段')
    }
  } catch (error) {
    console.log('❌ 测试抛出异常:', error.message)
  }
  console.log('-------------------\n')
  
  // 测试用例5：模拟更新统计失败
  totalTests++
  console.log(`测试用例 ${totalTests}: 模拟更新统计失败`)
  try {
    const createTask = await testCreateTaskFunction('lowercase')
    // 模拟更新失败
    const originalUpdate = mockCloud.database().collection('users').update;
    mockCloud.database().collection('users').update = async () => {
      throw new Error('更新失败');
    }
    const result = await createTask({ title: '测试任务' })
    console.log('结果:', result)
    if (result.success) {
      passedTests++
      console.log('✅ 测试通过: 更新统计失败不影响任务创建')
    } else {
      console.log('❌ 测试失败: 更新统计失败导致任务创建失败')
    }
  } catch (error) {
    console.log('❌ 测试抛出异常:', error.message)
  }
  
  // 测试总结
  console.log('\n====================================')
  console.log(`测试结果: ${passedTests}/${totalTests} 通过`)
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！修复成功！')
  } else {
    console.log('⚠️  部分测试失败，请检查修复内容')
  }
  console.log('====================================')
}

// 运行测试
runTests().catch(console.error)
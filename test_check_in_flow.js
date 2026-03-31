// 测试打卡流程：打卡后次数是否增加
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec' // 使用实际的环境ID
})

// 数据库引用
const db = cloud.database()
const _ = db.command

// 模拟测试数据
const testOpenid = 'test_user_openid'
const testTaskId = 'test_task_001'

// 模拟云函数环境
function mockCloudContext() {
  return {
    OPENID: testOpenid,
    APPID: 'wx1234567890',
    UNIONID: null
  }
}

// 测试getTaskClockIns云函数
async function testGetTaskClockIns(taskId, todayOnly = true) {
  console.log('\n=== 调用 getTaskClockIns ===')
  const result = await cloud.callFunction({
    name: 'getTaskClockIns',
    data: {
      taskId,
      todayOnly
    }
  })
  
  console.log('getTaskClockIns返回:', JSON.stringify(result.result, null, 2))
  return result.result
}

// 测试updateTaskStatus云函数
async function testUpdateTaskStatus(taskId, status = 'pending') {
  console.log('\n=== 调用 updateTaskStatus ===')
  const result = await cloud.callFunction({
    name: 'updateTaskStatus',
    data: {
      taskId,
      status,
      checkins: 1
    }
  })
  
  console.log('updateTaskStatus返回:', JSON.stringify(result.result, null, 2))
  return result.result
}

// 创建测试任务
async function createTestTask() {
  console.log('\n=== 创建测试任务 ===')
  try {
    const result = await db.collection('tasks').add({
      data: {
        name: '测试任务',
        status: 'pending',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        _openid: testOpenid
      }
    })
    
    console.log('测试任务创建成功:', result)
    return result._id
  } catch (error) {
    console.error('创建测试任务失败:', error)
    // 如果任务已存在，返回固定ID
    return testTaskId
  }
}

// 清理测试数据
async function cleanTestData(taskId) {
  console.log('\n=== 清理测试数据 ===')
  try {
    // 删除测试打卡记录
    await db.collection('task_completions').where({
      taskId,
      _openid: testOpenid
    }).remove()
    
    console.log('测试数据清理完成')
  } catch (error) {
    console.error('清理测试数据失败:', error)
  }
}

// 主测试流程
async function main() {
  try {
    console.log('=== 开始测试打卡流程 ===')
    
    // 1. 创建测试任务
    const taskId = await createTestTask()
    
    // 2. 先获取当前打卡次数
    const initialResult = await testGetTaskClockIns(taskId)
    const initialCount = initialResult?.data?.todayCount || 0
    console.log('\n初始打卡次数:', initialCount)
    
    // 3. 执行打卡操作
    await testUpdateTaskStatus(taskId, 'pending')
    
    // 4. 再次获取打卡次数
    const afterResult = await testGetTaskClockIns(taskId)
    const afterCount = afterResult?.data?.todayCount || 0
    console.log('\n打卡后次数:', afterCount)
    
    // 5. 验证结果
    if (afterCount === initialCount + 1) {
      console.log('\n✅ 测试通过！打卡后次数正确增加')
    } else {
      console.log('\n❌ 测试失败！打卡后次数没有增加')
      console.log('   预期:', initialCount + 1)
      console.log('   实际:', afterCount)
    }
    
    // 6. 清理测试数据
    await cleanTestData(taskId)
    
  } catch (error) {
    console.error('测试过程中出错:', error)
  }
}

// 执行测试
main()
// 验证数据库中的任务和打卡记录
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

// 测试getTasks云函数
async function testGetTasks() {
  console.log('🔍 测试获取已完成任务...')
  try {
    const result = await db.collection('tasks')
      .where({
        status: 'completed',
        isTemplate: false
      })
      .get()
    console.log(`✅ 已完成任务数量: ${result.data.length}`)
    console.log('📋 已完成任务列表:', JSON.stringify(result.data, null, 2))
    return result.data.length
  } catch (error) {
    console.error('❌ 获取已完成任务失败:', error)
    return 0
  }
}

// 测试getUserStatistics云函数
async function testUserStatistics() {
  console.log('🔍 测试获取用户统计信息...')
  try {
    const result = await db.collection('task_completions').get()
    console.log(`✅ 打卡记录数量: ${result.data.length}`)
    console.log('📋 打卡记录列表:', JSON.stringify(result.data, null, 2))
    return result.data.length
  } catch (error) {
    console.error('❌ 获取打卡记录失败:', error)
    return 0
  }
}

// 执行测试
async function runTests() {
  console.log('🚀 开始数据库数据验证...')
  await testGetTasks()
  await testUserStatistics()
  console.log('✅ 数据库数据验证完成!')
}

runTests()
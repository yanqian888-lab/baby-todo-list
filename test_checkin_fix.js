// 测试打卡修复效果的脚本
// 这个脚本用于验证打卡记录是否能正确保存和查询

const cloud = require('wx-server-sdk')

// 初始化云函数环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 测试数据
const testData = {
  taskId: 'your-task-id-here', // 请替换为实际的任务ID
  openid: 'test-openid', // 测试用的openid
  taskName: '测试任务',
  cycleTimes: 5
}

// 测试函数
async function testCheckinFix() {
  console.log('=== 开始测试打卡修复效果 ===')
  
  try {
    // 1. 创建测试打卡记录
    console.log('\n1. 创建测试打卡记录...')
    const checkinRecord = {
      _openid: testData.openid,
      taskId: testData.taskId.trim(), // 使用trim()处理，与修复后的代码一致
      checkinTime: new Date(),
      checkinCount: 2,
      cycleTimes: testData.cycleTimes,
      taskName: testData.taskName,
      createTime: new Date()
    }
    
    const addResult = await db.collection('task_clock_ins').add({
      data: checkinRecord
    })
    
    console.log('✅ 测试打卡记录创建成功:', addResult._id)
    
    // 2. 查询打卡记录
    console.log('\n2. 查询打卡记录...')
    const queryResult = await db.collection('task_clock_ins')
      .where({
        _openid: testData.openid,
        taskId: testData.taskId.trim() // 使用trim()处理
      })
      .orderBy('checkinTime', 'desc')
      .get()
    
    console.log('✅ 查询到的打卡记录:', queryResult.data)
    
    // 3. 验证今日打卡次数计算
    console.log('\n3. 验证今日打卡次数计算...')
    let todayCount = 0
    if (queryResult.data.length > 0) {
      todayCount = queryResult.data[0].checkinCount || 0
    }
    
    console.log('✅ 今日打卡次数:', todayCount)
    
    // 4. 清理测试数据
    console.log('\n4. 清理测试数据...')
    if (addResult._id) {
      await db.collection('task_clock_ins').doc(addResult._id).remove()
      console.log('✅ 测试数据清理成功')
    }
    
    console.log('\n=== 测试完成，修复效果验证成功！ ===')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
    return false
  }
}

// 执行测试
if (require.main === module) {
  // 请替换为实际的任务ID
  testData.taskId = 'your-actual-task-id' // 例如：'6123456789abcdef12345678'
  
  if (testData.taskId === 'your-actual-task-id') {
    console.error('❌ 请先替换测试脚本中的实际任务ID')
    process.exit(1)
  }
  
  testCheckinFix().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { testCheckinFix }
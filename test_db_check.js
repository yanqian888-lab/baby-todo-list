// 数据库检查脚本
// 用于检查task_clock_ins集合中的记录，验证taskId格式是否一致

const cloud = require('wx-server-sdk')

// 初始化云函数环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 测试函数
async function checkDatabase() {
  console.log('=== 开始检查数据库 ===')
  
  try {
    // 1. 查询task_clock_ins集合中的记录
    console.log('\n1. 查询task_clock_ins集合中的记录...')
    const result = await db.collection('task_clock_ins')
      .orderBy('checkinTime', 'desc')
      .limit(10) // 只查询最近10条记录
      .get()
    
    console.log('✅ 查询到的记录数量:', result.data.length)
    
    // 2. 检查每条记录的taskId格式
    console.log('\n2. 检查记录的taskId格式...')
    result.data.forEach((record, index) => {
      console.log(`\n记录 ${index + 1}:`)
      console.log('  _id:', record._id)
      console.log('  taskId:', record.taskId)
      console.log('  taskId.trim():', record.taskId.trim())
      console.log('  长度:', record.taskId.length)
      console.log('  trim后长度:', record.taskId.trim().length)
      console.log('  首尾空格:', `"${record.taskId.match(/^\s+|\s+$/g) || []}"`)
      console.log('  checkinCount:', record.checkinCount)
      console.log('  checkinTime:', record.checkinTime)
    })
    
    // 3. 检查tasks集合中的记录
    console.log('\n3. 查询tasks集合中的记录...')
    const tasksResult = await db.collection('tasks')
      .orderBy('createTime', 'desc')
      .limit(5) // 只查询最近5条记录
      .get()
    
    console.log('✅ 查询到的任务数量:', tasksResult.data.length)
    
    // 4. 检查每条任务的taskId格式
    console.log('\n4. 检查任务的taskId格式...')
    tasksResult.data.forEach((task, index) => {
      console.log(`\n任务 ${index + 1}:`)
      console.log('  _id:', task._id)
      console.log('  title:', task.title)
      console.log('  checkins:', task.checkins)
      console.log('  cycleTimes:', task.cycleTimes)
      console.log('  status:', task.status)
    })
    
    console.log('\n=== 数据库检查完成 ===')
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error)
    return false
  }
}

// 执行检查
if (require.main === module) {
  checkDatabase().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { checkDatabase }
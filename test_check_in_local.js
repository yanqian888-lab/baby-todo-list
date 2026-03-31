// 本地测试打卡功能逻辑
const path = require('path')

// 模拟数据库操作
class MockDB {
  constructor() {
    this.collections = new Map()
  }
  
  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection())
    }
    return this.collections.get(name)
  }
}

class MockCollection {
  constructor() {
    this.documents = []
  }
  
  where(query) {
    return {
      orderBy: (field, direction) => {
        return {
          get: async () => {
            // 模拟查询逻辑
            let result = this.documents.filter(doc => {
              if (query.taskId && doc.taskId !== query.taskId) return false
              if (query.completedAt) {
                if (query.completedAt._gte && doc.completedAt < query.completedAt._gte) return false
                if (query.completedAt._lt && doc.completedAt >= query.completedAt._lt) return false
              }
              return true
            })
            
            // 模拟排序
            if (field) {
              result.sort((a, b) => {
                if (direction === 'desc') {
                  return b[field] - a[field]
                } else {
                  return a[field] - b[field]
                }
              })
            }
            
            return { data: result }
          }
        }
      }
    }
  }
  
  add(data) {
    // 模拟添加文档
    this.documents.push({
      ...data,
      _id: `doc_${Date.now()}`,
      completedAt: data.completedAt || Date.now()
    })
    return Promise.resolve({ _id: `doc_${Date.now()}` })
  }
  
  getDocuments() {
    return this.documents
  }
}

// 模拟云开发环境
const mockDB = new MockDB()
const mockWxContext = { OPENID: 'test_openid' }

// 测试函数：模拟getTaskClockIns云函数逻辑
async function mockGetTaskClockIns(taskId, todayOnly = true) {
  console.log('\n=== 模拟 getTaskClockIns ===')
  console.log('参数:', { taskId, todayOnly })
  
  try {
    const db = mockDB
    
    // 构建查询
    let query = { taskId }
    
    if (todayOnly) {
      // 计算今日时间范围
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      console.log('今日时间范围:', {
        today: today.getTime(),
        tomorrow: tomorrow.getTime()
      })
      
      query.completedAt = { _gte: today.getTime(), _lt: tomorrow.getTime() }
    }
    
    // 执行查询
    const result = await db.collection('task_completions')
      .where(query)
      .orderBy('completedAt', 'desc')
      .get()
    
    const clockIns = result.data || []
    const todayCount = clockIns.length
    
    console.log('查询结果:', {
      clockIns,
      todayCount
    })
    
    return { success: true, data: { clockIns, todayCount } }
  } catch (error) {
    console.error('模拟查询失败:', error)
    return { success: false, error: error.message }
  }
}

// 测试函数：模拟updateTaskStatus云函数逻辑
async function mockUpdateTaskStatus(taskId, status = 'pending') {
  console.log('\n=== 模拟 updateTaskStatus ===')
  console.log('参数:', { taskId, status })
  
  try {
    const db = mockDB
    
    // 模拟添加打卡记录
    await db.collection('task_completions').add({
      taskId,
      _openid: mockWxContext.OPENID,
      completedAt: Date.now(),
      checkins: 1,
      cycleTimes: 1,
      isAllCompleted: status === 'completed'
    })
    
    console.log('打卡记录添加成功')
    return { success: true, message: '任务状态更新成功' }
  } catch (error) {
    console.error('模拟打卡失败:', error)
    return { success: false, error: error.message }
  }
}

// 主测试流程
async function main() {
  console.log('=== 开始测试打卡流程 ===')
  
  const testTaskId = 'test_task_001'
  
  // 1. 查看初始打卡次数
  const initialResult = await mockGetTaskClockIns(testTaskId)
  const initialCount = initialResult.data.todayCount
  console.log('\n初始打卡次数:', initialCount)
  
  // 2. 执行打卡操作
  await mockUpdateTaskStatus(testTaskId)
  
  // 3. 再次查看打卡次数
  const afterResult = await mockGetTaskClockIns(testTaskId)
  const afterCount = afterResult.data.todayCount
  console.log('\n打卡后次数:', afterCount)
  
  // 4. 验证结果
  if (afterCount === initialCount + 1) {
    console.log('\n✅ 测试通过！打卡后次数正确增加')
  } else {
    console.log('\n❌ 测试失败！打卡后次数没有增加')
    console.log('   预期:', initialCount + 1)
    console.log('   实际:', afterCount)
  }
  
  // 5. 查看所有打卡记录
  console.log('\n所有打卡记录:', mockDB.collection('task_completions').getDocuments())
}

// 执行测试
main()
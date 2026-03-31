// 云函数：获取用户打卡统计信息
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

/**
 * 确保集合存在（通过创建文档的方式隐式创建）
 * @param {string} collectionName - 集合名称
 */
async function ensureCollectionExists(collectionName) {
  try {
    console.log(`🔍 开始检查集合: ${collectionName}`)
    
    // 直接尝试创建测试文档来确保集合存在
    // 这是最可靠的方式，因为即使count()失败，创建文档也能成功创建集合
    const testDocId = `test_${Date.now()}`
    await db.collection(collectionName).doc(testDocId).set({
      data: {
        test: true,
        createdAt: db.serverDate(),
        openid: 'test_openid'
      }
    })
    
    // 删除测试文档
    await db.collection(collectionName).doc(testDocId).remove()
    
    console.log(`✅ ${collectionName} 集合已成功确保存在`)
    return true
  } catch (error) {
    console.error(`❌ 处理 ${collectionName} 集合时发生错误:`, error)
    return false
  }
}

exports.main = async (event, context) => {
  console.log('📥 接收到getUserStatistics云函数请求:', event)
  
  const wxContext = cloud.getWXContext()
  // 优先从微信上下文获取openid，如果没有则从请求参数中获取
  let openid = wxContext.OPENID;
  
  // 如果上下文没有openid，尝试从请求参数中获取
  if (!openid && event.openid) {
    openid = event.openid;
  }
  
  try {
    // 检查openid是否存在
    if (!openid) {
      console.log('❌ 用户未登录或openid获取失败')
      return {
        success: false,
        error: '用户未登录或openid获取失败'
      }
    }
    
    console.log('✅ 成功获取openid:', openid)
    
    // 1. 确保users集合存在，然后获取用户统计信息
    await ensureCollectionExists('users')
    let userRes
    try {
      userRes = await db.collection('users').where({
        openid: openid
      }).get()
      console.log('✅ 获取用户信息成功:', userRes.data.length)
    } catch (error) {
      console.error('❌ 获取用户信息失败:', error)
      // 如果获取用户信息失败，返回默认值
      return {
        success: true,
        today: { checked: false, time: '' },
        streakDays: 0,
        totalDays: 0,
        lastCheckin: ''
      }
    }
    
    // 如果用户不存在，返回默认值
    if (userRes.data.length === 0) {
      console.log('ℹ️ 用户不存在，返回默认统计信息')
      return {
        success: true,
        today: { checked: false, time: '' },
        streakDays: 0,
        totalDays: 0,
        lastCheckin: ''
      }
    }
    
    const userInfo = userRes.data[0]
    
    // 2. 从task_completions集合获取所有打卡记录
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // 不再需要确保clockIns集合存在
    // await ensureCollectionExists('clockIns')
    let todayCheckinRes, lastCheckinRes, allClockInsRes
    try {
      // 获取用户所有任务完成记录
      const taskCompletionsRes = await db.collection('task_completions').where({
        _openid: openid
      }).orderBy('completedAt', 'desc').get()
      console.log('✅ 任务完成记录查询成功:', taskCompletionsRes.data.length)
      
      // 过滤今日打卡记录
      todayCheckinRes = {
        data: taskCompletionsRes.data.filter(item => {
          const completedAt = new Date(item.completedAt)
          return completedAt >= today && completedAt < tomorrow
        })
      }
      console.log('✅ 今日打卡记录过滤成功:', todayCheckinRes.data.length)
      
      // 获取最新打卡记录
      lastCheckinRes = {
        data: taskCompletionsRes.data.slice(0, 1)
      }
      console.log('✅ 最新打卡记录过滤成功:', lastCheckinRes.data.length)
      
      // 获取所有打卡记录，用于计算连续打卡天数
      allClockInsRes = taskCompletionsRes
      console.log('✅ 所有打卡记录准备完成')
    } catch (error) {
      console.error('❌ 打卡记录查询失败:', error)
      // 如果查询失败，使用默认值
      todayCheckinRes = { data: [] }
      lastCheckinRes = { data: [] }
      allClockInsRes = { data: [] }
    }
    
    // 3. 计算连续打卡天数
    let streakDays = 0
    const clockIns = allClockInsRes.data
    
    if (clockIns.length > 0) {
      // 按日期排序（确保是降序）
      const sortedClockIns = [...clockIns].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      
      // 获取所有打卡日期（去重）
      const clockInDates = new Set()
      sortedClockIns.forEach(clockIn => {
        const date = new Date(clockIn.completedAt)
        date.setHours(0, 0, 0, 0)
        clockInDates.add(date.toISOString())
      })
      
      // 转换为排序后的日期数组（降序）
      const uniqueDates = Array.from(clockInDates)
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => b - a)
      
      // 计算连续天数
      if (uniqueDates.length > 0) {
        streakDays = 1
        let currentDate = new Date(uniqueDates[0])
        
        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDate = new Date(uniqueDates[i])
          // 计算两个日期之间的天数差（不考虑时间部分）
          const diffTime = currentDate.getTime() - prevDate.getTime()
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          
          if (diffDays === 1) {
            streakDays++
            currentDate = prevDate
          } else {
            break
          }
        }
        
        // 如果今天没有打卡，我们需要调整连续打卡天数
        const hasCheckedInToday = todayCheckinRes.data.length > 0
        const lastClockInDate = new Date(uniqueDates[0])
        lastClockInDate.setHours(0, 0, 0, 0)
        
        if (!hasCheckedInToday) {
          // 检查最后一次打卡是否是昨天
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          yesterday.setHours(0, 0, 0, 0)
          
          if (lastClockInDate.getTime() !== yesterday.getTime()) {
            // 如果最后一次打卡不是昨天，连续记录应该从最后一次打卡开始计算
            // 重新计算连续天数，从最后一次打卡开始
            streakDays = 1
            let tempCurrentDate = new Date(uniqueDates[0])
            
            for (let i = 1; i < uniqueDates.length; i++) {
              const prevDate = new Date(uniqueDates[i])
              // 计算两个日期之间的天数差（不考虑时间部分）
              const diffTime = tempCurrentDate.getTime() - prevDate.getTime()
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
              
              if (diffDays === 1) {
                streakDays++
                tempCurrentDate = prevDate
              } else {
                break
              }
            }
          } else {
            // 如果最后一次打卡是昨天，连续天数保持不变
            // 不需要做任何处理
          }
        }
      }
    }
    
    // 4. 确保tasks集合存在，然后获取用户任务统计
    await ensureCollectionExists('tasks')
    let totalTasksCount = 0, completedTasksCount = 0
    try {
      const totalTasks = await db.collection('tasks').where({
        _openid: openid
      }).count()
      totalTasksCount = totalTasks.total || 0
      console.log('✅ 任务总数查询成功:', totalTasksCount)
      
      const completedTasks = await db.collection('tasks').where({
        _openid: openid,
        status: 'completed'
      }).count()
      completedTasksCount = completedTasks.total || 0
      console.log('✅ 已完成任务数查询成功:', completedTasksCount)
    } catch (error) {
      console.error('❌ 任务统计查询失败:', error)
    }
    
    // 5. 更新用户集合中的统计数据
    const totalClockIns = clockIns.length
    try {
      await db.collection('users').doc(userInfo._id).update({
        data: {
          statistics: {
            streakDays: streakDays,
            totalClockIns: totalClockIns,
            updatedTime: db.serverDate()
          }
        }
      })
      console.log('✅ 用户统计数据已更新')
    } catch (error) {
      console.error('❌ 更新用户统计数据失败:', error)
    }
    
    // 6. 构建返回数据
    const todayData = todayCheckinRes.data.length > 0 ? {
      checked: true,
      time: formatTime(todayCheckinRes.data[0].completedAt)
    } : { checked: false, time: '' }
    
    const lastCheckin = lastCheckinRes.data.length > 0 ? 
      formatDate(lastCheckinRes.data[0].completedAt) : ''
    
    const resultData = {
      success: true,
      data: {
        totalTasks: totalTasksCount,
        completedTasks: completedTasksCount,
        streakDays: streakDays,
        totalDays: totalClockIns,
        lastCheckin: lastCheckin,
        today: todayData
      }
    }
    
    console.log('📤 返回用户统计信息:', resultData)
    return resultData
  } catch (error) {
    console.error('获取用户统计信息失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 格式化时间为时分
function formatTime(date) {
  const d = new Date(date)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// 格式化日期为年月日
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}
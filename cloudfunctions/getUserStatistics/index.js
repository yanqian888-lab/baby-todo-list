// 云函数：获取用户打卡统计信息
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  console.log('📥 接收到getUserStatistics云函数请求:', event)
  
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid;
  
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
    
    // 1. 获取用户统计信息
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
    
    const familyId = event.familyId || null;
    if (familyId) {
      // 校验调用者是否为家庭成员，防止跨家庭统计泄露
      const familyRes = await db.collection('families').doc(familyId).get().catch(() => null);
      const family = familyRes ? familyRes.data : null;
      const isMember = family && (family.members || []).some(m => m.openId === openid);
      const isCreator = family && family.creatorOpenId === openid;
      if (!isMember && !isCreator) {
        return {
          success: false,
          error: '没有权限查看该家庭的统计'
        };
      }
      console.log('🔍 使用家庭ID过滤统计数据:', familyId)
    }

    // 2. 从task_completions集合获取所有打卡记录
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let todayCheckinRes, lastCheckinRes, allClockInsRes
    try {
      const taskCompletionsQuery = {}
      if (familyId) {
        taskCompletionsQuery.familyId = familyId
      } else {
        taskCompletionsQuery._openid = openid
      }
      // 获取用户所有任务完成记录
      const taskCompletionsRes = await db.collection('task_completions')
        .where(taskCompletionsQuery)
        .orderBy('completedAt', 'desc')
        .limit(1000)
        .get()
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
    
    // 4. 获取用户任务统计
    let totalTasksCount = 0, completedTasksCount = 0
    try {
      // 4.1 构建任务查询条件
      const taskQuery = {}
      if (familyId) {
        // 如果指定了家庭ID，只统计该家庭的任务
        taskQuery.familyId = familyId
      } else {
        // 未指定家庭时，统计用户关联的所有家庭的任务
        const familiesRes = await db.collection('families').where(_.or([
          { creatorOpenId: openid },
          { 'members.openId': openid }
        ])).get()
        const familyIds = familiesRes.data.map(f => f._id)
        console.log('✅ 查询到用户关联的家庭数:', familyIds.length, '家庭IDs:', familyIds)
        
        if (familyIds.length > 0) {
          taskQuery.familyId = _.in(familyIds)
        } else {
          // 兜底：没有家庭时按用户openid查询
          taskQuery._openid = openid
        }
      }
      
      // 统计总任务数（排除已删除）
      const totalTasks = await db.collection('tasks').where({ ...taskQuery, status: _.neq('deleted') }).count()
      totalTasksCount = totalTasks.total || 0
      console.log('✅ 任务总数查询成功:', totalTasksCount)
      
      // 已完成任务数：按 tasks.status === 'completed' 统计，与任务管理页对齐
      const completedTasks = await db.collection('tasks').where({ ...taskQuery, status: 'completed' }).count()
      completedTasksCount = completedTasks.total || 0
      console.log('✅ 已完成任务数查询成功(按status=completed):', completedTasksCount)
    } catch (error) {
      console.error('❌ 任务统计查询失败:', error)
    }
    
    // 5. 更新用户集合中的统计数据
    const totalClockIns = clockIns.length
    try {
      await db.collection('users').doc(userInfo._id).update({
        data: {
          'statistics.streakDays': streakDays,
          'statistics.totalClockIns': totalClockIns,
          'statistics.updatedTime': db.serverDate()
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
// 测试脚本，用于诊断已完成任务和连续打卡天数问题
const cloud = require('wx-server-sdk');
const db = cloud.database();

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 模拟事件参数
const mockEvent = {
  status: 'completed',
  includeCompleted: true,
  pageSize: 100,
  pageNum: 1
};

// 测试getTasks云函数
async function test_getTasks() {
  console.log('=== 测试getTasks云函数 ===');
  
  try {
    // 解析参数
    const status = mockEvent.status || 'pending';
    const includeCompleted = mockEvent.includeCompleted || false;
    
    // 获取当前日期信息
    const today = new Date();
    const todayWeekdayNum = today.getDay(); // 0-6，0表示周日
    const todayWeekdayStr = todayWeekdayNum.toString();
    const todayDateNum = today.getDate(); // 1-31
    const todayDateStr = todayDateNum.toString();
    
    console.log('事件参数:', JSON.stringify(mockEvent, null, 2));
    console.log('status:', status);
    console.log('includeCompleted:', includeCompleted);
    console.log('今天星期几(数字):', todayWeekdayNum);
    console.log('今天星期几(字符串):', todayWeekdayStr);
    console.log('今天日期(数字):', todayDateNum);
    console.log('今天日期(字符串):', todayDateStr);
    
    // 构建查询条件
    let query = db.collection('tasks');
    
    // 根据status参数过滤任务
    if (status === 'pending') {
      query = query.where({
        status: 'pending'
      });
    } else if (status === 'completed') {
      query = query.where({
        status: 'completed'
      });
    }
    
    // 查询任务总数
    const totalTasksResult = await query.count();
    const totalTasksCount = totalTasksResult.total;
    console.log('任务总数:', totalTasksCount);
    
    // 计算分页
    const pageSize = mockEvent.pageSize || 100;
    const pageNum = mockEvent.pageNum || 1;
    const skip = (pageNum - 1) * pageSize;
    
    // 查询任务列表
    const tasksResult = await query
      .skip(skip)
      .limit(pageSize)
      .get();
    const allTasks = tasksResult.data;
    console.log('查询到的任务数:', allTasks.length);
    
    // 过滤任务，只返回需要的任务
    const filteredTasks = allTasks.filter(task => {
      // 已完成的任务直接返回
      if (mockEvent.status === 'completed' || task.status === 'completed') {
        return true;
      }
      
      // 非循环任务直接返回
      if (!task.frequency || task.frequency === 'none') {
        return true;
      }
      
      // 每日循环任务直接返回
      if (task.frequency === 'daily') {
        return true;
      }
      
      // 每周循环任务
      if (task.frequency === 'weekly') {
        // 从task中获取selectedDays字符串
        let selectedDaysStr = task.selectedDays || '[]';
        
        // 尝试将字符串解析为数组
        let selectedDaysArray = [];
        try {
          selectedDaysArray = JSON.parse(selectedDaysStr);
        } catch (error) {
          console.error('解析selectedDays失败:', selectedDaysStr);
          return false;
        }
        
        // 检查今天是否在选中的星期几中
        // 这里使用了双重检查，确保无论selectedDaysArray中的元素是字符串还是数字都能正确匹配
        return selectedDaysArray.includes(todayWeekdayStr) || selectedDaysArray.includes(todayWeekdayNum);
      }
      
      // 每月循环任务
      if (task.frequency === 'monthly') {
        // 从task中获取selectedMonthDays字符串
        let selectedMonthDaysStr = task.selectedMonthDays || '[]';
        
        // 尝试将字符串解析为数组
        let selectedMonthDaysArray = [];
        try {
          selectedMonthDaysArray = JSON.parse(selectedMonthDaysStr);
        } catch (error) {
          console.error('解析selectedMonthDays失败:', selectedMonthDaysStr);
          return false;
        }
        
        // 检查今天是否在选中的月份日期中
        return selectedMonthDaysArray.includes(todayDateStr) || selectedMonthDaysArray.includes(todayDateNum);
      }
      
      // 默认返回false
      return false;
    });
    
    console.log('过滤后的任务数:', filteredTasks.length);
    console.log('过滤后的任务:', JSON.stringify(filteredTasks, null, 2));
    
    return {
      success: true,
      tasks: filteredTasks,
      total: totalTasksCount,
      hasMore: totalTasksCount > (pageNum * pageSize)
    };
  } catch (error) {
    console.error('测试getTasks失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 辅助函数：格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 测试getUserStatistics云函数
async function test_getUserStatistics() {
  console.log('\n=== 测试getUserStatistics云函数 ===');
  
  try {
    // 获取当前用户信息
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 查询用户信息
    const userInfoQuery = await db.collection('users')
      .where({
        openid: openid
      })
      .get();
    const userInfo = userInfoQuery.data[0] || null;
    
    if (!userInfo) {
      console.error('未找到用户信息');
      return {
        success: false,
        error: '未找到用户信息'
      };
    }
    
    console.log('用户信息:', JSON.stringify(userInfo, null, 2));
    
    // 获取今天的日期字符串
    const today = new Date();
    const todayStr = formatDate(today);
    
    // 查询今日打卡记录
    const todayCheckinQuery = await db.collection('taskClockIns')
      .where({
        userId: userInfo.openid,
        date: todayStr
      })
      .get();
    const todayCheckin = todayCheckinQuery.data[0] || null;
    
    // 查询最新打卡记录
    const latestCheckinQuery = await db.collection('taskClockIns')
      .where({
        userId: userInfo.openid
      })
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    const latestCheckin = latestCheckinQuery.data[0] || null;
    
    // 查询所有打卡记录
    const allCheckinsQuery = await db.collection('taskClockIns')
      .where({
        userId: userInfo.openid
      })
      .orderBy('date', 'desc')
      .get();
    const allCheckins = allCheckinsQuery.data || [];
    
    console.log('今日打卡记录:', JSON.stringify(todayCheckin, null, 2));
    console.log('最新打卡记录:', JSON.stringify(latestCheckin, null, 2));
    console.log('所有打卡记录数:', allCheckins.length);
    console.log('所有打卡记录:', JSON.stringify(allCheckins, null, 2));
    
    // 计算连续打卡天数
    let streakDays = 0;
    const uniqueDates = [...new Set(allCheckins.map(checkin => checkin.date))].sort((a, b) => new Date(b) - new Date(a));
    
    console.log('去重后的打卡日期:', JSON.stringify(uniqueDates, null, 2));
    
    if (uniqueDates.length > 0) {
      // 检查今天是否打卡
      const isCheckedToday = uniqueDates[0] === todayStr;
      
      // 如果今天打卡了，从今天开始计算连续天数
      if (isCheckedToday) {
        streakDays = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const currentDate = new Date(uniqueDates[i - 1]);
          const previousDate = new Date(uniqueDates[i]);
          
          // 计算日期差
          const diffTime = Math.abs(currentDate - previousDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            streakDays++;
          } else {
            break;
          }
        }
      } 
      // 如果今天没打卡，从昨天开始计算连续天数
      else {
        const yesterdayStr = formatDate(new Date(Date.now() - 86400000));
        if (uniqueDates[0] === yesterdayStr) {
          streakDays = 1;
          for (let i = 1; i < uniqueDates.length; i++) {
            const currentDate = new Date(uniqueDates[i - 1]);
            const previousDate = new Date(uniqueDates[i]);
            
            // 计算日期差
            const diffTime = Math.abs(currentDate - previousDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
              streakDays++;
            } else {
              break;
            }
          }
        }
      }
    }
    
    console.log('连续打卡天数:', streakDays);
    
    // 查询任务统计
    const tasksQuery = await db.collection('tasks')
      .where({
        userId: userInfo.openid
      })
      .get();
    const allTasks = tasksQuery.data || [];
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter(task => task.status === 'completed').length;
    
    console.log('任务总数:', totalTasksCount);
    console.log('已完成任务数:', completedTasksCount);
    
    // 更新用户统计信息
    const lastCheckin = latestCheckin || null;
    const lastCheckinStr = lastCheckin ? lastCheckin.date : '';
    const todayChecked = todayCheckin ? true : false;
    const todayCheckinTime = todayCheckin ? todayCheckin.createdAt : '';
    
    await db.collection('users').doc(userInfo._id).update({
      data: {
        statistics: {
          streakDays: streakDays,
          totalDays: uniqueDates.length,
          lastCheckin: lastCheckinStr,
          today: {
            checked: todayChecked,
            time: todayCheckinTime
          },
          updatedAt: new Date()
        }
      }
    });
    
    // 返回结果
    return {
      success: true,
      data: {
        streakDays: streakDays,
        totalDays: uniqueDates.length,
        lastCheckin: lastCheckinStr,
        today: {
          checked: todayChecked,
          time: todayCheckinTime
        }
      }
    };
  } catch (error) {
    console.error('测试getUserStatistics失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行测试
async function runTests() {
  console.log('开始运行测试...');
  
  // 测试getTasks云函数
  const getTasksResult = await test_getTasks();
  console.log('\ngetTasks测试结果:', JSON.stringify(getTasksResult, null, 2));
  
  // 测试getUserStatistics云函数
  const getUserStatisticsResult = await test_getUserStatistics();
  console.log('\ngetUserStatistics测试结果:', JSON.stringify(getUserStatisticsResult, null, 2));
  
  console.log('\n测试完成!');
}

// 执行测试
runTests();
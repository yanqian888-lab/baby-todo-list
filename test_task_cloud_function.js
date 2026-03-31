// 测试云函数行为的脚本
// 这个脚本模拟微信小程序端调用云函数的行为，帮助调试问题

console.log('开始测试云函数行为...');

// 模拟任务数据 - 用于测试过滤逻辑
const mockTasks = [
  {
    _id: 'task1',
    _openid: 'test_openid',
    title: '测试非循环任务',
    status: 'pending',
    frequency: 'none',
    createTime: new Date().toISOString(),
    isTemplate: false
  },
  {
    _id: 'task2', 
    _openid: 'test_openid',
    title: '测试每日循环任务',
    status: 'pending', 
    frequency: 'daily',
    createTime: new Date().toISOString(),
    isTemplate: false
  },
  {
    _id: 'task3',
    _openid: 'test_openid',
    title: '测试每周循环任务',
    status: 'pending',
    frequency: 'weekly',
    selectedDays: [String(new Date().getDay())], // 今天的星期
    createTime: new Date().toISOString(),
    isTemplate: false
  },
  {
    _id: 'task4',
    _openid: 'test_openid', 
    title: '测试每月循环任务',
    status: 'pending',
    frequency: 'monthly',
    selectedMonthDays: [new Date().getDate()], // 今天的日期
    createTime: new Date().toISOString(),
    isTemplate: false
  }
];

console.log('模拟任务数据:');
mockTasks.forEach(task => {
  console.log(`- ${task.title} (${task.frequency}, ${task.status})`);
});

// 模拟修复后的getTasks云函数逻辑
function simulateGetTasks(event) {
  const { status = 'pending', includeCompleted = false } = event;
  
  console.log('\n模拟getTasks云函数调用:');
  console.log(`- 状态过滤: ${status}`);
  console.log(`- 包含已完成: ${includeCompleted}`);
  
  // 第一步：过滤出指定openid的任务（这里使用模拟数据中的test_openid）
  let filteredTasks = mockTasks.filter(task => task._openid === 'test_openid' && task.status !== 'deleted' && !task.isTemplate);
  
  // 第二步：过滤今天需要执行的任务
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const todayDateOfMonth = now.getDate();
  
  filteredTasks = filteredTasks.filter(task => {
    if (task.frequency === 'none' || !task.frequency) {
      return true; // 非循环任务直接返回
    } else if (task.frequency === 'daily') {
      return true; // 每日循环任务直接返回
    } else if (task.frequency === 'weekly' && task.selectedDays) {
      // 检查是否包含今天的星期
      return task.selectedDays.some(day => String(day) === String(todayDayOfWeek));
    } else if (task.frequency === 'monthly' && task.selectedMonthDays) {
      // 检查是否包含今天的日期
      return task.selectedMonthDays.includes(todayDateOfMonth);
    }
    return false;
  });
  
  // 第三步：根据状态过滤
  let finalTasks = filteredTasks;
  
  if (status && status !== 'all') {
    finalTasks = finalTasks.filter(task => task.status === status);
  }
  
  if (!includeCompleted) {
    finalTasks = finalTasks.filter(task => task.status !== 'completed');
  }
  
  console.log(`过滤后的任务数量: ${finalTasks.length}`);
  finalTasks.forEach(task => {
    console.log(`- ${task.title} (${task.frequency}, ${task.status})`);
  });
  
  return {
    success: true,
    total: finalTasks.length,
    tasks: finalTasks
  };
}

// 测试不同场景
console.log('\n=== 测试场景1: 获取待办任务 ===');
simulateGetTasks({ status: 'pending' });

console.log('\n=== 测试场景2: 包含已完成任务 ===');
simulateGetTasks({ status: 'pending', includeCompleted: true });

console.log('\n=== 测试场景3: 只获取已完成任务 ===');
// 添加一个已完成任务用于测试
simulateGetTasks({ status: 'completed' });

console.log('\n测试完成！请对比这些结果与您的云函数实际行为。');
console.log('\n修复要点总结:');
console.log('1. 将查询条件中的openid改为_openid');
console.log('2. 确保正确处理任务过滤逻辑');
console.log('3. 返回正确的任务总数');
console.log('\n请部署修复后的云函数并重启小程序测试实际效果。');
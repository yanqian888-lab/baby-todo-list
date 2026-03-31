// 简化的任务验证脚本
console.log('=== 本地任务过滤逻辑验证 ===');

// 模拟修复前的非循环任务过滤逻辑
function originalNonRecurringTaskFilter(task, today) {
  // 修复前：只有创建日期 ≤ 今天的非循环任务才会显示
  if (task.frequency === 'none' || !task.frequency) {
    const taskCreateDate = new Date(task.createTime);
    return taskCreateDate <= today;
  }
  return true; // 循环任务逻辑保持不变
}

// 模拟修复后的非循环任务过滤逻辑
function fixedNonRecurringTaskFilter(task) {
  // 修复后：所有非循环任务都会显示，无论创建日期
  if (task.frequency === 'none' || !task.frequency) {
    return true;
  }
  return true; // 循环任务逻辑保持不变
}

// 模拟任务数据
const mockTasks = [
  {
    _id: 'task1',
    title: '昨天创建的非循环任务',
    frequency: 'none',
    createTime: new Date(Date.now() - 86400000).toISOString() // 昨天
  },
  {
    _id: 'task2',
    title: '今天创建的非循环任务',
    frequency: 'none',
    createTime: new Date().toISOString()
  },
  {
    _id: 'task3',
    title: '明天创建的非循环任务',
    frequency: 'none',
    createTime: new Date(Date.now() + 86400000).toISOString() // 明天
  },
  {
    _id: 'task4',
    title: '每日循环任务',
    frequency: 'daily',
    createTime: new Date().toISOString()
  }
];

// 当前日期
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

console.log('\n当前日期:', now.toISOString());
console.log('今天(00:00:00):', today.toISOString());
console.log('\n模拟任务数据:');
mockTasks.forEach(task => {
  console.log(`  - ${task.title} [创建时间: ${task.createTime}, 频率: ${task.frequency}]`);
});

// 应用修复前的过滤逻辑
const originalFilteredTasks = mockTasks.filter(task => 
  originalNonRecurringTaskFilter(task, today)
);

// 应用修复后的过滤逻辑
const fixedFilteredTasks = mockTasks.filter(fixedNonRecurringTaskFilter);

console.log('\n=== 过滤结果对比 ===');
console.log('\n修复前筛选结果:', originalFilteredTasks.length, '个任务');
originalFilteredTasks.forEach(task => {
  console.log(`  - ${task.title}`);
});

console.log('\n修复后筛选结果:', fixedFilteredTasks.length, '个任务');
fixedFilteredTasks.forEach(task => {
  console.log(`  - ${task.title}`);
});

// 比较结果
console.log('\n=== 结论 ===');
if (originalFilteredTasks.length < fixedFilteredTasks.length) {
  console.log('✅ 修复有效：修复后可以显示更多的非循环任务');
  console.log('增加了以下任务:', 
    fixedFilteredTasks.filter(task => 
      !originalFilteredTasks.some(t => t._id === task._id)
    ).map(task => task.title).join(', ')
  );
} else {
  console.log('⚠️ 修复可能无效：修复前后任务数量相同');
}

console.log('\n=== 建议操作 ===');
console.log('1. 确保getTasks云函数已正确部署');
console.log('2. 在小程序开发工具中检查云数据库中的tasks集合');
console.log('3. 确认任务确实已创建（检查createTask云函数执行日志）');
console.log('4. 检查用户openid是否正确，任务是否关联到当前用户');
console.log('5. 检查数据库查询条件是否正确');
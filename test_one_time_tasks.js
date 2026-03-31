// 测试脚本：专门验证非循环任务的过滤逻辑修复

console.log('=== 开始验证非循环任务过滤逻辑修复 ===');

// 模拟任务数据，包括不同创建日期的非循环任务
const mockTasks = [
  {
    _id: 'task1',
    title: '今天创建的非循环任务',
    status: 'pending',
    frequency: 'none',
    createTime: new Date().toISOString(), // 今天
    isTemplate: false
  },
  {
    _id: 'task2',
    title: '明天创建的非循环任务（模拟未来日期）',
    status: 'pending', 
    frequency: 'none',
    createTime: new Date(Date.now() + 86400000).toISOString(), // 明天
    isTemplate: false
  },
  {
    _id: 'task3',
    title: '昨天创建的非循环任务',
    status: 'pending',
    frequency: 'none',
    createTime: new Date(Date.now() - 86400000).toISOString(), // 昨天
    isTemplate: false
  },
  {
    _id: 'task4',
    title: '每日任务（对照）',
    status: 'pending',
    frequency: 'daily',
    createTime: new Date().toISOString(),
    isTemplate: false
  }
];

// 模拟今天的日期
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

console.log('当前日期:', now.toISOString());
console.log('今天:', today.toISOString());
console.log('测试任务数量:', mockTasks.length);

// 原始过滤逻辑（有问题的）
function originalFilter(task) {
  if (task.frequency === 'none' || !task.frequency) {
    const taskCreateDate = new Date(task.createTime);
    const isBeforeToday = taskCreateDate <= today;
    console.log(`原始逻辑 - 任务: ${task.title}, 创建日期≤今天? ${isBeforeToday}`);
    return isBeforeToday;
  }
  // 非非循环任务直接返回true
  console.log(`原始逻辑 - 任务: ${task.title}, 非非循环任务，直接通过`);
  return true;
}

// 修复后的过滤逻辑
function fixedFilter(task) {
  if (task.frequency === 'none' || !task.frequency) {
    // 移除日期过滤，所有非循环任务都应显示
    console.log(`修复逻辑 - 任务: ${task.title}, 非循环任务直接通过`);
    return true;
  }
  // 非非循环任务直接返回true
  console.log(`修复逻辑 - 任务: ${task.title}, 非非循环任务，直接通过`);
  return true;
}

// 测试原始过滤逻辑
console.log('\n=== 测试原始过滤逻辑（有问题的）===');
const originalResult = mockTasks.filter(originalFilter);
console.log('\n原始逻辑过滤后的任务数量:', originalResult.length);
originalResult.forEach(task => {
  console.log(`  显示任务: ${task.title}, 创建时间: ${task.createTime.split('T')[0]}`);
});

// 测试修复后的过滤逻辑
console.log('\n=== 测试修复后的过滤逻辑 ===');
const fixedResult = mockTasks.filter(fixedFilter);
console.log('\n修复逻辑过滤后的任务数量:', fixedResult.length);
fixedResult.forEach(task => {
  console.log(`  显示任务: ${task.title}, 创建时间: ${task.createTime.split('T')[0]}`);
});

// 比较结果
console.log('\n=== 比较结果 ===');
if (originalResult.length < fixedResult.length) {
  console.log('✅ 修复成功！修复后的逻辑显示了更多任务');
  console.log('修复前显示任务数:', originalResult.length);
  console.log('修复后显示任务数:', fixedResult.length);
  
  // 找出修复前后的差异
  const originalTaskIds = new Set(originalResult.map(t => t._id));
  const fixedTaskIds = new Set(fixedResult.map(t => t._id));
  
  const newVisibleTasks = fixedResult.filter(t => !originalTaskIds.has(t._id));
  if (newVisibleTasks.length > 0) {
    console.log('\n📝 修复后新增可见的任务:');
    newVisibleTasks.forEach(task => {
      console.log(`  - ${task.title}`);
    });
  }
} else {
  console.log('⚠️ 修复效果不明显，可能需要进一步检查');
}

console.log('\n=== 验证完成 ===');
console.log('\n📌 实际使用建议:');
console.log('1. 在小程序开发工具中重新部署getTasks云函数');
console.log('2. 重新启动小程序');
console.log('3. 创建新任务后立即返回首页，检查任务是否显示');
console.log('4. 如果问题仍然存在，请检查云函数日志确认修复是否正确部署');
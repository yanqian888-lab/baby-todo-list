// 测试增强的任务排序逻辑
// 验证任务类型优先级和创建时间排序是否正确

// 模拟不同类型的任务数据
const tasks = [
  {
    _id: '1',
    title: '每日体重记录',
    frequency: 'daily',
    createTime: new Date('2024-01-01').toISOString()
  },
  {
    _id: '2',
    title: '每周产检',
    frequency: 'weekly',
    selectedDays: ['1', '3'], // 周一、周三
    createTime: new Date('2024-01-02').toISOString()
  },
  {
    _id: '3',
    title: '每月体检',
    frequency: 'monthly',
    selectedMonthDays: [15],
    createTime: new Date('2024-01-03').toISOString()
  },
  {
    _id: '4',
    title: '新建体重记录任务', // 模拟用户提到的新建体重记录任务
    frequency: 'none',
    createTime: new Date('2024-01-04').toISOString() // 最新创建
  },
  {
    _id: '5',
    title: '每日喂养记录',
    frequency: 'daily',
    createTime: new Date('2024-01-05').toISOString() // 最新的每日任务
  },
  {
    _id: '6',
    title: '每周游泳课',
    frequency: 'weekly',
    selectedDays: ['6'], // 周六
    createTime: new Date('2024-01-06').toISOString() // 最新的每周任务
  },
  {
    _id: '7',
    title: '偶尔记录的任务',
    frequency: 'none',
    createTime: new Date('2024-01-07').toISOString() // 最新的非循环任务
  }
];

// 模拟原始排序逻辑
function originalSort(tasks) {
  const sortedTasks = [...tasks];
  
  // 模拟原始排序：按nextCheckInDate升序排序
  // 这里简化处理，假设所有任务的nextCheckInDate都是创建日期
  return sortedTasks.sort((a, b) => {
    const dateA = new Date(a.createTime).getTime();
    const dateB = new Date(b.createTime).getTime();
    return dateA - dateB;
  });
}

// 增强的排序逻辑
function enhancedSort(tasks) {
  const sortedTasks = [...tasks];
  
  // 任务类型权重映射
  const frequencyWeights = {
    'daily': 4,
    'weekly': 3,
    'monthly': 2,
    'none': 1,
    null: 1 // 默认非循环任务
  };
  
  return sortedTasks.sort((a, b) => {
    // 获取任务类型权重
    const weightA = frequencyWeights[a.frequency] || frequencyWeights.none;
    const weightB = frequencyWeights[b.frequency] || frequencyWeights.none;
    
    // 首先按任务类型权重降序排序
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    
    // 同一类型内，按创建时间降序排序
    const createTimeA = new Date(a.createTime || Date.now()).getTime();
    const createTimeB = new Date(b.createTime || Date.now()).getTime();
    return createTimeB - createTimeA;
  });
}

// 运行测试
console.log('===== 原始排序结果（新建任务可能会排在前面）=====');
const originalSorted = originalSort(tasks);
originalSorted.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title} (${task.frequency}, 创建时间: ${task.createTime.split('T')[0]})`);
});

console.log('\n===== 增强排序结果（按类型优先级排序）=====');
const enhancedSorted = enhancedSort(tasks);
enhancedSorted.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title} (${task.frequency}, 创建时间: ${task.createTime.split('T')[0]})`);
});

// 特殊验证：新建体重记录任务是否不再排在最前面
const weightRecordTask = enhancedSorted.find(task => task._id === '4');
const weightRecordPosition = enhancedSorted.indexOf(weightRecordTask) + 1;

console.log(`\n===== 验证结果 =====`);
console.log(`新建体重记录任务（非循环）在增强排序中的位置: ${weightRecordPosition}`);
console.log(`是否正确地被每日和每周任务排在前面: ${weightRecordPosition > enhancedSorted.filter(t => t.frequency === 'daily').length}`);

// 验证任务类型分组是否正确
console.log('\n任务类型分组验证:');
const dailyTasks = enhancedSorted.filter(t => t.frequency === 'daily');
const weeklyTasks = enhancedSorted.filter(t => t.frequency === 'weekly');
const monthlyTasks = enhancedSorted.filter(t => t.frequency === 'monthly');
const noneTasks = enhancedSorted.filter(t => t.frequency === 'none');

console.log(`1. 每日任务数量: ${dailyTasks.length}`);
dailyTasks.forEach((task, index) => {
  console.log(`   ${index + 1}. ${task.title} (创建时间: ${task.createTime.split('T')[0]})`);
});

console.log(`\n2. 每周任务数量: ${weeklyTasks.length}`);
weeklyTasks.forEach((task, index) => {
  console.log(`   ${index + 1}. ${task.title} (创建时间: ${task.createTime.split('T')[0]})`);
});

console.log(`\n3. 每月任务数量: ${monthlyTasks.length}`);
monthlyTasks.forEach((task, index) => {
  console.log(`   ${index + 1}. ${task.title} (创建时间: ${task.createTime.split('T')[0]})`);
});

console.log(`\n4. 非循环任务数量: ${noneTasks.length}`);
noneTasks.forEach((task, index) => {
  console.log(`   ${index + 1}. ${task.title} (创建时间: ${task.createTime.split('T')[0]})`);
});
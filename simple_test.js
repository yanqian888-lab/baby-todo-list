// 简单的测试脚本，演示修复前后的查询逻辑差异

console.log('=== 演示修复前后的查询逻辑差异 ===\n');

// 修复前的错误逻辑
console.log('1. 修复前的错误逻辑：');
const taskId = 'test_task_001';
const todayOnly = true;

// 修复前：连续调用where会覆盖前一个条件
let basicQuery = {
  collection: 'task_completions',
  where: { taskId: taskId },
  orderBy: 'completedAt desc'
};

if (todayOnly) {
  // 这里的where会覆盖前面的where条件
  basicQuery = {
    ...basicQuery,
    where: { completedAt: { gte: '2024-01-01', lt: '2024-01-02' } }
  };
}

console.log('   修复前的最终查询条件:', JSON.stringify(basicQuery, null, 2));
console.log('   问题：taskId条件被覆盖了，查询不到指定任务的记录！\n');

// 修复后的正确逻辑
console.log('2. 修复后的正确逻辑：');

// 修复后：正确构建查询条件
let queryConditions = {};

// 始终包含taskId条件
queryConditions.taskId = taskId;

// 如果需要，添加时间范围条件
if (todayOnly) {
  queryConditions.completedAt = { gte: '2024-01-01', lt: '2024-01-02' };
}

const correctQuery = {
  collection: 'task_completions',
  where: queryConditions,
  orderBy: 'completedAt desc'
};

console.log('   修复后的最终查询条件:', JSON.stringify(correctQuery, null, 2));
console.log('   正确：taskId和时间范围条件都保留了！\n');

// 3. 总结
console.log('=== 修复总结 ===');
console.log('问题原因：getTaskClockIns云函数中连续调用where方法，导致taskId条件被覆盖');
console.log('修复方法：将查询条件正确合并，避免条件被覆盖');
console.log('修复效果：打卡记录能正确按taskId和时间范围查询，打卡次数会正确+1');
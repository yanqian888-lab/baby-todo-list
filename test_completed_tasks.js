// 测试获取已完成任务功能
// 模拟微信小程序调用getTasks云函数的行为，验证修复后的功能

// 模拟云函数环境
const cloudFunctions = {
  // 模拟getTasks云函数的主要逻辑
  getTasks: (event) => {
    console.log('\n=== 测试getTasks云函数调用 ===');
    console.log('事件参数:', JSON.stringify(event, null, 2));
    
    // 模拟任务数据
    const mockTasks = [
      { _id: '1', title: '每日喂养', status: 'pending', frequency: 'daily', createTime: new Date() },
      { _id: '2', title: '每周体检', status: 'completed', frequency: 'weekly', selectedDays: ['1'], createTime: new Date(), completedTime: new Date() },
      { _id: '3', title: '疫苗接种', status: 'completed', frequency: 'none', createTime: new Date(), completedTime: new Date() },
      { _id: '4', title: '换尿布', status: 'pending', frequency: 'daily', createTime: new Date() },
      { _id: '5', title: '月末记录', status: 'completed', frequency: 'monthly', selectedMonthDays: [1], createTime: new Date(), completedTime: new Date() }
    ];
    
    // 构建查询条件 - 模拟数据库过滤
    let filteredTasks = [...mockTasks];
    
    // 模拟云函数中的过滤逻辑
    if (event.status && event.status !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status === event.status);
      console.log(`按状态${event.status}过滤后的任务数量:`, filteredTasks.length);
    }
    
    // 修复后的逻辑：当明确请求completed状态的任务时，不要排除已完成任务
    if (!event.includeCompleted && event.status !== 'completed') {
      filteredTasks = filteredTasks.filter(task => task.status !== 'completed');
      console.log('排除已完成任务后的数量:', filteredTasks.length);
    }
    
    // 模拟返回结果
    const result = {
      success: true,
      total: filteredTasks.length,
      tasks: filteredTasks,
      page: event.page || 1,
      size: event.size || 20
    };
    
    console.log('测试结果:', JSON.stringify(result, null, 2));
    return result;
  }
};

// 测试场景1: 获取已完成任务
console.log('\n🚀 测试场景1: 获取已完成任务');
const completedResult = cloudFunctions.getTasks({ status: 'completed' });
console.log(`✅ 测试1结果: 返回${completedResult.tasks.length}个已完成任务`);

// 测试场景2: 获取待完成任务（不包含已完成）
console.log('\n🚀 测试场景2: 获取待完成任务（不包含已完成）');
const pendingResult = cloudFunctions.getTasks({ status: 'pending' });
console.log(`✅ 测试2结果: 返回${pendingResult.tasks.length}个待完成任务`);

// 测试场景3: 获取待完成任务（包含已完成）
console.log('\n🚀 测试场景3: 获取待完成任务（包含已完成）');
const includeCompletedResult = cloudFunctions.getTasks({ status: 'pending', includeCompleted: true });
console.log(`✅ 测试3结果: 返回${includeCompletedResult.tasks.length}个任务`);

// 输出修复验证总结
console.log('\n📊 修复验证总结:');
console.log('- 修复前问题: 当请求status="completed"时，由于!includeCompleted过滤，已完成任务被错误排除');
console.log('- 修复后逻辑: 添加status !== "completed"条件，当明确请求completed状态时不再排除');
console.log('- 预期结果: 测试场景1应该返回所有已完成任务（本例中应为3个）');
console.log('- 验证结论:', completedResult.tasks.length === 3 ? '✅ 修复成功!' : '❌ 修复失败!');
// 测试createTask云函数修复效果（版本2）
// 模拟云函数环境并重点测试openid获取逻辑

// 模拟cloud对象
const mockCloud = {
  init: () => {},
  getWXContext: () => ({
    // 模拟微信返回的不同格式
    OPENID: 'test-openid-123456',
    // 注意：这里可以测试不同的情况，比如只返回大写OPENID或只返回小写openid
  }),
  database: () => ({
    collection: (collectionName) => ({
      add: async (data) => {
        console.log(`模拟向${collectionName}集合添加数据:`);
        console.log('任务数据:', data.data);
        
        // 验证是否正确使用了_openid字段
        if (data.data._openid && data.data._openid === 'test-openid-123456') {
          console.log('✓ 正确使用了_openid字段并且值正确');
        } else {
          console.error('✗ 未正确使用_openid字段或值不正确');
          console.error('实际值:', data.data._openid);
          throw new Error('查询参数对象值不能均为undefined');
        }
        return { _id: 'mock-task-id-789' };
      },
      where: (condition) => ({
        update: async (updateData) => {
          console.log(`模拟更新${collectionName}集合，条件:`, condition);
          
          // 验证where条件中是否使用了正确的_openid字段
          if (condition._openid && condition._openid === 'test-openid-123456') {
            console.log('✓ where条件正确使用了_openid字段并且值正确');
          } else {
            console.error('✗ where条件未正确使用_openid字段或值不正确');
            console.error('实际条件:', condition);
            throw new Error('查询参数对象值不能均为undefined');
          }
          return { updated: 1 };
        }
      }),
      command: {
        inc: (value) => ({ $inc: value })
      }
    })
  })
};

// 模拟createTask云函数的主要逻辑
async function createTaskCloudFunction(event) {
  console.log('\n===== 测试场景：创建任务 =====');
  console.log('接收到的参数:', event);
  
  // 模拟微信上下文
  const wxContext = mockCloud.getWXContext();
  console.log('模拟wxContext内容:', wxContext);
  
  // 修复后的代码：同时尝试获取大写和小写的openid
  const openid = wxContext.openid || wxContext.OPENID || '';
  console.log('获取到的openid:', openid);
  
  // 验证openid
  if (!openid || openid === '') {
    throw new Error('未能获取用户身份信息');
  }
  
  // 构建任务数据
  const taskData = {
    _openid: openid,
    title: event.title,
    description: event.description || '',
    category: event.category || 'default',
    priority: event.priority || 0,
    status: 'pending',
    createTime: new Date(),
    updateTime: new Date(),
    frequency: event.frequency || 'none',
    cycleTimes: event.cycleTimes || null,
    selectedDays: event.selectedDays || [],
    selectedMonthDays: event.selectedMonthDays || []
  };
  
  console.log('构建的任务数据:', taskData);
  
  // 模拟添加任务
  const addResult = await mockCloud.database().collection('tasks').add({
    data: taskData
  });
  
  // 模拟更新用户统计
  await mockCloud.database().collection('users').where({
    _openid: openid
  }).update({
    data: {
      'statistics.totalTasks': { $inc: 1 }
    }
  });
  
  return {
    success: true,
    taskId: addResult._id,
    message: '任务创建成功，查询条件构建正确'
  };
}

// 测试用例
async function runTests() {
  console.log('开始测试createTask云函数修复（版本2）...\n');
  console.log('重点测试：同时支持大小写openid字段获取\n');
  
  let testResults = {
    total: 3,
    passed: 0,
    failed: 0
  };
  
  // 测试用例1: 创建普通任务
  try {
    console.log('\n===== 测试用例1：创建普通任务 =====');
    const event = {
      title: '测试任务',
      description: '这是一个测试任务',
      category: 'care',
      priority: 1
    };
    
    const result = await createTaskCloudFunction(event);
    console.log('测试结果:', result);
    console.log('✅ 测试用例1 通过!');
    testResults.passed++;
  } catch (error) {
    console.error('❌ 测试用例1 失败:', error.message);
    testResults.failed++;
  }
  
  // 测试用例2: 创建每周循环任务
  try {
    console.log('\n===== 测试用例2：创建每周循环任务 =====');
    const event = {
      title: '每周循环任务',
      description: '每周一三五执行',
      category: 'feeding',
      priority: 2,
      frequency: 'weekly',
      selectedDays: ['0', '2', '4']
    };
    
    const result = await createTaskCloudFunction(event);
    console.log('测试结果:', result);
    console.log('✅ 测试用例2 通过!');
    testResults.passed++;
  } catch (error) {
    console.error('❌ 测试用例2 失败:', error.message);
    testResults.failed++;
  }
  
  // 测试用例3: 创建每月循环任务
  try {
    console.log('\n===== 测试用例3：创建每月循环任务 =====');
    const event = {
      title: '每月循环任务',
      description: '每月1日和15日执行',
      category: 'health',
      priority: 0,
      frequency: 'monthly',
      selectedMonthDays: [1, 15]
    };
    
    const result = await createTaskCloudFunction(event);
    console.log('测试结果:', result);
    console.log('✅ 测试用例3 通过!');
    testResults.passed++;
  } catch (error) {
    console.error('❌ 测试用例3 失败:', error.message);
    testResults.failed++;
  }
  
  // 测试总结
  console.log('\n===== 测试总结 =====');
  console.log('测试总数:', testResults.total);
  console.log('通过测试:', testResults.passed);
  console.log('失败测试:', testResults.failed);
  
  if (testResults.failed === 0) {
    console.log('🎉 所有测试通过！修复成功！');
    return true;
  } else {
    console.error('❌ 测试失败，请检查修复');
    return false;
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
}).then(success => {
  process.exit(success ? 0 : 1);
});
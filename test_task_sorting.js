// 测试任务排序功能
console.log('开始测试任务排序功能...');

// 模拟云函数环境
const mockCloud = {
  database: () => ({
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          skip: () => ({
            limit: () => ({
              get: async () => ({
                data: [
                  // 创建测试任务数据
                  {
                    _id: '666',
                    title: '666',
                    createTime: new Date(2024, 0, 1).toISOString(), // 较早的创建日期
                    frequency: 'weekly',
                    selectedDays: ['1', '2', '3', '4', '5'], // 任务666设置为周一至周五
                    status: 'pending'
                  },
                  {
                    _id: '555',
                    title: '555',
                    createTime: new Date(2024, 0, 2).toISOString(),
                    frequency: 'weekly',
                    selectedDays: ['1', '3', '5'],
                    status: 'pending'
                  },
                  {
                    _id: '444',
                    title: '444',
                    createTime: new Date(2024, 0, 3).toISOString(),
                    frequency: 'daily',
                    status: 'pending'
                  },
                  {
                    _id: '333',
                    title: '333',
                    createTime: new Date(2024, 0, 4).toISOString(),
                    frequency: 'none',
                    status: 'pending'
                  }
                ]
              })
            })
          })
        })
      }),
      count: async () => ({ total: 4 })
    })
  }),
  _: { neq: () => ({}), eq: () => ({}) }
};

// 模拟today变量
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

// 模拟处理任务的函数
async function testTaskSorting() {
  console.log(`\n测试日期: ${today.toDateString()}`);
  console.log(`今天是星期${now.getDay()} (0=周日, 1=周一, ..., 6=周六)`);
  
  // 模拟数据库任务数据
  const tasks = [
    {
      _id: '666',
      title: '666',
      createTime: new Date(2024, 0, 1).toISOString(), // 较早的创建日期
      frequency: 'weekly',
      selectedDays: ['1', '2', '3', '4', '5'], // 任务666设置为周一至周五
      status: 'pending'
    },
    {
      _id: '555',
      title: '555',
      createTime: new Date(2024, 0, 2).toISOString(),
      frequency: 'weekly',
      selectedDays: ['1', '3', '5'],
      status: 'pending'
    },
    {
      _id: '444',
      title: '444',
      createTime: new Date(2024, 0, 3).toISOString(),
      frequency: 'daily',
      status: 'pending'
    },
    {
      _id: '333',
      title: '333',
      createTime: new Date(2024, 0, 4).toISOString(),
      frequency: 'none',
      status: 'pending'
    }
  ];
  
  // 测试修复后的排序逻辑
  console.log('\n原始任务列表:');
  tasks.forEach(task => {
    console.log(`任务: ${task.title}, 创建时间: ${task.createTime}, 频率: ${task.frequency}`);
  });
  
  // 应用修复后的处理逻辑
  console.log('\n应用修复后的处理逻辑:');
  const processedTasks = tasks.map(task => {
    let nextCheckInDate = new Date();
    
    if (task.frequency === 'none' || !task.frequency) {
      nextCheckInDate = new Date(task.createTime || Date.now());
    } else if (task.frequency === 'daily') {
      nextCheckInDate = new Date(today);
    } else if (task.frequency === 'weekly' || task.frequency === 'monthly') {
      nextCheckInDate = new Date(today);
    }
    
    return {
      ...task,
      nextCheckInDate
    };
  });
  
  // 过滤逻辑
  const todayDayOfWeek = now.getDay();
  const filteredTasks = processedTasks.filter(task => {
    if (task.frequency === 'none' || !task.frequency) {
      return true;
    }
    
    if (task.frequency === 'daily') {
      return true;
    }
    
    if (task.frequency === 'weekly') {
      const selectedDaysArray = task.selectedDays || [];
      const todayDayStr = String(todayDayOfWeek);
      return selectedDaysArray.includes(todayDayStr) || selectedDaysArray.includes(todayDayOfWeek);
    }
    
    return false;
  });
  
  // 排序逻辑
  filteredTasks.sort((a, b) => {
    const dateA = new Date(a.nextCheckInDate).getTime();
    const dateB = new Date(b.nextCheckInDate).getTime();
    return dateA - dateB;
  });
  
  console.log('\n排序后的任务列表:');
  filteredTasks.forEach(task => {
    console.log(`任务: ${task.title}, 下一次打卡日期: ${task.nextCheckInDate}`);
  });
  
  console.log('\n测试完成！验证排序是否正确。');
}

// 执行测试
testTaskSorting().catch(err => {
  console.error('测试失败:', err);
});
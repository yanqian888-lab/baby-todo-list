// 测试修复后的打卡功能 - 版本2
// 重点测试：查询参数对象值不能均为undefined错误修复

// 模拟微信小程序环境
const wx = {
  showToast: (options) => {
    console.log(`【UI反馈】${options.title}${options.icon ? ` (${options.icon})` : ''}`);
  },
  showLoading: (options) => {
    console.log(`【UI反馈】加载中: ${options.title}`);
  },
  hideLoading: () => {
    console.log('【UI反馈】隐藏加载');
  }
};

// 模拟云函数环境
const cloud = {
  callFunction: async (options) => {
    console.log(`【云函数调用】函数名: ${options.name}, 参数:`, options.data);
    
    // 模拟云函数逻辑，根据测试场景返回不同结果
    const scenario = process.argv[2] || 'success';
    
    // 检查参数有效性
    if (!options.data || typeof options.data !== 'object') {
      throw new Error('云函数参数无效');
    }
    
    // 根据测试场景返回不同结果
    switch(scenario) {
      case 'success':
        // 模拟成功场景
        return {
          result: {
            success: true,
            message: '打卡成功',
            taskInfo: {
              id: options.data.taskId,
              status: 'completed',
              completedDate: options.data.completedDate
            }
          }
        };
        
      case 'emptyQuery':
        // 模拟查询参数为空的场景
        throw new Error('查询参数对象值不能均为undefined');
        
      case 'missingTaskId':
        // 模拟缺少taskId的场景
        throw new Error('参数验证失败：taskId无效');
        
      case 'noOpenid':
        // 模拟没有openid的场景
        return {
          result: {
            success: true,
            message: '打卡成功(无openid)',
            warning: '未获取到openid，但任务已更新',
            taskInfo: {
              id: options.data.taskId,
              status: 'completed',
              completedDate: options.data.completedDate
            }
          }
        };
        
      case 'invalidStatus':
        // 模拟状态无效的场景
        throw new Error('参数验证失败：status无效');
        
      default:
        return {
          result: {
            success: true,
            message: '打卡成功',
            taskInfo: {
              id: options.data.taskId,
              status: 'completed',
              completedDate: options.data.completedDate
            }
          }
        };
    }
  }
};

// 模拟Page对象
class Page {
  constructor(options) {
    this.data = {
      todayTasks: [
        { id: 'test-task-1', title: '测试任务1', status: 'pending' },
        { id: 'test-task-2', title: '测试任务2', status: 'pending' }
      ],
      completedTasks: []
    };
    
    // 绑定方法
    this.handleCheckIn = options.methods.handleCheckIn.bind(this);
    this.updateData = options.methods.updateData.bind(this);
  }
  
  setData(newData) {
    console.log('【数据更新】', newData);
    this.data = { ...this.data, ...newData };
  }
}

// 测试脚本
async function runTest() {
  console.log('\n========= 开始测试修复后的打卡功能 =========\n');
  
  const scenario = process.argv[2] || 'success';
  console.log(`测试场景: ${scenario}\n`);
  
  // 创建页面实例
  const page = new Page({
    methods: {
      /**
       * 处理任务打卡
       * @param {Object} e - 事件对象，包含任务ID
       */
      async handleCheckIn(e) {
        try {
          // 增强参数验证
          if (!e || typeof e !== 'object') {
            console.error('无效的事件对象:', e);
            wx.showToast({
              title: '系统错误，请重试',
              icon: 'none'
            });
            return;
          }
          
          // 检查事件对象的必要结构
          if (!e.currentTarget || typeof e.currentTarget !== 'object') {
            console.error('事件对象缺少currentTarget属性:', e);
            wx.showToast({
              title: '系统错误，请重试',
              icon: 'none'
            });
            return;
          }
          
          if (!e.currentTarget.dataset || typeof e.currentTarget.dataset !== 'object') {
            console.error('事件对象缺少dataset属性:', e);
            wx.showToast({
              title: '系统错误，请重试',
              icon: 'none'
            });
            return;
          }
          
          const taskId = e.currentTarget.dataset.id;
          
          // 增强taskId有效性验证
          if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
            console.error('无效的任务ID:', taskId);
            wx.showToast({
              title: '任务信息无效',
              icon: 'none'
            });
            return;
          }
          
          console.log('开始打卡操作，任务ID:', taskId);
          
          // 找到被打卡的任务
          const taskToComplete = this.data.todayTasks.find(task => task.id === taskId);
          
          if (!taskToComplete) {
            console.error('未找到任务:', taskId);
            wx.showToast({
              title: '任务不存在',
              icon: 'none'
            });
            return;
          }
          
          // 显示加载状态
          wx.showLoading({
            title: '打卡中...',
          });
          
          // 准备云函数参数，增加参数类型检查和格式化
          const currentDate = new Date();
          
          // 结构化参数准备，确保所有必要字段都有有效值
          const cloudParams = {
            taskId: String(taskId).trim(),
            status: 'completed',
            completedDate: currentDate.toISOString()
          };
          
          console.log('调用云函数参数 - 已验证并格式化:', JSON.stringify(cloudParams));
          console.log('云函数参数类型检查:', {
            taskIdType: typeof cloudParams.taskId,
            statusType: typeof cloudParams.status,
            completedDateType: typeof cloudParams.completedDate
          });
          
          // 调用云函数更新任务状态为已完成
          const result = await cloud.callFunction({
            name: 'updateTaskStatus',
            data: cloudParams
          });
          
          console.log('云函数调用结果:', result);
          
          // 更新页面数据
          const updatedTasks = this.data.todayTasks.map(task => {
            if (task.id === taskId) {
              return { ...task, status: 'completed' };
            }
            return task;
          });
          
          const completedTask = this.data.todayTasks.find(task => task.id === taskId);
          
          this.setData({
            todayTasks: updatedTasks.filter(task => task.status !== 'completed'),
            completedTasks: [...this.data.completedTasks, { ...completedTask, status: 'completed' }]
          });
          
          // 显示成功提示
          wx.showToast({
            title: '打卡成功',
            icon: 'success'
          });
          
        } catch (error) {
          console.error('打卡失败:', error);
          
          // 友好的错误提示
          let errorMessage = '打卡失败，请重试';
          
          // 根据错误类型显示不同提示
          if (error.message && error.message.includes('参数验证失败')) {
            errorMessage = error.message;
          } else if (error.message && error.message.includes('查询参数对象值不能均为undefined')) {
            errorMessage = '参数验证失败：请确保所有必要参数都有有效值';
          }
          
          wx.showToast({
            title: errorMessage,
            icon: 'none'
          });
          
        } finally {
          // 隐藏加载状态
          wx.hideLoading();
          console.log('打卡操作完成');
        }
      },
      
      updateData(data) {
        this.setData(data);
      }
    }
  });
  
  try {
    // 根据测试场景构建不同的事件对象
    let event;
    
    switch(scenario) {
      case 'success':
        event = {
          currentTarget: {
            dataset: {
              id: 'test-task-1'
            }
          }
        };
        break;
      case 'emptyQuery':
      case 'noOpenid':
        event = {
          currentTarget: {
            dataset: {
              id: 'test-task-1'
            }
          }
        };
        break;
      case 'missingTaskId':
        event = {
          currentTarget: {
            dataset: {}
          }
        };
        break;
      case 'invalidStatus':
        event = {
          currentTarget: {
            dataset: {
              id: 'test-task-1'
            }
          }
        };
        break;
      default:
        event = {
          currentTarget: {
            dataset: {
              id: 'test-task-1'
            }
          }
        };
    }
    
    // 执行打卡操作
    await page.handleCheckIn(event);
    
    console.log('\n========= 测试完成 =========\n');
    console.log('测试场景:', scenario);
    console.log('最终任务状态:', {
      todayTasks: page.data.todayTasks,
      completedTasks: page.data.completedTasks
    });
    
  } catch (error) {
    console.error('测试过程中出错:', error);
    console.log('\n========= 测试失败 =========\n');
  }
}

// 执行测试
runTest();
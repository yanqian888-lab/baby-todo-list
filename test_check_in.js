// 模拟测试打卡功能
// 由于无法直接在当前环境中运行小程序，创建此模拟脚本验证错误处理逻辑

// 模拟微信小程序API
const wx = {
  showLoading: (options) => {
    console.log(`显示加载提示: ${options.title}`);
  },
  hideLoading: () => {
    console.log('隐藏加载提示');
  },
  showToast: (options) => {
    console.log(`显示消息提示: ${options.title}, 图标: ${options.icon}`);
  },
  cloud: {
    callFunction: async (options) => {
      console.log(`调用云函数: ${options.name}, 数据:`, options.data);
      // 模拟云函数调用结果
      const mockError = process.argv[2]; // 通过命令行参数指定模拟的错误类型
      
      if (mockError === 'functionNotFound') {
        throw {
          errMsg: 'cloud.callFunction:fail Error: errCode: -501000 | errMsg: FunctionName parameter could not be found.'
        };
      } else if (mockError === 'cloudError') {
        throw {
          errMsg: 'cloud.callFunction:fail network error'
        };
      } else if (mockError === 'resultError') {
        return {
          result: {
            success: false,
            error: '云函数内部处理失败'
          }
        };
      }
      
      // 默认返回成功
      return {
        result: {
          success: true,
          message: '任务状态更新成功'
        }
      };
    }
  }
};

// 模拟Page对象
const mockPage = {
  data: {
    todayTasks: [
      { id: 'task1', name: '测试任务1', description: '待完成任务' },
      { id: 'task2', name: '测试任务2', description: '待完成任务' }
    ],
    completedTasks: []
  },
  setData: function(data) {
    console.log('更新页面数据:', data);
    Object.assign(this.data, data);
  },
  calculateStats: function() {
    console.log('计算统计数据');
  },
  _getCurrentTime: function() {
    return `今天 ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`;
  },
  
  // 修改后的handleCheckIn函数，使用模拟的wx对象
  async handleCheckIn(taskId) {
    console.log(`开始测试打卡功能，任务ID: ${taskId}`);
    
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
    
    try {
      // 检查云环境
      console.log('开始调用云函数，任务ID:', taskId);
      
      // 调用云函数更新任务状态为已完成
      const cloudResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: {
          taskId: taskId,
          status: 'completed',
          completedDate: new Date().toISOString()
        }
      });
      
      console.log('云函数调用结果:', cloudResult);
      
      if (cloudResult.result && cloudResult.result.success) {
        // 从todayTasks中移除该任务
        const updatedTodayTasks = this.data.todayTasks.filter(task => task.id !== taskId);
        
        // 创建带有完成时间的任务对象
        const completedTask = {
          ...taskToComplete,
          completed: true,
          completedTime: this._getCurrentTime() // 添加完成时间
        };
        
        // 将任务添加到completedTasks数组
        const updatedCompletedTasks = [completedTask, ...this.data.completedTasks];
        
        // 更新页面数据
        this.setData({
          todayTasks: updatedTodayTasks,
          completedTasks: updatedCompletedTasks
        });
        
        this.calculateStats();
        
        // 显示成功提示
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });
      } else {
        const errorMsg = cloudResult.result?.error || '打卡失败';
        console.error('打卡失败，云函数返回错误:', errorMsg);
        wx.showToast({
          title: errorMsg,
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('打卡失败，捕获到异常:', error);
      // 根据错误类型提供更具体的错误信息
      let errorMsg = '打卡失败，请重试';
      if (error.errMsg && error.errMsg.includes('FunctionName')) {
        errorMsg = '云函数未找到，请检查部署';
      }
      wx.showToast({
        title: errorMsg,
        icon: 'none'
      });
    } finally {
      // 隐藏加载状态
      wx.hideLoading();
      console.log('打卡操作完成');
    }
  }
};

// 运行测试
async function runTest() {
  console.log('========================================');
  console.log('开始测试打卡功能错误处理');
  console.log('========================================');
  
  // 测试1: 正常流程
  console.log('\n测试场景1: 正常打卡流程');
  await mockPage.handleCheckIn('task1');
  
  // 重置数据
  mockPage.data = {
    todayTasks: [
      { id: 'task1', name: '测试任务1', description: '待完成任务' },
      { id: 'task2', name: '测试任务2', description: '待完成任务' }
    ],
    completedTasks: []
  };
  
  // 测试2: 任务不存在
  console.log('\n测试场景2: 任务不存在');
  await mockPage.handleCheckIn('nonExistentTask');
  
  // 测试3: 函数未找到错误
  if (process.argv[2] === 'functionNotFound') {
    console.log('\n测试场景3: 函数未找到错误');
    await mockPage.handleCheckIn('task1');
  }
  
  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

runTest().catch(err => {
  console.error('测试运行失败:', err);
});
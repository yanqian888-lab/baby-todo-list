// 测试修复后的打卡功能

// 模拟微信小程序环境
const wx = {
  showLoading: (options) => {
    console.log(`[UI] 显示加载中: ${options.title}`);
  },
  hideLoading: () => {
    console.log('[UI] 隐藏加载中');
  },
  showToast: (options) => {
    console.log(`[UI] 显示提示: ${options.title}, 图标: ${options.icon || 'success'}`);
  },
  cloud: {
    callFunction: async (options) => {
      console.log(`[云函数] 调用 ${options.name}, 参数:`, options.data);
      
      // 模拟不同的测试场景
      const testScenario = process.argv[2];
      
      switch (testScenario) {
        case 'emptyParams':
          return {
            result: {
              success: false,
              error: '参数格式错误'
            }
          };
        case 'missingTaskId':
          return {
            result: {
              success: false,
              error: '任务ID不能为空'
            }
          };
        case 'missingStatus':
          return {
            result: {
              success: false,
              error: '任务状态不能为空'
            }
          };
        case 'undefinedError':
          return {
            result: {
              success: false,
              error: '参数验证失败：请确保所有必要参数都有有效值'
            }
          };
        case 'noOpenid':
          // 模拟openid为undefined的情况，但任务状态更新成功
          return {
            result: {
              success: true,
              message: '任务状态更新成功'
            }
          };
        default:
          // 默认模拟成功场景
          return {
            result: {
              success: true,
              message: '任务状态更新成功'
            }
          };
      }
    }
  }
};

// 模拟Page对象
const Page = (pageConfig) => {
  const page = {
    data: {
      todayTasks: [
        { id: 'task1', title: '测试任务1' },
        { id: 'task2', title: '测试任务2' }
      ],
      completedTasks: []
    },
    setData: function(data) {
      console.log('[页面] 更新数据:', data);
      Object.assign(this.data, data);
    },
    calculateStats: function() {
      console.log('[页面] 计算统计数据');
    },
    _getCurrentTime: function() {
      return new Date().toLocaleTimeString('zh-CN');
    }
  };
  
  // 复制方法到page对象
  Object.assign(page, pageConfig);
  
  return page;
};

// 测试页面配置
const pageConfig = {
  /**
   * 处理任务打卡
   * @param {Object} e - 事件对象，包含任务ID
   */
  async handleCheckIn(e) {
    try {
      // 参数验证
      if (!e || !e.currentTarget || !e.currentTarget.dataset) {
        console.error('无效的事件对象:', e);
        wx.showToast({
          title: '系统错误，请重试',
          icon: 'none'
        });
        return;
      }
      
      const taskId = e.currentTarget.dataset.id;
      
      // 验证taskId有效性
      if (!taskId || typeof taskId !== 'string') {
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
      
      // 准备云函数参数
      const currentDate = new Date();
      const cloudParams = {
        taskId: taskId,
        status: 'completed',
        completedDate: currentDate.toISOString()
      };
      
      console.log('调用云函数参数:', cloudParams);
      
      // 调用云函数更新任务状态为已完成
      const cloudResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: cloudParams
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
      // 确保隐藏加载状态
      wx.hideLoading();
      console.log('[流程] 打卡操作完成');
    }
  }
};

// 创建页面实例
const page = Page(pageConfig);

// 测试函数
async function runTests() {
  const testScenario = process.argv[2] || 'success';
  
  console.log(`\n=== 测试场景: ${testScenario} ===\n`);
  
  switch (testScenario) {
    case 'invalidEvent':
      // 测试无效的事件对象
      await page.handleCheckIn(null);
      break;
    case 'missingTaskId':
      // 测试缺少任务ID
      await page.handleCheckIn({
        currentTarget: { dataset: {} }
      });
      break;
    case 'nonExistentTask':
      // 测试不存在的任务
      await page.handleCheckIn({
        currentTarget: { dataset: { id: 'nonExistentTaskId' } }
      });
      break;
    case 'emptyParams':
    case 'missingStatus':
    case 'undefinedError':
    case 'noOpenid':
      // 测试云函数错误场景
      await page.handleCheckIn({
        currentTarget: { dataset: { id: 'task1' } }
      });
      break;
    default:
      // 默认测试成功场景
      await page.handleCheckIn({
        currentTarget: { dataset: { id: 'task1' } }
      });
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
});
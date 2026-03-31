// 测试页面 - 用于验证打卡功能
Page({
  data: {
    testTaskId: '',
    currentCheckins: 0,
    cycleTimes: 1,
    taskInfo: null,
    testResults: []
  },

  onLoad() {
    // 页面加载时初始化
    this.addTestResult('测试页面加载完成');
  },

  // 输入测试任务ID
  onTaskIdInput(e) {
    this.setData({
      testTaskId: e.detail.value
    });
  },

  // 输入测试循环次数
  onCycleTimesInput(e) {
    this.setData({
      cycleTimes: parseInt(e.detail.value) || 1
    });
  },

  // 获取任务信息
  async getTaskInfo() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.addTestResult(`开始获取任务信息，任务ID: ${taskId}`);

    try {
      wx.showLoading({ title: '获取任务信息中...' });

      // 调用云函数获取任务详情
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: { taskId: taskId }
      });

      console.log('获取任务详情结果:', result);
      this.addTestResult(`获取任务详情结果: ${JSON.stringify(result)}`);

      if (result.result && result.result.success && result.result.tasks && result.result.tasks.length > 0) {
        const task = result.result.tasks[0];
        this.setData({
          taskInfo: task,
          currentCheckins: task.checkins || 0,
          cycleTimes: task.cycleTimes || 1
        });
        this.addTestResult(`任务信息获取成功，当前打卡次数: ${this.data.currentCheckins}`);
      } else {
        // 直接从数据库查询
        const db = wx.cloud.database();
        const taskResult = await db.collection('tasks').doc(taskId).get();
        if (taskResult.data) {
          this.setData({
            taskInfo: taskResult.data,
            currentCheckins: taskResult.data.checkins || 0,
            cycleTimes: taskResult.data.cycleTimes || 1
          });
          this.addTestResult(`从数据库直接获取任务信息成功，当前打卡次数: ${this.data.currentCheckins}`);
        } else {
          this.addTestResult('任务不存在');
        }
      }
    } catch (error) {
      console.error('获取任务信息失败:', error);
      this.addTestResult(`获取任务信息失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  },

  // 测试打卡功能
  async testCheckIn() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    const currentCheckins = this.data.currentCheckins;
    const cycleTimes = this.data.cycleTimes;
    const nextCheckins = currentCheckins + 1;
    const isAllCompleted = nextCheckins >= cycleTimes;

    this.addTestResult(`开始测试打卡，当前打卡次数: ${currentCheckins}，目标次数: ${cycleTimes}`);

    try {
      wx.showLoading({ title: '测试打卡中...' });

      // 调用云函数更新任务状态
      const cloudResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: {
          taskId: taskId,
          status: isAllCompleted ? 'completed' : 'pending',
          completedDate: isAllCompleted ? new Date().toISOString() : null,
          checkins: nextCheckins,
          cycleTimes: cycleTimes
        }
      });

      console.log('打卡测试结果:', cloudResult);
      this.addTestResult(`打卡测试结果: ${JSON.stringify(cloudResult)}`);

      if (cloudResult.result && cloudResult.result.success) {
        this.addTestResult('打卡成功');
        // 更新当前打卡次数
        this.setData({
          currentCheckins: nextCheckins
        });
        // 重新获取任务信息验证打卡次数
        this.getTaskInfo();
      } else {
        this.addTestResult(`打卡失败: ${cloudResult.result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('打卡测试失败:', error);
      this.addTestResult(`打卡测试失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  },

  // 测试获取打卡次数功能
  async testGetCheckIns() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.addTestResult(`开始测试获取打卡次数，任务ID: ${taskId}`);

    try {
      wx.showLoading({ title: '获取打卡次数中...' });

      // 调用云函数获取打卡次数
      const checkinsResult = await wx.cloud.callFunction({
        name: 'getTaskClockIns',
        data: {
          taskId: taskId,
          todayOnly: true
        }
      });

      console.log('获取打卡次数结果:', checkinsResult);
      this.addTestResult(`获取打卡次数结果: ${JSON.stringify(checkinsResult)}`);

      if (checkinsResult.result && checkinsResult.result.success) {
        const todayCount = checkinsResult.result.data.todayCount;
        this.addTestResult(`获取打卡次数成功，今日打卡次数: ${todayCount}`);
        this.setData({
          currentCheckins: todayCount
        });
      } else {
        this.addTestResult(`获取打卡次数失败: ${checkinsResult.result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('获取打卡次数失败:', error);
      this.addTestResult(`获取打卡次数失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  },

  // 重置任务打卡次数
  async resetCheckIns() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.addTestResult(`开始重置任务打卡次数，任务ID: ${taskId}`);

    try {
      wx.showLoading({ title: '重置中...' });

      // 调用云函数重置打卡次数
      const cloudResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: {
          taskId: taskId,
          status: 'pending',
          completedDate: null,
          checkins: 0,
          cycleTimes: this.data.cycleTimes
        }
      });

      console.log('重置打卡次数结果:', cloudResult);
      this.addTestResult(`重置打卡次数结果: ${JSON.stringify(cloudResult)}`);

      if (cloudResult.result && cloudResult.result.success) {
        this.addTestResult('重置打卡次数成功');
        this.setData({
          currentCheckins: 0
        });
        // 重新获取任务信息验证打卡次数
        this.getTaskInfo();
      } else {
        this.addTestResult(`重置打卡次数失败: ${cloudResult.result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('重置打卡次数失败:', error);
      this.addTestResult(`重置打卡次数失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  },

  // 添加测试结果
  addTestResult(message) {
    const timestamp = new Date().toLocaleTimeString();
    const newResult = `${timestamp} - ${message}`;
    this.setData({
      testResults: [newResult, ...this.data.testResults]
    });
  },

  // 清空测试结果
  clearTestResults() {
    this.setData({
      testResults: []
    });
  },

  // 测试云函数功能
  async testCloudFunctions() {
    this.addTestResult('开始测试云函数功能...');
    
    // 测试1: 获取已完成任务
    await this.testGetTasks();
    
    // 测试2: 获取用户统计信息
    await this.testGetUserStatistics();
  },

  // 测试getTasks云函数 - 获取已完成任务
  async testGetTasks() {
    this.addTestResult('🔍 测试getTasks云函数（已完成任务）...');
    
    try {
      wx.showLoading({ title: '测试getTasks中...' });
      
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: 'completed'
        }
      });
      
      console.log('✅ getTasks云函数返回结果:', result);
      this.addTestResult(`getTasks云函数调用成功: ${JSON.stringify(result.result)}`);
      
      if (result.result && result.result.success) {
        this.addTestResult(`📋 已完成任务数量: ${result.result.tasks.length}`);
        this.addTestResult(`📋 已完成任务列表: ${JSON.stringify(result.result.tasks, null, 2)}`);
      } else {
        this.addTestResult(`❌ getTasks云函数执行失败: ${result.result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('❌ 调用getTasks云函数失败:', error);
      this.addTestResult(`❌ 调用getTasks云函数失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  },

  // 测试getUserStatistics云函数
  async testGetUserStatistics() {
    this.addTestResult('🔍 测试getUserStatistics云函数...');
    
    try {
      wx.showLoading({ title: '测试getUserStatistics中...' });
      
      const result = await wx.cloud.callFunction({
        name: 'getUserStatistics'
      });
      
      console.log('✅ getUserStatistics云函数返回结果:', result);
      this.addTestResult(`getUserStatistics云函数调用成功: ${JSON.stringify(result.result)}`);
      
      if (result.result && result.result.success) {
        this.addTestResult(`📋 用户统计信息: ${JSON.stringify(result.result.data, null, 2)}`);
      } else {
        this.addTestResult(`❌ getUserStatistics云函数执行失败: ${result.result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('❌ 调用getUserStatistics云函数失败:', error);
      this.addTestResult(`❌ 调用getUserStatistics云函数失败: ${error.message}`);
    } finally {
      wx.hideLoading();
    }
  }
});
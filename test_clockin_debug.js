// 详细测试打卡流程的调试脚本
// 用于验证打卡记录的存储和获取是否正常

const app = getApp();

Page({
  data: {
    testTaskId: '', // 测试任务ID
    currentCheckins: 0,
    testResults: []
  },

  onLoad: function() {
    // 初始化测试结果
    this.setData({ testResults: [] });
  },

  // 输入测试任务ID
  onTaskIdInput(e) {
    this.setData({ testTaskId: e.detail.value });
  },

  // 添加测试结果
  addTestResult(result) {
    const timestamp = new Date().toLocaleTimeString();
    const newResult = `${timestamp}: ${result}`;
    this.setData({
      testResults: [...this.data.testResults, newResult]
    });
    console.log(newResult);
  },

  // 清空测试结果
  clearTestResults() {
    this.setData({ testResults: [] });
  },

  // 测试1: 直接调用getTaskClockIns云函数
  async testGetTaskClockIns() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.clearTestResults();
    this.addTestResult('=== 测试1: 直接调用getTaskClockIns云函数 ===');

    try {
      wx.showLoading({ title: '测试中' });

      // 调用云函数获取打卡记录
      const result = await wx.cloud.callFunction({
        name: 'getTaskClockIns',
        data: {
          taskId: taskId,
          todayOnly: true
        }
      });

      this.addTestResult('云函数调用结果:');
      this.addTestResult(JSON.stringify(result, null, 2));

      if (result.result && result.result.success) {
        this.addTestResult('✅ 云函数调用成功');
        this.addTestResult('返回的todayCount: ' + result.result.data.todayCount);
        this.addTestResult('返回的clockIns记录数: ' + result.result.data.clockIns.length);
        
        if (result.result.data.clockIns.length > 0) {
          this.addTestResult('第一条打卡记录详情:');
          this.addTestResult(JSON.stringify(result.result.data.clockIns[0], null, 2));
        } else {
          this.addTestResult('⚠️ 没有找到打卡记录');
        }
      } else {
        this.addTestResult('❌ 云函数调用失败: ' + (result.result.error || '未知错误'));
      }
    } catch (error) {
      this.addTestResult('❌ 调用云函数异常: ' + error.message);
    } finally {
      wx.hideLoading();
    }
  },

  // 测试2: 直接调用updateTaskStatus云函数进行打卡
  async testUpdateTaskStatus() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.clearTestResults();
    this.addTestResult('=== 测试2: 直接调用updateTaskStatus云函数进行打卡 ===');

    try {
      wx.showLoading({ title: '测试中' });

      // 首先获取当前打卡次数
      const getResult = await wx.cloud.callFunction({
        name: 'getTaskClockIns',
        data: {
          taskId: taskId,
          todayOnly: true
        }
      });

      const currentCount = getResult.result?.data?.todayCount || 0;
      const nextCount = currentCount + 1;
      this.addTestResult(`当前打卡次数: ${currentCount}, 预计下次: ${nextCount}`);

      // 调用打卡云函数
      const clockInResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: {
          taskId: taskId,
          status: 'pending', // 暂时不完成任务
          completedDate: null,
          checkins: nextCount,
          cycleTimes: 3 // 假设循环3次
        }
      });

      this.addTestResult('打卡云函数调用结果:');
      this.addTestResult(JSON.stringify(clockInResult, null, 2));

      if (clockInResult.result && clockInResult.result.success) {
        this.addTestResult('✅ 打卡成功');
        
        // 验证打卡记录是否正确存储
        this.addTestResult('验证打卡记录...');
        const verifyResult = await wx.cloud.callFunction({
          name: 'getTaskClockIns',
          data: {
            taskId: taskId,
            todayOnly: true
          }
        });

        const actualCount = verifyResult.result?.data?.todayCount || 0;
        this.addTestResult(`实际打卡次数: ${actualCount}`);
        
        if (actualCount === nextCount) {
          this.addTestResult('✅ 打卡次数正确更新');
        } else {
          this.addTestResult('❌ 打卡次数更新不正确');
        }
        
        // 查看最新的打卡记录
        if (verifyResult.result?.data?.clockIns?.length > 0) {
          this.addTestResult('最新打卡记录:');
          this.addTestResult(JSON.stringify(verifyResult.result.data.clockIns[0], null, 2));
        }
      } else {
        this.addTestResult('❌ 打卡失败: ' + (clockInResult.result.error || '未知错误'));
      }
    } catch (error) {
      this.addTestResult('❌ 测试异常: ' + error.message);
    } finally {
      wx.hideLoading();
    }
  },

  // 测试3: 直接查询task_clock_ins集合
  async testQueryTaskClockIns() {
    const taskId = this.data.testTaskId.trim();
    if (!taskId) {
      wx.showToast({ title: '请输入任务ID', icon: 'none' });
      return;
    }

    this.clearTestResults();
    this.addTestResult('=== 测试3: 直接查询task_clock_ins集合 ===');

    try {
      wx.showLoading({ title: '测试中' });

      // 调用云函数查询打卡记录集合
      const result = await wx.cloud.callFunction({
        name: 'queryTaskClockIns',
        data: {
          taskId: taskId
        }
      });

      this.addTestResult('查询结果:');
      this.addTestResult(JSON.stringify(result, null, 2));
      
      if (result.result && result.result.success) {
        this.addTestResult(`找到 ${result.result.data.count} 条打卡记录`);
        result.result.data.records.forEach((record, index) => {
          this.addTestResult(`记录 ${index + 1}:`);
          this.addTestResult(`  打卡时间: ${new Date(record.checkinTime).toLocaleString()}`);
          this.addTestResult(`  打卡次数: ${record.checkinCount}`);
        });
      }
    } catch (error) {
      this.addTestResult('❌ 查询异常: ' + error.message);
    } finally {
      wx.hideLoading();
    }
  }
});
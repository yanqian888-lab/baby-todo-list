// 测试脚本 v3 - 更全面的打卡功能测试
// 测试不同参数情况，确保查询参数验证和错误处理逻辑正常工作

const fs = require('fs');
const path = require('path');

// 模拟环境
const mockConsole = {
  log: (...args) => {
    console.log('[TEST]', ...args);
  },
  error: (...args) => {
    console.error('[TEST ERROR]', ...args);
  }
};

// 模拟小程序API
const wx = {
  showLoading: (options) => {
    mockConsole.log('显示加载提示:', options.title);
  },
  hideLoading: () => {
    mockConsole.log('隐藏加载提示');
  },
  showToast: (options) => {
    mockConsole.log('显示提示:', options.title, '图标:', options.icon || 'none');
  },
  cloud: {
    callFunction: (options) => {
      mockConsole.log('调用云函数:', options.name, '参数:', JSON.stringify(options.data));
      return Promise.resolve(mockCloudFunctionResponse);
    }
  }
};

// 测试场景
const testScenarios = [
  {
    name: 'success',
    description: '正常打卡流程 - 有效的taskId',
    taskId: 'task123456',
    expectError: false,
    mockResponse: {
      result: {
        success: true,
        message: '任务状态更新成功',
        taskId: 'task123456',
        status: 'completed'
      }
    }
  },
  {
    name: 'emptyTaskId',
    description: '空的taskId',
    taskId: '',
    expectError: true,
    expectErrorType: '任务ID不能为空',
    mockResponse: null // 前端应该在调用云函数前捕获这个错误
  },
  {
    name: 'shortTaskId',
    description: '长度过短的taskId',
    taskId: '123',
    expectError: true,
    expectErrorType: '任务ID格式错误',
    mockResponse: null // 前端应该在调用云函数前捕获这个错误
  },
  {
    name: 'undefinedTaskId',
    description: '未定义的taskId',
    taskId: undefined,
    expectError: true,
    expectErrorType: '任务ID不能为空',
    mockResponse: null // 前端应该在调用云函数前捕获这个错误
  },
  {
    name: 'invalidTaskIdFormat',
    description: '格式无效的taskId',
    taskId: 'invalid#task$id',
    expectError: true, // 云函数会验证taskId格式并返回错误
    expectErrorType: '任务ID格式错误',
    mockResponse: {
      result: {
        success: false,
        message: '任务ID格式错误，请检查',
        errorType: 'validation_error',
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'cloudFunctionError',
    description: '云函数内部错误',
    taskId: 'errorTask',
    expectError: true,
    expectErrorType: '服务器内部错误',
    mockResponse: {
      result: {
        success: false,
        message: '服务器内部错误',
        errorType: 'internal_error',
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'documentNotFound',
    description: '文档未找到错误',
    taskId: 'nonExistentTask',
    expectError: true,
    expectErrorType: '未找到对应的任务',
    mockResponse: {
      result: {
        success: false,
        message: '未找到对应的任务',
        errorType: 'document_not_found',
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'permissionDenied',
    description: '权限拒绝错误',
    taskId: 'forbiddenTask',
    expectError: true,
    expectErrorType: '没有权限执行此操作',
    mockResponse: {
      result: {
        success: false,
        message: '没有权限执行此操作',
        errorType: 'permission_denied',
        timestamp: Date.now()
      }
    }
  }
];

// 模拟的云函数响应
let mockCloudFunctionResponse;

// 模拟的handleCheckIn函数 - 基于我们修改后的代码
async function handleCheckIn(e) {
  try {
    mockConsole.log('handleCheckIn函数被调用，接收到事件对象:', JSON.stringify(e));
    
    // 验证事件对象是否存在且包含target属性
    if (!e || !e.currentTarget || !e.currentTarget.dataset) {
      throw new Error('无效的事件对象');
    }

    // 从事件对象中获取taskId并进行验证
    let taskId = e.currentTarget.dataset.taskid;
    mockConsole.log('从事件对象获取的原始taskId:', taskId);
    
    // 参数验证
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    
    // 对taskId进行清理和格式检查
    const sanitizedTaskId = String(taskId).trim();
    
    // 检查taskId长度
    if (sanitizedTaskId.length < 5) {
      throw new Error('任务ID格式错误');
    }
    
    mockConsole.log('处理后的taskId:', sanitizedTaskId);
    
    // 显示加载提示
    wx.showLoading({ title: '打卡中...' });
    
    // 准备云函数调用参数
    const cloudFunctionParams = {
      taskId: sanitizedTaskId,
      status: 'completed'
    };
    
    mockConsole.log('准备调用云函数updateTaskStatus，参数:', JSON.stringify(cloudFunctionParams));
    
    // 调用云函数
    const res = await wx.cloud.callFunction({
      name: 'updateTaskStatus',
      data: cloudFunctionParams
    });
    
    mockConsole.log('云函数调用结果:', JSON.stringify(res));
    
    // 检查返回格式
    if (!res || !res.result) {
      throw new Error('云函数返回格式错误');
    }
    
    const { success, message } = res.result;
    
    // 根据云函数返回的结果处理
    if (success) {
      mockConsole.log('打卡成功:', message);
      wx.showToast({
        title: message || '打卡成功',
        icon: 'success',
        duration: 2000
      });
      
      // 这里通常会更新页面数据，但在测试环境中我们跳过这一步
      mockConsole.log('任务状态已更新');
      return { success: true };
    } else {
      // 云函数返回失败
      throw new Error(message || '打卡失败');
    }
  } catch (error) {
    mockConsole.error('打卡过程中出现错误:', error.message);
    
    // 根据错误类型提供更友好的错误提示
    let errorMessage = '打卡失败，请稍后重试';
    
    if (error.message.includes('任务ID不能为空')) {
      errorMessage = '任务ID不能为空';
    } else if (error.message.includes('任务ID格式错误')) {
      errorMessage = '任务ID格式错误';
    } else if (error.message.includes('未找到对应的任务')) {
      errorMessage = '未找到对应的任务';
    } else if (error.message.includes('没有权限')) {
      errorMessage = '没有权限执行此操作';
    } else if (error.message.includes('服务器内部错误')) {
      errorMessage = '服务器内部错误';
    }
    
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    });
    
    return { success: false, error: errorMessage };
  } finally {
    // 无论成功失败，都隐藏加载提示
    wx.hideLoading();
  }
}

// 运行测试
async function runTest(scenario) {
  console.log(`\n=====================================`);
  console.log(`开始测试: ${scenario.description}`);
  
  // 设置模拟的云函数响应
  mockCloudFunctionResponse = scenario.mockResponse;
  
  // 构建事件对象
  const event = {
    currentTarget: {
      dataset: {
        taskid: scenario.taskId
      }
    }
  };
  
  try {
    const result = await handleCheckIn(event);
    
    // 验证结果
    if (scenario.expectError) {
      if (!result.success) {
        console.log('✅ 测试通过: 正确捕获了预期错误');
        if (result.error && result.error.includes(scenario.expectErrorType)) {
          console.log(`✅ 测试通过: 错误信息符合预期: "${result.error}"`);
        } else {
          console.log(`❌ 测试失败: 错误信息不符合预期，期望包含: "${scenario.expectErrorType}"，实际: "${result.error || '无错误信息'}"`);
          return false;
        }
      } else {
        console.log(`❌ 测试失败: 应该返回失败，但返回了成功`);
        return false;
      }
    } else {
      if (result.success) {
        console.log('✅ 测试通过: 成功完成打卡');
      } else {
        console.log(`❌ 测试失败: 应该返回成功，但返回了失败: ${result.error}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ 测试执行出错:`, error);
    return false;
  }
}

// 主测试函数
async function main() {
  console.log('开始执行打卡功能全面测试...');
  console.log(`共 ${testScenarios.length} 个测试场景`);
  
  let passedCount = 0;
  let failedCount = 0;
  
  // 获取命令行参数，支持指定测试场景
  const args = process.argv.slice(2);
  const targetScenario = args[0];
  
  let scenariosToRun = testScenarios;
  if (targetScenario) {
    scenariosToRun = testScenarios.filter(s => s.name === targetScenario);
    if (scenariosToRun.length === 0) {
      console.error(`错误: 未找到名为 "${targetScenario}" 的测试场景`);
      console.log('可用的测试场景:');
      testScenarios.forEach(s => console.log(`  - ${s.name}: ${s.description}`));
      process.exit(1);
    }
    console.log(`仅运行指定测试场景: ${targetScenario}`);
  }
  
  for (const scenario of scenariosToRun) {
    const passed = await runTest(scenario);
    if (passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }
  
  console.log(`\n=====================================`);
  console.log(`测试完成!`);
  console.log(`通过: ${passedCount}, 失败: ${failedCount}`);
  
  if (failedCount > 0) {
    console.log('❌ 存在测试失败，请检查修复');
    process.exit(1);
  } else {
    console.log('✅ 所有测试通过!');
    process.exit(0);
  }
}

// 运行测试
main().catch(error => {
  console.error('测试运行出错:', error);
  process.exit(1);
});
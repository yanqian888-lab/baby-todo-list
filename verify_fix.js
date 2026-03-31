// 验证修复后的云函数功能
const cloud = require('wx-server-sdk');
const path = require('path');

// 模拟微信上下文
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 辅助函数：格式化日期（YYYY-MM-DD）
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 辅助函数：格式化时间（HH:MM:SS）
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// 测试getTasks云函数获取已完成任务
async function testGetCompletedTasks() {
  console.log('\n=== 测试getTasks获取已完成任务 ===');
  
  try {
    // 模拟云函数调用
    const { main } = require('./cloudfunctions/getTasks/index.js');
    
    // 模拟事件参数
    const event = {
      status: 'completed',
      includeCompleted: true
    };
    
    // 模拟上下文
    const context = {
      OPENID: 'test_openid'
    };
    
    // 调用云函数
    const result = await main(event, context);
    
    console.log('✅ getTasks云函数返回结果:', JSON.stringify(result, null, 2));
    console.log('✅ 已完成任务数量:', result.tasks.length);
    
    return result;
  } catch (error) {
    console.error('❌ 测试getTasks失败:', error);
    return null;
  }
}

// 测试getUserStatistics云函数计算连续打卡天数
async function testGetUserStatistics() {
  console.log('\n=== 测试getUserStatistics计算连续打卡天数 ===');
  
  try {
    // 模拟云函数调用
    const { main } = require('./cloudfunctions/getUserStatistics/index.js');
    
    // 模拟上下文
    const context = {
      OPENID: 'test_openid'
    };
    
    // 调用云函数
    const result = await main({}, context);
    
    console.log('✅ getUserStatistics云函数返回结果:', JSON.stringify(result, null, 2));
    console.log('✅ 连续打卡天数:', result.data.streakDays);
    console.log('✅ 总打卡天数:', result.data.totalDays);
    console.log('✅ 今日打卡状态:', result.data.today);
    
    return result;
  } catch (error) {
    console.error('❌ 测试getUserStatistics失败:', error);
    return null;
  }
}

// 测试task_completions集合是否存在有效数据
async function testTaskCompletionsData() {
  console.log('\n=== 测试task_completions集合数据 ===');
  
  try {
    // 查询task_completions集合
    const result = await db.collection('task_completions').get();
    
    console.log('✅ task_completions集合数据:', JSON.stringify(result, null, 2));
    console.log('✅ task_completions集合文档数量:', result.data.length);
    
    // 如果有数据，显示最近的几条
    if (result.data.length > 0) {
      console.log('\n最近的5条打卡记录:');
      result.data.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. 任务ID: ${record.taskId}, 完成时间: ${new Date(record.completedAt).toLocaleString()}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ 测试task_completions集合失败:', error);
    return null;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始验证修复后的云函数功能');
  
  // 测试集合数据
  await testTaskCompletionsData();
  
  // 测试getTasks云函数
  const tasksResult = await testGetCompletedTasks();
  
  // 测试getUserStatistics云函数
  const statisticsResult = await testGetUserStatistics();
  
  console.log('\n=== 测试总结 ===');
  
  if (tasksResult && tasksResult.tasks.length > 0) {
    console.log('✅ 已完成任务显示问题已修复');
  } else {
    console.log('❌ 已完成任务显示问题仍存在');
  }
  
  if (statisticsResult && statisticsResult.data.streakDays > 0) {
    console.log('✅ 连续打卡天数计算问题已修复');
  } else {
    console.log('❌ 连续打卡天数计算问题仍存在');
  }
  
  console.log('\n🔧 修复验证完成');
}

// 运行测试
runTests().catch(console.error);
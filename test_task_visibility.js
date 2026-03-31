// 测试脚本：验证任务创建和获取功能
// 主要测试非循环任务和循环任务的可见性问题

const fs = require('fs');
const path = require('path');

// 创建测试用的临时脚本
const createTempScript = () => {
  const tempScript = `
    // 模拟小程序环境调用云函数
    const cloud = require('wx-server-sdk');
    cloud.init({ env: 'your-env-id' }); // 请替换为实际环境ID
    const db = cloud.database();
    const _ = db.command;
    
    async function testTaskVisibility() {
      try {
        console.log('=== 开始测试任务可见性 ===');
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayDayOfWeek = now.getDay();
        
        console.log('当前日期:', now.toISOString());
        console.log('今天:', today.toISOString());
        console.log('今天是星期几(0-6):', todayDayOfWeek);
        
        // 1. 创建非循环任务
        console.log('\n1. 创建非循环任务...');
        const oneTimeTask = await db.collection('tasks').add({
          data: {
            openid: 'test-user',
            title: '测试非循环任务-' + now.getTime(),
            description: '这是一个非循环任务',
            status: 'pending',
            frequency: 'none',
            createTime: now,
            updateTime: now,
            isTemplate: false
          }
        });
        console.log('非循环任务创建成功，ID:', oneTimeTask._id);
        
        // 2. 创建每日循环任务
        console.log('\n2. 创建每日循环任务...');
        const dailyTask = await db.collection('tasks').add({
          data: {
            openid: 'test-user',
            title: '测试每日任务-' + now.getTime(),
            description: '这是一个每日循环任务',
            status: 'pending',
            frequency: 'daily',
            createTime: now,
            updateTime: now,
            isTemplate: false
          }
        });
        console.log('每日任务创建成功，ID:', dailyTask._id);
        
        // 3. 创建每周循环任务（包含今天）
        console.log('\n3. 创建每周循环任务...');
        const weeklyTask = await db.collection('tasks').add({
          data: {
            openid: 'test-user',
            title: '测试每周任务-' + now.getTime(),
            description: '这是一个每周循环任务',
            status: 'pending',
            frequency: 'weekly',
            selectedDays: [todayDayOfWeek.toString()],
            createTime: now,
            updateTime: now,
            isTemplate: false
          }
        });
        console.log('每周任务创建成功，ID:', weeklyTask._id);
        
        // 4. 查询所有任务（不进行过滤）
        console.log('\n4. 查询所有任务...');
        const allTasks = await db.collection('tasks')
          .where({
            openid: 'test-user',
            isTemplate: false,
            status: _.neq('deleted')
          })
          .get();
        
        console.log('查询到的所有任务数量:', allTasks.data.length);
        allTasks.data.forEach(task => {
          console.log('  任务: ID=' + task._id + ', 标题=' + task.title + ', 状态=' + task.status + ', 频率=' + task.frequency + ', 创建时间=' + task.createTime);
        });
        
        // 5. 模拟getTasks的过滤逻辑
        console.log('\n5. 模拟getTasks的过滤逻辑...');
        const filteredTasks = allTasks.data.filter(task => {
          console.log('  处理任务:', task.title);
          
          if (task.frequency === 'none' || !task.frequency) {
            const taskCreateDate = new Date(task.createTime);
            const isBeforeToday = taskCreateDate <= today;
            console.log('    非循环任务，创建日期≤今天? ' + isBeforeToday);
            return isBeforeToday;
          }
          
          if (task.frequency === 'daily') {
            console.log('    每日任务，直接返回true');
            return true;
          }
          
          if (task.frequency === 'weekly') {
            const todayDayStr = String(todayDayOfWeek);
            const matchFound = task.selectedDays.some(day => {
              const dayStr = String(day).trim();
              return dayStr === todayDayStr;
            });
            console.log('    每周任务，今天匹配? ' + matchFound);
            return matchFound;
          }
          
          return false;
        });
        
        console.log('\n6. 过滤后的任务数量: ' + filteredTasks.length);
        filteredTasks.forEach(task => {
          console.log('  显示任务: ' + task.title + ', 频率: ' + task.frequency);
        });
        
        // 7. 最终只返回pending状态的任务
        const finalTasks = filteredTasks.filter(task => task.status === 'pending');
        console.log('\n7. 最终返回的待打卡任务数量: ' + finalTasks.length);
        
        console.log('\n=== 测试完成 ===');
        
        return {
          success: true,
          allTasks: allTasks.data.length,
          filteredTasks: filteredTasks.length,
          finalTasks: finalTasks.length,
          testDetails: {
            currentDate: now.toISOString(),
            todayDayOfWeek: todayDayOfWeek
          }
        };
        
      } catch (error) {
        console.error('测试过程中出错:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
    
    // 执行测试
    testTaskVisibility().then(result => {
      console.log('\n测试结果: ' + JSON.stringify(result, null, 2));
    });
  `;
  
  fs.writeFileSync('./temp_test_script.js', tempScript);
  return './temp_test_script.js';
};

// 执行测试并清理
const runTest = () => {
  console.log('准备测试任务可见性问题...');
  const tempScriptPath = createTempScript();
  
  console.log('请将此脚本部署到云函数环境中执行，或使用小程序开发工具的云开发控制台运行');
  console.log('\n=== 重要发现 ===');
  console.log('通过代码分析，我们发现getTasks云函数中有一个关键过滤逻辑:');
  console.log('对于非循环任务(frequency=none)，只有创建日期 ≤ 今天的任务才会显示');
  console.log('这可能是创建任务后首页不显示的原因');
  console.log('\n建议修复方案:');
  console.log('1. 修改getTasks云函数，移除非循环任务的日期过滤');
  console.log('2. 或者在createTask时确保创建日期正确设置为今天');
  console.log('\n临时测试方法:');
  console.log('1. 使用首页的"创建测试任务"按钮');
  console.log('2. 或手动创建每日任务，因为每日任务不受此过滤条件影响');
  
  // 清理临时文件
  setTimeout(() => {
    try {
      fs.unlinkSync(tempScriptPath);
      console.log('\n临时文件已清理');
    } catch (err) {
      // 忽略错误
    }
  }, 1000);
};

// 运行测试
runTest();
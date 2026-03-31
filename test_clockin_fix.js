// 测试打卡功能修复
// 运行方式：在开发者工具中执行此代码

const db = wx.cloud.database();
const _ = db.command;

// 测试函数
async function testClockInFix() {
  console.log('开始测试打卡功能修复...');
  
  try {
    // 1. 检查数据库连接
    console.log('1. 检查数据库连接...');
    
    // 2. 检查task_clock_ins集合是否存在
    console.log('2. 检查task_clock_ins集合...');
    const taskClockInsCount = await db.collection('task_clock_ins').count();
    console.log('   task_clock_ins集合文档数量:', taskClockInsCount.total);
    
    // 3. 检查task_clock_ins集合数据结构
    console.log('3. 检查task_clock_ins集合数据结构...');
    const taskClockInsSample = await db.collection('task_clock_ins').limit(5).get();
    console.log('   样本数据:', taskClockInsSample.data);
    
    // 4. 测试getTaskClockIns云函数
    console.log('4. 测试getTaskClockIns云函数...');
    // 首先获取一个有效的taskId
    const tasksResult = await db.collection('tasks').limit(1).get();
    if (tasksResult.data.length > 0) {
      const testTaskId = tasksResult.data[0]._id;
      console.log('   测试使用的taskId:', testTaskId);
      
      const cloudResult = await wx.cloud.callFunction({
        name: 'getTaskClockIns',
        data: {
          taskId: testTaskId
        }
      });
      
      console.log('   云函数返回结果:', cloudResult);
      
      // 验证返回数据结构
      if (cloudResult.result.success && cloudResult.result.data) {
        const data = cloudResult.result.data;
        if (Array.isArray(data.clockIns)) {
          console.log('   ✓ 打卡记录数组格式正确');
          console.log('   打卡记录数量:', data.clockIns.length);
        } else {
          console.log('   ✗ 打卡记录不是数组');
        }
        
        if (typeof data.todayCount === 'number') {
          console.log('   ✓ 今日打卡次数格式正确');
          console.log('   今日打卡次数:', data.todayCount);
        } else {
          console.log('   ✗ 今日打卡次数不是数字');
        }
      } else {
        console.log('   ✗ 云函数返回失败或缺少数据');
      }
    } else {
      console.log('   没有找到测试用的任务，跳过云函数测试');
    }
    
    console.log('\n✅ 测试完成，修复应该有效');
  } catch (error) {
    console.error('测试过程中出错:', error);
    console.log('\n❌ 测试失败，需要进一步检查');
  }
}

// 导出测试函数供外部调用
module.exports = { testClockInFix };

// 如果直接在开发者工具控制台运行，可以取消下面的注释
// testClockInFix();
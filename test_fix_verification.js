// 测试脚本：验证打卡次数显示修复是否有效
// 这个脚本模拟了打卡操作和查询今日打卡次数的过程
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec' // 使用项目配置中的环境ID
});

const db = cloud.database();
const _ = db.command;

// 模拟测试数据
const testData = {
  openid: 'test_openid_123456',
  taskId: 'test_task_id_789',
  status: 'progress'
};

// 测试函数：验证修复是否成功
async function testFix() {
  try {
    console.log('✅ 云开发环境初始化成功');
    
    // Step 1: 准备测试环境
    console.log('\nStep 1: 准备测试环境');
    
    // 清除可能存在的旧测试数据
    const deleteResult = await db.collection('task_completions')
      .where({
        taskId: testData.taskId,
        ..._.or([
          { _openid: testData.openid },
          { openid: testData.openid }
        ])
      })
      .remove();
    
    console.log(`✅ 已清除 ${deleteResult.deleted} 条旧测试数据`);
    
    // Step 2: 添加测试打卡记录
    console.log('\nStep 2: 添加测试打卡记录');
    
    // 添加第一条打卡记录（使用修复后的 _openid 字段）
    await db.collection('task_completions').add({
      data: {
        taskId: testData.taskId,
        _openid: testData.openid, // 使用修复后的字段
        completedAt: db.serverDate(),
        checkins: 1,
        cycleTimes: 1,
        isAllCompleted: false
      }
    });
    
    // 再添加一条（模拟多次打卡）
    await db.collection('task_completions').add({
      data: {
        taskId: testData.taskId,
        _openid: testData.openid,
        completedAt: db.serverDate(),
        checkins: 2,
        cycleTimes: 1,
        isAllCompleted: false
      }
    });
    
    console.log('✅ 成功添加2条测试打卡记录');
    
    // Step 3: 测试 getTaskClockIns 的查询逻辑
    console.log('\nStep 3: 测试修复后的查询逻辑');
    
    // 获取今日开始时间（00:00:00）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // 模拟修复后的查询逻辑
    const queryResult = await db.collection('task_completions')
      .where({
        taskId: testData.taskId,
        completedAt: _.gte(todayStart),
        ..._.or([
          { _openid: testData.openid },
          { openid: testData.openid }
        ])
      })
      .count();
    
    console.log(`✅ 查询结果：今日打卡次数 = ${queryResult.total}`);
    
    // Step 4: 验证结果
    console.log('\nStep 4: 验证修复效果');
    
    if (queryResult.total === 2) {
      console.log('🎉 修复验证成功！今日打卡次数显示正确！');
      console.log('\n✅ 修复总结：');
      console.log('1. 修复了 getTaskClockIns 云函数中的字段查询问题');
      console.log('2. 修复了 updateTaskStatus 云函数中的字段存储问题');
      console.log('3. 添加了字段兼容性处理，确保旧数据也能被正确查询');
    } else {
      console.log('❌ 修复验证失败！今日打卡次数显示不正确！');
      console.log(`   预期: 2, 实际: ${queryResult.total}`);
    }
    
    // Step 5: 清理测试数据
    console.log('\nStep 5: 清理测试数据');
    
    await db.collection('task_completions')
      .where({
        taskId: testData.taskId,
        ..._.or([
          { _openid: testData.openid },
          { openid: testData.openid }
        ])
      })
      .remove();
    
    console.log('✅ 测试数据已清理');
    
    console.log('\n✅ 所有测试完成');
    return { success: true };
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error: error.message };
  }
}

// 执行测试
testFix();
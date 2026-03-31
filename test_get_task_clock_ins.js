// 测试getTaskClockIns云函数在集合不存在时的响应
const cloud = require('wx-server-sdk');
const fs = require('fs');

// 读取本地云函数代码
const getTaskClockInsCode = fs.readFileSync('./cloudfunctions/getTaskClockIns/index.js', 'utf8');

// 模拟云函数环境
const mockCloud = {
  init: () => {},
  database: () => ({
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          get: async () => {
            // 模拟集合不存在的错误
            const error = new Error('database collection not exists');
            error.errCode = -502005;
            throw error;
          }
        })
      })
    }),
    command: {
      or: () => ({})
    }
  })
};

// 模拟云函数上下文
const mockContext = {
  OPENID: 'test-openid'
};

// 替换require依赖
jest.mock('wx-server-sdk', () => mockCloud);

// 执行测试
console.log('测试getTaskClockIns云函数在集合不存在时的响应...');

try {
  // 动态执行云函数代码
  const module = { exports: {} };
  const require = (moduleName) => {
    if (moduleName === 'wx-server-sdk') {
      return mockCloud;
    }
    throw new Error(`Module ${moduleName} not found`);
  };
  
  // 替换云函数代码中的exports和require
  const code = `
    const cloud = require('wx-server-sdk');
    ${getTaskClockInsCode.replace('exports.main =', 'module.exports =')}
  `;
  
  eval(code);
  
  // 调用云函数
  module.exports({
    taskId: 'test-task-id',
    todayOnly: true
  }, mockContext).then(result => {
    console.log('云函数返回结果:', JSON.stringify(result, null, 2));
    
    // 验证结果
    if (result.success === true) {
      console.log('✅ 测试通过：集合不存在时返回success:true');
      if (result.data.todayCount === 0) {
        console.log('✅ 测试通过：今日打卡次数为0');
      } else {
        console.log('❌ 测试失败：今日打卡次数不为0');
      }
      if (result.data.clockIns.length === 0) {
        console.log('✅ 测试通过：打卡记录数组为空');
      } else {
        console.log('❌ 测试失败：打卡记录数组不为空');
      }
    } else {
      console.log('❌ 测试失败：集合不存在时返回success:false');
    }
  }).catch(error => {
    console.error('❌ 测试失败：云函数抛出错误', error);
  });
} catch (error) {
  console.error('❌ 测试执行失败', error);
}
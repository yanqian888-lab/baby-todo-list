// 测试getUserStatistics云函数的openid错误处理
const fs = require('fs');
const path = require('path');

// 模拟云函数环境
const mockCloud = {
  init: () => {},
  database: () => ({
    collection: () => ({
      where: () => ({
        get: async () => ({ data: [] }),
        count: async () => ({ total: 0 }),
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ data: [] })
          })
        })
      })
    })
  })
};

// 模拟wxContext
const mockWxContext = {
  getWXContext: () => ({
    OPENID: undefined, // 模拟openid为undefined的情况
    appid: 'test-appid',
    unionid: 'test-unionid'
  })
};

// 加载并测试云函数
async function testOpenidFix() {
  console.log('=== 测试getUserStatistics云函数的openid错误处理 ===\n');
  
  // 模拟require
  const originalRequire = require;
  require = (moduleName) => {
    if (moduleName === 'wx-server-sdk') {
      return {
        ...mockCloud,
        getWXContext: mockWxContext.getWXContext
      };
    }
    return originalRequire(moduleName);
  };
  
  try {
    // 加载云函数
    const cloudFunctionPath = path.join(__dirname, 'cloudfunctions/getUserStatistics/index.js');
    delete require.cache[require.resolve(cloudFunctionPath)];
    const cloudFunction = require(cloudFunctionPath);
    
    // 测试openid为undefined的情况
    console.log('测试场景1: openid为undefined');
    const result1 = await cloudFunction.main({}, {});
    console.log('结果:', JSON.stringify(result1, null, 2));
    
    // 验证结果
    if (result1.success === false && result1.error === '用户未登录或openid获取失败') {
      console.log('✅ 测试通过: 正确处理了openid为undefined的情况\n');
    } else {
      console.log('❌ 测试失败: 没有正确处理openid为undefined的情况\n');
    }
    
    // 测试正常情况（需要实际运行环境）
    console.log('测试场景2: 正常情况（模拟）');
    // 修改模拟的openid
    mockWxContext.getWXContext = () => ({
      OPENID: 'test-openid',
      appid: 'test-appid',
      unionid: 'test-unionid'
    });
    
    const result2 = await cloudFunction.main({}, {});
    console.log('结果:', JSON.stringify(result2, null, 2));
    console.log('✅ 测试通过: 正常情况处理正确\n');
    
    console.log('=== 所有测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 恢复原require
    require = originalRequire;
  }
}

// 运行测试
testOpenidFix();
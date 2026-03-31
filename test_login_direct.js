// 直接测试login云函数逻辑的脚本
// 这个脚本不依赖微信环境，直接测试云函数的核心逻辑

/**
 * 模拟云函数环境
 */
const mockCloud = {
  getWXContext: () => {
    return {
      OPENID: 'mock-openid-1234567890',
      UNIONID: 'mock-unionid-abcdefg',
      APPID: 'wx07137a5c4479d119'
    };
  },
  init: () => {
    console.log('Mock cloud initialized');
  },
  openapi: {
    login: () => {
      return Promise.resolve({
        openid: 'mock-openid-1234567890',
        session_key: 'mock-session-key',
        unionid: 'mock-unionid-abcdefg'
      });
    }
  },
  database: () => {
    return {
      collection: () => {
        return {
          where: () => {
            return {
              get: () => {
                return Promise.resolve({ data: [] });
              }
            };
          },
          add: () => {
            return Promise.resolve({ _id: 'mock-user-id' });
          },
          update: () => {
            return Promise.resolve({ updated: 1 });
          }
        };
      }
    };
  }
};

// 模拟require
const originalRequire = require;
require = function(moduleName) {
  if (moduleName === 'wx-server-sdk') {
    return mockCloud;
  }
  return originalRequire(moduleName);
};

// 直接测试云函数
function testLoginCloudFunction() {
  console.log('=== 直接测试login云函数逻辑 ===');
  
  // 导入云函数
  const loginFunction = require('./cloudfunctions/login/index.js');
  
  // 模拟event和context
  const event = {
    code: 'mock-code-123'
  };
  
  const context = {
    appId: 'wx07137a5c4479d119'
  };
  
  // 调用云函数
  loginFunction.main(event, context)
    .then(result => {
      console.log('✅ 云函数调用成功:');
      console.log('   结果:', result);
      if (result.success && result.openid) {
        console.log('   ✅ 成功获取openid:', result.openid);
      } else {
        console.log('   ❌ 没有获取到openid');
      }
    })
    .catch(error => {
      console.error('❌ 云函数调用失败:', error);
    });
}

testLoginCloudFunction();
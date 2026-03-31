// 测试云函数调用
const testCloudFunction = async () => {
  try {
    console.log('🔍 开始测试云函数调用...');
    
    // 尝试调用getTasks云函数
    const result = await wx.cloud.callFunction({
      name: 'getTasks',
      data: {
        status: 'pending',
        test: true
      }
    });
    
    console.log('✅ 云函数调用成功!');
    console.log('📊 结果:', JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error('❌ 云函数调用失败:', error);
    return false;
  }
};

// 导出测试函数供其他文件使用
module.exports = {
  testCloudFunction
};

console.log('💡 测试脚本已加载，使用以下命令运行测试:');
console.log('💡 const { testCloudFunction } = require(\'./test_cloud_function.js\'); testCloudFunction();');
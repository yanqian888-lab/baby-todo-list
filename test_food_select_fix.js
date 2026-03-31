// 测试食物选择页面修复
const sensitivityService = require('./services/sensitivityService');

// 模拟微信小程序的getApp函数
function getApp() {
  return {
    globalData: {
      userInfo: {
        openId: 'test-openid'
      }
    }
  };
}

// 模拟wx.showToast函数
const wx = {
  showToast: (options) => {
    console.log('showToast:', options.title);
  },
  navigateBack: (options) => {
    console.log('navigateBack:', options);
  }
};

// 模拟getCurrentPages函数
function getCurrentPages() {
  return [
    {}, // 首页
    {
      setData: (data) => {
        console.log('prevPage.setData:', data);
      },
      saveBabyInfo: () => {
        console.log('prevPage.saveBabyInfo called');
      }
    }, // 当前页
    {} // 食物选择页
  ];
}

// 测试食物选择功能
async function testFoodSelection() {
  console.log('\n=== 测试食物选择功能 ===');
  
  try {
    // 测试1: 获取所有食物
    console.log('\n1. 测试获取所有食物:');
    const foods = await sensitivityService.getSensitivityFoods();
    console.log(`   ✓ 成功获取 ${foods.length} 种食物`);
    console.log('   前5种食物:', foods.slice(0, 5).map(f => f.name));
    
    // 测试2: 验证食物包含所需字段
    console.log('\n2. 测试食物数据结构:');
    const foodSample = foods[0];
    const requiredFields = ['_id', 'name', 'category', 'allergyLevel', 'sortOrder'];
    const hasAllFields = requiredFields.every(field => foodSample.hasOwnProperty(field));
    console.log(`   ✓ 食物包含所有必填字段: ${hasAllFields}`);
    console.log('   食物字段:', Object.keys(foodSample));
    
    // 测试3: 验证有20种食物
    console.log('\n3. 测试食物数量:');
    console.log(`   ✓ 食物数量: ${foods.length}`);
    if (foods.length === 20) {
      console.log('   ✓ 成功: 食物数量为20种');
    } else {
      console.log('   ✗ 失败: 食物数量不是20种');
    }
    
    // 测试4: 按类别分组
    console.log('\n4. 测试食物分类:');
    const categories = ['vegetables', 'fruits', 'grains', 'meats', 'proteins'];
    const categorized = categories.map(category => {
      const count = foods.filter(f => f.category === category).length;
      console.log(`   ${category}: ${count} 种`);
      return count;
    });
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testFoodSelection();
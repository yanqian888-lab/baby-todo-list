// 测试食物显示修复

// 模拟微信小程序的wx对象 - 在导入服务之前定义
const wx = {
  cloud: {
    database: () => ({
      collection: () => ({})
    })
  },
  showToast: () => {}
};

global.wx = wx;

// 现在导入服务
const sensitivityService = require('./services/sensitivityService');

// 测试食物数据加载和搜索功能
async function testFoodDisplay() {
  console.log('🧪 测试食物显示修复...');
  
  // 1. 测试获取所有食物
  try {
    const foods = await sensitivityService.getSensitivityFoods();
    console.log(`✅ 成功获取 ${foods.length} 种食物`);
    console.log('📋 所有食物列表:');
    foods.forEach((food, index) => {
      console.log(`${index + 1}. ${food.name} - ${food.category} - 过敏级别: ${food.allergyLevel}`);
    });
    
    // 2. 检查菠萝泥是否存在
    const pineapple = foods.find(f => f.name === '菠萝泥');
    if (pineapple) {
      console.log(`\n🍍 菠萝泥信息:`);
      console.log(`   - ID: ${pineapple._id}`);
      console.log(`   - 类别: ${pineapple.category}`);
      console.log(`   - 过敏级别: ${pineapple.allergyLevel}`);
      console.log(`   - 排序: ${pineapple.sortOrder}`);
    } else {
      console.log('❌ 未找到菠萝泥');
    }
    
    // 3. 测试高敏食物
    const highAllergyFoods = foods.filter(f => f.allergyLevel === 3);
    console.log(`\n⚠️  高敏食物 (allergyLevel = 3):`);
    highAllergyFoods.forEach(food => {
      console.log(`   - ${food.name}`);
    });
    
    // 4. 测试分类
    const categories = [...new Set(foods.map(f => f.category))];
    console.log(`\n🏷️  食物分类:`);
    categories.forEach(category => {
      const count = foods.filter(f => f.category === category).length;
      console.log(`   - ${category}: ${count} 种`);
    });
    
    console.log('\n🎉 所有测试通过！');
    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 运行测试
testFoodDisplay();
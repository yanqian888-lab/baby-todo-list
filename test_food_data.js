// 测试食物数据
const foodData = [
  { _id: '1', name: '菠菜', category: 'vegetables', allergyLevel: 1, sortOrder: 1 },
  { _id: '2', name: '胡萝卜', category: 'vegetables', allergyLevel: 1, sortOrder: 2 },
  { _id: '3', name: '南瓜', category: 'vegetables', allergyLevel: 1, sortOrder: 3 },
  { _id: '4', name: '土豆', category: 'vegetables', allergyLevel: 1, sortOrder: 4 },
  { _id: '5', name: '西红柿', category: 'vegetables', allergyLevel: 2, sortOrder: 5 },
  { _id: '6', name: '西兰花', category: 'vegetables', allergyLevel: 1, sortOrder: 6 },
  { _id: '7', name: '苹果', category: 'fruits', allergyLevel: 1, sortOrder: 1 },
  { _id: '8', name: '香蕉', category: 'fruits', allergyLevel: 1, sortOrder: 2 },
  { _id: '9', name: '梨', category: 'fruits', allergyLevel: 1, sortOrder: 3 },
  { _id: '10', name: '草莓', category: 'fruits', allergyLevel: 2, sortOrder: 4 },
  { _id: '11', name: '橙子', category: 'fruits', allergyLevel: 2, sortOrder: 5 },
  { _id: '12', name: '大米', category: 'grains', allergyLevel: 1, sortOrder: 1 },
  { _id: '13', name: '小米', category: 'grains', allergyLevel: 1, sortOrder: 2 },
  { _id: '14', name: '燕麦', category: 'grains', allergyLevel: 1, sortOrder: 3 },
  { _id: '15', name: '面粉', category: 'grains', allergyLevel: 2, sortOrder: 4 },
  { _id: '16', name: '鸡肉', category: 'meats', allergyLevel: 1, sortOrder: 1 },
  { _id: '17', name: '猪肉', category: 'meats', allergyLevel: 2, sortOrder: 2 },
  { _id: '18', name: '牛肉', category: 'meats', allergyLevel: 2, sortOrder: 3 },
  { _id: '19', name: '鸡蛋', category: 'proteins', allergyLevel: 2, sortOrder: 1 },
  { _id: '20', name: '豆腐', category: 'proteins', allergyLevel: 1, sortOrder: 2 }
];

// 测试食物数据
function testFoodData() {
  console.log('\n=== 测试食物数据 ===');
  
  // 测试1: 食物数量
  console.log('\n1. 测试食物数量:');
  console.log(`   ✓ 食物数量: ${foodData.length}`);
  if (foodData.length === 20) {
    console.log('   ✓ 成功: 食物数量为20种');
  } else {
    console.log('   ✗ 失败: 食物数量不是20种');
  }
  
  // 测试2: 验证所有食物都有必要的字段
  console.log('\n2. 测试食物字段完整性:');
  const requiredFields = ['_id', 'name', 'category', 'allergyLevel', 'sortOrder'];
  let allFieldsValid = true;
  
  foodData.forEach((food, index) => {
    const missingFields = requiredFields.filter(field => !food.hasOwnProperty(field));
    if (missingFields.length > 0) {
      console.log(`   ✗ 第${index + 1}种食物(${food.name})缺少字段: ${missingFields.join(', ')}`);
      allFieldsValid = false;
    }
  });
  
  if (allFieldsValid) {
    console.log('   ✓ 所有食物都包含必要字段');
  }
  
  // 测试3: 按类别分组
  console.log('\n3. 测试按类别分组:');
  const categories = ['vegetables', 'fruits', 'grains', 'meats', 'proteins'];
  
  categories.forEach(category => {
    const foodsInCategory = foodData.filter(food => food.category === category);
    console.log(`   ${category}: ${foodsInCategory.length} 种`);
  });
  
  // 测试4: 显示所有食物
  console.log('\n4. 所有食物列表:');
  foodData.forEach((food, index) => {
    console.log(`   ${index + 1}. ${food.name} (${food.category}, 过敏级别: ${food.allergyLevel})`);
  });
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testFoodData();
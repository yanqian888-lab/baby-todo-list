const fs = require('fs');
const XLSX = require('xlsx');

// 读取Excel文件
const workbook = XLSX.readFile('./宝宝辅食食材排敏与添加指南.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

// 提取关键信息
const categories = {};
const foodList = [];

// 整理数据
for (const row of data) {
    const category = row['食材分类'];
    const food = {
        name: row['具体食材'],
        age: row['添加月龄'],
        order: row['排敏顺序'],
        sensitivity: row['致敏等级'],
        notes: row['备注（重点提示）']
    };
    
    if (!categories[category]) {
        categories[category] = [];
    }
    categories[category].push(food);
    foodList.push(food);
}

// 生成Markdown格式的食物分类表
console.log('# 宝宝辅食食材排敏与添加指南\n');
console.log('## 一、食材分类表\n');

for (const [category, foods] of Object.entries(categories)) {
    console.log(`### ${category} (共${foods.length}种)\n`);
    console.log('| 食材名称 | 添加月龄 | 排敏顺序 | 致敏等级 | 备注 |');
    console.log('|---------|---------|---------|---------|------|');
    
    // 按排敏顺序排序
    foods.sort((a, b) => a.order - b.order);
    
    foods.forEach(food => {
        console.log(`| ${food.name} | ${food.age} | ${food.order} | ${food.sensitivity} | ${food.notes} |`);
    });
    console.log('\n');
}

// 生成推荐算法相关信息
console.log('## 二、排敏推荐算法\n');
console.log('### 推荐原则\n');
console.log('- **优先顺序**：按「排敏顺序」字段从小到大依次推荐');
console.log('- **分类完成规则**：每个分类下的食材全部排敏完成后再推荐下一个分类');
console.log('- **添加月龄**：严格按照「添加月龄」字段推荐适合当前宝宝月龄的食材');
console.log('- **致敏等级**：低敏 → 中敏 → 高敏的顺序进行推荐');
console.log('\n');

console.log('### 排敏天数规则\n');
console.log('- 低敏食材：连续食用3天');
console.log('- 中敏食材：连续食用4天');
console.log('- 高敏食材：连续食用5天');
console.log('\n');

console.log('### 分类顺序\n');
const categoryOrder = Object.keys(categories);
categoryOrder.forEach((category, index) => {
    console.log(`${index + 1}. ${category}`);
});
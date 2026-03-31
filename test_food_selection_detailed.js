// 详细测试食物选择功能的完整流程
const fs = require('fs');
const path = require('path');

// 模拟微信小程序的 Page 函数和数据结构
function mockPage(options) {
    const page = {
        data: { ...options.data },
        setData: function(newData) {
            this.data = { ...this.data, ...newData };
            console.log('setData:', newData);
        },
        ...options
    };
    return page;
}

// 读取并解析食物选择页面的JavaScript文件
function loadPageCode() {
    try {
        const pagePath = path.join(__dirname, 'pages/sensitivity/food-select.js');
        const pageCode = fs.readFileSync(pagePath, 'utf8');
        return pageCode;
    } catch (error) {
        console.error('读取页面代码失败:', error);
        return null;
    }
}

// 测试食物选择功能的完整流程
function testFoodSelectionFlow() {
    console.log('\n=== 详细测试食物选择功能 ===\n');
    
    // 1. 模拟食物数据
    const mockFoods = [
        { _id: "1", name: "菠菜", category: "vegetables", allergyLevel: 1 },
        { _id: "2", name: "胡萝卜", category: "vegetables", allergyLevel: 1 },
        { _id: "3", name: "苹果", category: "fruits", allergyLevel: 1 },
        { _id: "4", name: "香蕉", category: "fruits", allergyLevel: 1 }
    ];
    
    // 2. 创建模拟页面实例
    const mockPageOptions = {
        data: {
            allFoods: mockFoods,
            foodCategories: [],
            searchKeyword: '',
            selectedFoodIds: [],
            foodPreferences: {},
            selectedFoodNames: []
        },
        
        // 模拟 categorizeFoods 函数
        categorizeFoods: function(foods) {
            const categories = [
                { id: 'vegetables', name: '根茎类', recommendation: '建议6~8月龄' },
                { id: 'fruits', name: '水果类', recommendation: '建议6~8月龄' }
            ];
            
            return categories.map(category => {
                const categoryFoods = foods.filter(food => food.category === category.id);
                return { ...category, foods: categoryFoods };
            }).filter(category => category.foods.length > 0);
        },
        
        // 模拟 isFoodSelected 函数
        isFoodSelected: function(foodId) {
            const stringFoodId = String(foodId);
            return this.data.selectedFoodIds.includes(stringFoodId);
        },
        
        // 模拟 toggleFoodSelection 函数
        toggleFoodSelection: function(e) {
            const foodId = String(e.currentTarget.dataset.foodId);
            console.log(`\n切换选择: 食物ID = ${foodId}`);
            
            const selectedFoodIds = [...this.data.selectedFoodIds];
            const index = selectedFoodIds.indexOf(foodId);
            
            if (index !== -1) {
                selectedFoodIds.splice(index, 1);
                console.log(`移除食物ID: ${foodId}`);
            } else {
                selectedFoodIds.push(foodId);
                console.log(`添加食物ID: ${foodId}`);
            }
            
            this.setData({ selectedFoodIds });
            console.log(`当前选择的食物ID: ${selectedFoodIds}`);
        }
    };
    
    const page = mockPage(mockPageOptions);
    
    // 3. 初始化食物类别
    page.setData({
        foodCategories: page.categorizeFoods(mockFoods)
    });
    
    // 4. 测试选择食物
    console.log('\n=== 测试选择食物流程 ===\n');
    
    // 测试选择菠菜 (ID: "1")
    console.log('1. 选择菠菜 (ID: "1")');
    page.toggleFoodSelection({
        currentTarget: { dataset: { foodId: "1" } }
    });
    
    // 验证选择状态
    console.log(`\n验证选择状态 - 菠菜: ${page.isFoodSelected("1") ? "已选择" : "未选择"}`);
    console.log(`当前选择数量: ${page.data.selectedFoodIds.length}`);
    
    // 测试选择胡萝卜 (ID: "2")
    console.log('\n2. 选择胡萝卜 (ID: "2")');
    page.toggleFoodSelection({
        currentTarget: { dataset: { foodId: "2" } }
    });
    
    // 验证选择状态
    console.log(`\n验证选择状态 - 胡萝卜: ${page.isFoodSelected("2") ? "已选择" : "未选择"}`);
    console.log(`当前选择数量: ${page.data.selectedFoodIds.length}`);
    
    // 测试取消选择菠菜 (ID: "1")
    console.log('\n3. 取消选择菠菜 (ID: "1")');
    page.toggleFoodSelection({
        currentTarget: { dataset: { foodId: "1" } }
    });
    
    // 验证选择状态
    console.log(`\n验证选择状态 - 菠菜: ${page.isFoodSelected("1") ? "已选择" : "未选择"}`);
    console.log(`当前选择数量: ${page.data.selectedFoodIds.length}`);
    
    // 测试类型不匹配情况
    console.log('\n4. 测试类型不匹配情况');
    console.log(`验证选择状态 - 胡萝卜 (数字ID): ${page.isFoodSelected(2) ? "已选择" : "未选择"}`);
    
    // 5. 测试搜索功能
    console.log('\n=== 测试搜索功能 ===\n');
    
    // 模拟搜索函数
    const mockApplySearch = function() {
        const keyword = this.data.searchKeyword.toLowerCase();
        if (!keyword) {
            this.setData({ foodCategories: this.categorizeFoods(this.data.allFoods) });
            return;
        }
        
        const filteredFoods = this.data.allFoods.filter(food => 
            food.name.toLowerCase().includes(keyword)
        );
        
        this.setData({ foodCategories: this.categorizeFoods(filteredFoods) });
        console.log(`搜索 "${keyword}", 找到 ${filteredFoods.length} 种食物`);
    };
    
    // 测试搜索功能
    page.setData({ searchKeyword: "苹果" });
    mockApplySearch.call(page);
    
    console.log(`\n搜索结果数量: ${page.data.foodCategories.reduce((sum, cat) => sum + cat.foods.length, 0)}`);
    
    // 清空搜索
    page.setData({ searchKeyword: "" });
    mockApplySearch.call(page);
    console.log(`清空搜索后数量: ${page.data.foodCategories.reduce((sum, cat) => sum + cat.foods.length, 0)}`);
    
    console.log('\n=== 测试完成 ===\n');
    
    return true;
}

// 运行测试
testFoodSelectionFlow();
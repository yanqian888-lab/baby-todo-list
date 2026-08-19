// pages/sensitivity/food-select.js

/**
 * 排敏食物选择页面
 * 功能：
 * 1. 搜索食物
 * 2. 选择食物
 * 3. 设置食物偏好（是否喜欢、是否过敏）
 * 4. 保存选择结果
 */

// 导入排敏服务
const sensitivityService = require('../../../services/sensitivityService');
const { safeDateFormat } = require('../../../utils/helpers');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    searchKeyword: '',
    foodCategories: [], // 食物分类列表
    allFoods: [], // 所有食物数据
    selectedFoodIds: [], // 已选择的食物ID
    selectedFoodMap: {}, // 已选择的食物映射，用于WXML绑定
    likeOptions: ['请选择', '不喜欢', '一般', '喜欢'], // 是否喜欢选项，索引对应 likeStatus+1 (0=不喜欢, 1=一般, 2=喜欢)
    allergyOptions: ['请选择', '不过敏', '轻微过敏', '重度过敏'], // 是否过敏选项
    foodPreferences: {}, // 存储每个食物的偏好设置
    loading: false,
    // 日期选择相关数据
    selectedDate: safeDateFormat(new Date()), // 默认选择当前日期
    startDate: '2023-01-01', // 开始日期
    endDate: safeDateFormat(new Date()), // 结束日期（默认为当前日期）
    showDatePicker: true, // 是否显示日期选择器（从宝宝信息页进入时隐藏）
    // 自定义食物相关数据
    showCustomFoodModal: false, // 是否显示自定义食物弹窗
    foodCategoryOptions: ['高铁基础谷物类', '淀粉类根茎蔬菜', '绿叶蔬菜类', '瓜茄类蔬菜', '低糖低酸水果类', '菌菇类', '中敏食材', '高敏食材'], // 食物种类选项
    customFood: {
      name: '', // 食物名称
      categoryIndex: 0, // 食物种类索引
      allergyLevel: 1, // 排敏天数对应的过敏级别（1:3天, 2:5天）
      likeIndex: 0, // 喜欢程度索引
      allergyIndex: 0 // 过敏情况索引
    },
    customFoodIdCounter: Date.now(), // 用于生成自定义食物的ID
    scrollTop: 0, // scroll-view 滚动位置
    scrollIntoView: '' // scroll-view 自动滚动定位的目标元素 id
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 页面加载时，初始化数据
    // 保存已选择的食物信息，确保只有当options.selectedFoods存在且非空时才尝试解析
    this.data.selectedFoodsFromPrevPage = [];
    
    // 保存修改模式
    this.data.modifyMode = options && options.modify === 'true';
    console.log('修改模式:', this.data.modifyMode);
    
    // 保存今日排敏记录
    this.data.todayRecord = null;
    
    // 处理传递过来的今日排敏记录
    if (options && options.record && typeof options.record === 'string' && options.record.trim() !== '') {
      try {
        const decodedStr = decodeURIComponent(options.record);
        // 只有当decodedStr是有效的JSON字符串时才尝试解析
        if (decodedStr && decodedStr.trim() && (/^\[|\{/).test(decodedStr.trim())) {
          this.data.todayRecord = JSON.parse(decodedStr);
          console.log('今日排敏记录:', this.data.todayRecord);
        }
      } catch (error) {
        console.error('解析今日排敏记录失败:', error);
        this.data.todayRecord = null;
      }
    }
    
    // 确保options存在且selectedFoods是字符串类型
    if (options && options.selectedFoods && typeof options.selectedFoods === 'string' && options.selectedFoods.trim() !== '') {
      try {
        const decodedStr = decodeURIComponent(options.selectedFoods);
        // 只有当decodedStr是有效的JSON字符串（以[{或{开头，以}]或}结尾）时才尝试解析
        if (decodedStr && decodedStr.trim() && (/^\[|\{/).test(decodedStr.trim())) {
          this.data.selectedFoodsFromPrevPage = JSON.parse(decodedStr);
        }
      } catch (error) {
        console.error('解析已选择食物信息失败:', error);
        this.data.selectedFoodsFromPrevPage = [];
      }
    }
    
    // 新增：接收用户选择的日期
    const selectedDate = options && options.selectedDate ? options.selectedDate : safeDateFormat(new Date());
    const startDate = '2023-01-01';
    const endDate = safeDateFormat(new Date());
    this.setData({
      selectedDate: selectedDate,
      startDate: startDate,
      endDate: endDate
    });
    console.log('选择的日期:', selectedDate);
    
    // 新增：判断是否从宝宝信息页进入，支持多选
    const isFromBabyInfo = options && options.from === 'babyInfo';
    // 从宝宝信息页进入时，隐藏日期选择器
    this.setData({
      isFromBabyInfo: isFromBabyInfo,
      showDatePicker: !isFromBabyInfo
    });
    console.log('是否从宝宝信息页进入:', isFromBabyInfo, '显示日期选择器:', !isFromBabyInfo);
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: isFromBabyInfo ? '选择已排敏食物' : '选择排敏食物'
    });
    
    await this.initData();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    // 页面渲染完成后，可以进行一些DOM操作
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: async function () {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 页面显示时，刷新数据
    // 保存已选择的食物信息，确保只有当options.selectedFoods存在且非空时才尝试解析
    this.data.selectedFoodsFromPrevPage = [];
    const options = this.options;
    
    // 确保options存在且selectedFoods是字符串类型
    if (options && options.selectedFoods && typeof options.selectedFoods === 'string' && options.selectedFoods.trim() !== '') {
      try {
        const decodedStr = decodeURIComponent(options.selectedFoods);
        // 只有当decodedStr是有效的JSON字符串（以[{或{开头，以}]或}结尾）时才尝试解析
        if (decodedStr && decodedStr.trim() && (/^\[|\{/).test(decodedStr.trim())) {
          this.data.selectedFoodsFromPrevPage = JSON.parse(decodedStr);
        }
      } catch (error) {
        console.error('解析已选择食物信息失败:', error);
        this.data.selectedFoodsFromPrevPage = [];
      }
    }
    
    // 处理selectedDate参数
    if (options && options.selectedDate) {
      this.setData({
        selectedDate: options.selectedDate
      });
      console.log('onShow中获取的selectedDate:', options.selectedDate);
    }
    
    await this.initData();
  },

  /**
   * 检查所选日期是否已有排敏记录
   */
  checkExistingRecord(selectedDate) {
    try {
      console.log('=== 开始检查已有记录 ===');
      console.log('检查日期:', selectedDate);
      
      const app = getApp();
      const userId = app.globalData.userInfo?.openId || app.globalData.userInfo?._id;
      const babyId = app.globalData.userInfo?.babyInfo?._id || 'local-baby-id';
      const familyId = wx.getStorageSync('currentFamilyId') || null;
      
      console.log('当前用户ID:', userId, '当前家庭ID:', familyId);
      console.log('当前宝宝ID:', babyId);
      
      if (!selectedDate) {
        console.warn('未提供日期参数');
        return null;
      }
      
      // 确保selectedDate是有效的日期字符串
      const normalizedSelectedDate = this.normalizeDateString(selectedDate);
      console.log('标准化后的选择日期:', normalizedSelectedDate);
      
      // 从本地存储获取所有排敏记录
      const sensitivityRecords = wx.getStorageSync('sensitivity_records') || [];
      console.log('本地存储中的记录数量:', sensitivityRecords.length);
      
      // 查找所选日期的记录（按家庭隔离）
      const existingRecord = sensitivityRecords.find(record => {
        const recordUserId = record.userId;
        
        // 按家庭隔离数据
        if (familyId) {
          // 家庭模式下：严格只匹配同家庭的记录，不再兼容无 familyId 的旧记录
          if (record.familyId !== familyId) {
            return false;
          }
        } else if (recordUserId !== userId) {
          return false;
        }
        
        // 处理日期
        let recordDate = record.date;
        if (!recordDate) {
          recordDate = record.createTime || new Date().toISOString();
        }
        
        const normalizedRecordDate = this.normalizeDateString(recordDate);
        console.log('比较日期:', {
          foodName: record.foodName,
          recordDate: normalizedRecordDate,
          selectedDate: normalizedSelectedDate,
          isMatch: normalizedRecordDate === normalizedSelectedDate
        });
        
        return normalizedRecordDate === normalizedSelectedDate;
      });
      
      console.log('找到的已有记录:', existingRecord);
      console.log('=== 检查已有记录结束 ===');
      
      return existingRecord;
    } catch (error) {
      console.error('检查已有记录失败:', error);
      return null;
    }
  },

  /**
   * 标准化日期字符串，确保格式一致
   * @param {string|Date} date - 日期字符串或日期对象
   * @returns {string} 格式化的日期字符串 (YYYY-MM-DD)
   */
  normalizeDateString(date) {
    if (!date) return '';
    
    let dateObj;
    if (typeof date === 'string') {
      // 尝试直接解析
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // 尝试解析其他格式
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      console.warn('无法解析日期:', date);
      return '';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },

  /**
   * 计算每个食物的排敏进度
   * @param {Array} records - 用户的排敏记录
   * @param {Array} categories - 食物分类列表
   * @returns {Object} 食物名称到排敏进度的映射
   */
  _calculateFoodProgress(records, categories) {
    const progressMap = {};
    
    // 从宝宝信息中获取已排敏食物（在宝宝信息页添加的视为已完成）
    const babyInfo = wx.getStorageSync('babyInfo') || {};
    const userInfo = wx.getStorageSync('userInfo') || {};
    const userBabyInfo = userInfo.babyInfo || {};
    const babySafeFoods = new Set();
    
    // 收集宝宝信息中的已排敏食物（从多个可能的位置获取）
    let safeFoodsList = [];
    if (Array.isArray(babyInfo.safeFoodsList) && babyInfo.safeFoodsList.length > 0) {
      safeFoodsList = babyInfo.safeFoodsList;
    } else if (Array.isArray(userBabyInfo.safeFoodsList) && userBabyInfo.safeFoodsList.length > 0) {
      safeFoodsList = userBabyInfo.safeFoodsList;
    } else if (Array.isArray(babyInfo.selectedFoodsList) && babyInfo.selectedFoodsList.length > 0) {
      safeFoodsList = babyInfo.selectedFoodsList;
    }
    
    console.log('📊 _calculateFoodProgress - safeFoodsList:', safeFoodsList);
    
    if (Array.isArray(safeFoodsList)) {
      safeFoodsList.forEach(food => {
        let foodName = null;
        if (typeof food === 'string') {
          foodName = food;
        } else if (food.foodName) {
          foodName = food.foodName;
        } else if (food.name) {
          foodName = food.name;
        }
        if (foodName) {
          babySafeFoods.add(String(foodName).trim());
        }
      });
    }
    
    console.log('👶 _calculateFoodProgress - babySafeFoods:', Array.from(babySafeFoods));
    
    // 按食物名称分组记录
    const recordsByFood = {};
    records.forEach(record => {
      if (!record.foodName) return;
      if (!recordsByFood[record.foodName]) {
        recordsByFood[record.foodName] = [];
      }
      recordsByFood[record.foodName].push(record);
    });
    
    // 遍历所有分类中的食物
    categories.forEach(category => {
      category.foods.forEach(food => {
        // 获取该食物需要的总排敏天数
        const totalDays = food.allergyLevel === 3 ? 5 : 3;
        
        // 首先检查食物是否在宝宝信息中已排敏（优先级最高）
        if (babySafeFoods.has(food.name)) {
          console.log(`✅ ${food.name} 在宝宝信息中，标记为已完成`);
          progressMap[food.name] = {
            currentDays: totalDays,
            totalDays: totalDays,
            isComplete: true,
            fromBabyInfo: true
          };
          return; // 跳过后续处理
        }
        
        // 然后检查是否有排敏记录
        const foodRecords = recordsByFood[food.name];
        if (foodRecords && foodRecords.length > 0) {
          // 计算唯一日期数（实际排敏天数）
          const uniqueDates = new Set(foodRecords.map(r => this.normalizeDateString(r.date))).size;
          
          progressMap[food.name] = {
            currentDays: uniqueDates,
            totalDays: totalDays,
            isComplete: uniqueDates >= totalDays
          };
        }
      });
    });
    
    console.log('食物排敏进度:', progressMap);
    return progressMap;
  },

  /**
   * 查找食物最近一次的历史记录（昨天或更早）
   * @param {string} foodName - 食物名称
   * @param {string} beforeDate - 在此日期之前查找（默认今天）
   * @returns {Object|null} 最近的历史记录或null
   */
  findLastRecordForFood(foodName, beforeDate = null) {
    try {
      if (!foodName) return null;
      
      const app = getApp();
      // 获取所有可能的用户ID
      const possibleUserIds = [
        app.globalData.userInfo?.openId,
        app.globalData.userInfo?._id,
        app.globalData.userInfo?._openid,
        wx.getStorageSync('userInfo')?.openId,
        wx.getStorageSync('userInfo')?._id,
        wx.getStorageSync('userInfo')?._openid
      ].filter(id => id);
      
      const babyId = app.globalData.userInfo?.babyInfo?._id || 'local-baby-id';
      
      // 如果未指定日期，使用今天
      const referenceDate = beforeDate || this.data.selectedDate || this.normalizeDateString(new Date());
      
      // 从本地存储获取所有排敏记录
      const sensitivityRecords = wx.getStorageSync('sensitivity_records') || [];
      
      console.log(`=== 查找食物历史记录 ===`);
      console.log(`食物名称: ${foodName}`);
      console.log(`参考日期: ${referenceDate}`);
      console.log(`当前用户ID候选:`, possibleUserIds);
      console.log(`本地存储记录总数:`, sensitivityRecords.length);
      console.log('所有本地记录详情:', sensitivityRecords.map(r => ({ 
        food: r.foodName, 
        userId: r.userId, 
        _openid: r._openid,
        openId: r.openId,
        date: r.date,
        likeStatus: r.likeStatus,
        allergyStatus: r.allergyStatus
      })));
      
      // 查找该食物在此日期之前的记录，按日期倒序排列
      const previousRecords = sensitivityRecords
        .filter(record => {
          // 1. 检查食物名称匹配
          if (record.foodName !== foodName) {
            return false;
          }
          
          // 2. 检查用户ID是否匹配（支持多种字段名）
          const recordUserId = record.userId || record._openid || record.openId;
          const userMatch = possibleUserIds.length === 0 || possibleUserIds.includes(recordUserId);
          
          console.log(`检查记录匹配:`, {
            foodName: record.foodName,
            recordUserId: recordUserId,
            userMatch: userMatch,
            possibleUserIds: possibleUserIds
          });
          
          if (!userMatch) {
            console.log(`  -> 用户ID不匹配，跳过`);
            return false;
          }
          
          // 3. 检查日期（只找参考日期之前的记录，不包括当天）
          const recordDate = this.normalizeDateString(record.date);
          const dateMatch = recordDate < referenceDate;
          
          console.log(`  -> 日期比较: ${recordDate} < ${referenceDate} = ${dateMatch}`);
          
          return dateMatch;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log(`=== 查找结果 ===`);
      console.log(`找到历史记录数量:`, previousRecords.length);
      if (previousRecords.length > 0) {
        console.log(`最近的历史记录:`, {
          foodName: previousRecords[0].foodName,
          date: previousRecords[0].date,
          likeStatus: previousRecords[0].likeStatus,
          allergyStatus: previousRecords[0].allergyStatus
        });
      }
      
      return previousRecords.length > 0 ? previousRecords[0] : null;
    } catch (error) {
      console.error('查找食物历史记录失败:', error);
      return null;
    }
  },

  /**
   * 根据已有记录设置页面状态
   */
  setPageStateFromExistingRecord(existingRecord) {
    if (existingRecord) {
      console.log('=== 开始处理已有记录 ===');
      console.log('处理的记录:', existingRecord);
      
      // 设置为修改模式
      this.data.modifyMode = true;
      this.data.todayRecord = existingRecord;
      
      // 获取当前页面数据中的食物分类
      let foodCategories = this.data.foodCategories;
      console.log('当前食物分类数量:', foodCategories.length);
      console.log('当前食物分类:', foodCategories);
      
      // 检查是否有自定义食物分类
      if (!foodCategories || foodCategories.length === 0) {
        console.log('食物分类为空，重新获取');
        // 如果食物分类为空，尝试从allFoods获取
        foodCategories = this.data.allFoods;
        console.log('从allFoods获取的食物分类数量:', foodCategories.length);
      }
      
      // 查找对应的食物
      let foundFood = null;
      let foodId = null;
      
      // 首先尝试通过食物名称查找（最可靠的方式）
      if (existingRecord.foodName) {
        console.log('通过食物名称查找:', existingRecord.foodName);
        for (const category of foodCategories) {
          if (category.foods && Array.isArray(category.foods)) {
            console.log('检查分类:', category.name, '食物数量:', category.foods.length);
            for (const food of category.foods) {
              console.log('比较食物名称:', food.name, '===', existingRecord.foodName, '=', food.name === existingRecord.foodName);
              if (food.name === existingRecord.foodName) {
                foundFood = food;
                foodId = food._id;
                console.log('找到食物:', foundFood);
                break;
              }
            }
            if (foundFood) break;
          }
        }
      }
      
      // 如果通过食物名称没有找到，尝试通过foodId查找
      if (!foundFood && existingRecord.foodId) {
        foodId = existingRecord.foodId;
        console.log('通过foodId查找:', foodId);
        // 在当前食物分类中查找
        for (const category of foodCategories) {
          if (category.foods && Array.isArray(category.foods)) {
            const food = category.foods.find(f => f._id === foodId || f.foodId === foodId);
            if (food) {
              foundFood = food;
              console.log('通过foodId找到食物:', foundFood);
              break;
            }
          }
        }
      }
      
      // 如果找到食物，更新selectedFoodMap和selectedFoodIds
      if (foundFood && foodId) {
        console.log('准备勾选食物:', foundFood.name, 'ID:', foodId);
        
        // 直接更新selectedFoodMap和selectedFoodIds
        const selectedFoodIds = [foodId];
        const selectedFoodMap = {};
        selectedFoodMap[foodId] = true;
        
        // 设置食物偏好
        const foodPreferences = {};
        foodPreferences[foodId] = {
          likeIndex: existingRecord.likeStatus + 1, // 转换为前端需要的索引（0-3）
          allergyIndex: existingRecord.allergyStatus + 1 // 转换为前端需要的索引（0-3）
        };
        
        console.log('准备更新的页面数据:', {
          selectedFoodIds: selectedFoodIds,
          selectedFoodMap: selectedFoodMap,
          foodPreferences: foodPreferences
        });
        
        // 更新页面数据
        this.setData({
          selectedFoodIds: selectedFoodIds,
          selectedFoodMap: selectedFoodMap,
          foodPreferences: foodPreferences
        }, () => {
          // 在setData回调中再次确认更新结果
          console.log('更新后的页面数据:', {
            selectedFoodIds: this.data.selectedFoodIds,
            selectedFoodMap: this.data.selectedFoodMap,
            foodPreferences: this.data.foodPreferences
          });
          console.log('已成功勾选食物:', foundFood.name);
        });
        
        console.log('已设置为修改模式，记录:', existingRecord);
      } else {
        console.log('未找到对应的食物，无法自动勾选');
        console.log('查找条件:', {
          foodName: existingRecord.foodName,
          foodId: existingRecord.foodId
        });
      }
      
      console.log('=== 处理已有记录结束 ===');
    }
  },

  /**
   * 初始化数据
   */
  async initData() {
    console.log('=== initData 开始 ===');
    console.log('isFromBabyInfo:', this.data.isFromBabyInfo);
    
    const babyInfo = wx.getStorageSync('babyInfo') || {};
    const userInfo = wx.getStorageSync('userInfo') || {};
    console.log('babyInfo.safeFoodsList:', babyInfo.safeFoodsList);
    console.log('userInfo.babyInfo?.safeFoodsList:', userInfo.babyInfo?.safeFoodsList);
    
    this.setData({
      loading: true
    });

    // 模拟获取食物分类和食物数据
    setTimeout(async () => {
      // 根据"宝宝辅食食材排敏与添加指南"表格完全构建食物分类和食物数据
      const foodData = require('../../../data/sensitivityFoods.js');
      const mockCategories = foodData.categories.map(c => ({
        id: c.id,
        name: c.name,
        recommendation: '',
        foods: c.foods.map(f => ({
          _id: f._id,
          name: f.name,
          category: c.name,
          month: '',
          order: f.sensitivityOrder,
          allergyLevel: f.allergyLevel,
          recipes: f.recipes || []
        }))
      }));

      // 初始化selectedFoodMap和selectedFoodIds
      const selectedFoodMap = {};
      const selectedFoodIds = [];
      const foodPreferences = {};
      
      console.log('=== 开始从本地存储加载自定义食物 ===');
      
      // 检查本地存储是否可用
      try {
        wx.setStorageSync('test_key', 'test_value');
        wx.removeStorageSync('test_key');
        console.log('本地存储可用');
      } catch (error) {
        console.error('本地存储不可用:', error);
      }
      
      // 从本地存储获取自定义食物
      let customFoodsFromStorage = [];
      try {
        console.log('=== 开始加载自定义食物 ===');
        
        // 1. 获取本地存储中的数据
        const storageData = wx.getStorageSync('custom_sensitivity_foods');
        console.log('从本地存储获取的原始数据:', storageData);
        console.log('原始数据类型:', typeof storageData);
        console.log('原始数据是否为数组:', Array.isArray(storageData));
        
        // 2. 处理不同类型的数据
        if (storageData) {
          if (Array.isArray(storageData)) {
            // 2.1 数组类型，直接使用
            customFoodsFromStorage = storageData;
            console.log('检测到数组，直接使用');
          } else {
            // 2.2 非数组类型，重置为空数组
            customFoodsFromStorage = [];
            console.log('数据不是数组，使用空数组');
            // 将本地存储中的数据重置为空数组，确保下次加载时数据格式正确
            wx.setStorageSync('custom_sensitivity_foods', []);
            console.log('已将本地存储中的custom_sensitivity_foods重置为空数组');
          }
        } else {
          // 2.3 空值情况，使用空数组
          customFoodsFromStorage = [];
          console.log('本地存储中没有自定义食物，使用空数组');
        }
        
        console.log('最终使用的自定义食物数组:', customFoodsFromStorage);
        console.log('最终自定义食物数量:', customFoodsFromStorage.length);
      } catch (error) {
        console.error('从本地存储获取自定义食物失败:', error);
        customFoodsFromStorage = [];
      }
      
      // 额外检查：确保自定义食物数组中的每个元素都是对象
      customFoodsFromStorage = customFoodsFromStorage.filter(food => typeof food === 'object' && food !== null);
      console.log('过滤后的自定义食物数组:', customFoodsFromStorage);
      console.log('过滤后的自定义食物数量:', customFoodsFromStorage.length);
      
      console.log('最终使用的自定义食物数组:', customFoodsFromStorage);
      console.log('最终自定义食物数量:', customFoodsFromStorage.length);
      console.log('=== 从本地存储加载自定义食物完成 ===');
      
      // 添加自定义食物分类到mockCategories的开头
      const customCategory = {
        id: 'custom',
        name: '自定义食物',
        recommendation: '自定义食物',
        foods: customFoodsFromStorage
      };
      
      // 将自定义食物分类添加到mockCategories的开头
      const categoriesWithCustom = [customCategory, ...mockCategories];
      
      // 如果是修改模式，处理今日排敏记录
      if (this.data.modifyMode && this.data.todayRecord) {
        const todayRecord = this.data.todayRecord;
        console.log('处理修改模式下的今日排敏记录:', todayRecord);
        
        // 查找对应的食物ID
        let foodId = todayRecord.foodId;
        if (!foodId) {
          // 如果没有foodId，尝试通过食物名称查找
          let foundFood = null;
          categoriesWithCustom.forEach(category => {
            const food = category.foods.find(f => f.name === todayRecord.foodName);
            if (food) {
              foundFood = food;
            }
          });
          if (foundFood) {
            foodId = foundFood._id;
          }
        }
        
        // 如果找到食物ID，更新selectedFoodMap和selectedFoodIds
        if (foodId) {
          selectedFoodIds.push(String(foodId));
          selectedFoodMap[String(foodId)] = true;
          
          // 设置食物偏好
          foodPreferences[String(foodId)] = {
            likeIndex: todayRecord.likeStatus + 1, // 转换为前端需要的索引（0-3）
            allergyIndex: todayRecord.allergyStatus + 1 // 转换为前端需要的索引（0-3）
          };
        }
      }
      // 否则处理从其他页面传递过来的已选择食物信息
      else if (this.data.selectedFoodsFromPrevPage && this.data.selectedFoodsFromPrevPage.length > 0) {
        this.data.selectedFoodsFromPrevPage.forEach(food => {
          // 处理不同格式的已选择食物信息
          const foodId = food.foodId || food._id || food.id;
          if (foodId) {
            selectedFoodIds.push(String(foodId));
            selectedFoodMap[String(foodId)] = true;
            
            // 处理偏好设置（如果有的话）
            // likeStatus: -1=不喜欢, 0=一般, 1=喜欢 转换为 likeIndex: 1, 2, 3
            // allergyStatus: 0=不过敏, 1=过敏, 2=严重过敏 转换为 allergyIndex: 1, 2, 3
            if (food.likeStatus !== undefined || food.allergyStatus !== undefined) {
              let likeIndex = 0;
              if (food.likeStatus === -1) likeIndex = 1;
              else if (food.likeStatus === 0) likeIndex = 2;
              else if (food.likeStatus === 1) likeIndex = 3;
              
              let allergyIndex = 0;
              if (food.allergyStatus === 0) allergyIndex = 1;
              else if (food.allergyStatus === 1) allergyIndex = 2;
              else if (food.allergyStatus === 2) allergyIndex = 3;
              
              foodPreferences[String(foodId)] = {
                likeIndex: likeIndex,
                allergyIndex: allergyIndex
              };
            }
          }
        });
      }
      
      // 获取已排敏的食物信息
      const app = getApp();
      // 正确获取userId，使用_id而不是openId
      const userId = app.globalData.userInfo?._id || app.globalData.userInfo?.openId;
      const babyId = app.globalData.userInfo?.babyInfo?._id || 'local-baby-id';
      
      // 在过滤食物之前，先检查所选日期是否已有记录
      // 如果已经通过URL传入了todayRecord，不再查询覆盖，避免家庭成员修改时取到旧记录
      // 如果当前是修改模式（modify=true）但todayRecord缺失，也不查询覆盖，防止选中错误食物
      if (!this.data.todayRecord && !this.data.modifyMode) {
        const selectedDate = this.data.selectedDate;
        console.log('初始化时检查已有记录，当前日期:', selectedDate);
        const existingRecord = this.checkExistingRecord(selectedDate);
        if (existingRecord) {
          console.log('初始化时找到已有记录，提前设置modifyMode');
          // 提前设置modifyMode和todayRecord，这样在过滤时会保留该食物
          this.data.modifyMode = true;
          this.data.todayRecord = existingRecord;
        }
      }
      
      // 存储已排敏的食物名称
      const excludedFoodNames = new Set();
      
      // 从本地存储获取已排敏记录
      const sensitivityRecords = wx.getStorageSync('sensitivity_records') || [];
      sensitivityRecords.forEach(record => {
        // 只添加当前用户和宝宝的排敏记录
        if ((record.userId === userId || record.userId === app.globalData.userInfo?.openId) && 
            (record.babyId === babyId || record.babyId === 'local-baby-id')) {
          // 暂时不添加，先收集起来，后续与宝宝信息中的已排敏食物进行比对
        }
      });
      
      // 从宝宝信息中获取已排敏食物
      let babyInfo = app.globalData.userInfo?.babyInfo;
      // 确保babyInfo存在
      if (!babyInfo) {
        // 尝试从本地存储获取宝宝信息
        babyInfo = wx.getStorageSync('babyInfo');
      }
      
      // 宝宝信息中的已排敏食物集合，用于后续判断
      const babySafeFoods = new Set();
      
      if (babyInfo) {
        // 处理已排敏食物列表
        if (babyInfo.safeFoodsList && Array.isArray(babyInfo.safeFoodsList)) {
          babyInfo.safeFoodsList.forEach(food => {
            if (typeof food === 'string') {
              excludedFoodNames.add(food);
              babySafeFoods.add(food);
            } else if (food.foodName) {
              excludedFoodNames.add(food.foodName);
              babySafeFoods.add(food.foodName);
            } else if (food.name) {
              excludedFoodNames.add(food.name);
              babySafeFoods.add(food.name);
            }
          });
        } else if (babyInfo.safeFoods) {
          // 处理字符串格式的已排敏食物
          const safeFoods = babyInfo.safeFoods.split(',').filter(food => food.trim());
          safeFoods.forEach(food => {
            excludedFoodNames.add(food.trim());
            babySafeFoods.add(food.trim());
          });
        }
      }
      
      // 从数据库获取已排敏记录（通过服务层方法）
      let userRecords = [];
      const familyId = wx.getStorageSync('currentFamilyId') || null;
      try {
        userRecords = await sensitivityService.getUserSensitivityRecords(userId, babyId, familyId);
        userRecords.forEach(record => {
          if (record.foodName) {
            // 只有当宝宝信息中也包含该食物时，才将其标记为已排敏
            // 这样当用户在宝宝信息页删除该食物后，它会重新出现在选择列表中
            if (babySafeFoods.has(record.foodName)) {
              excludedFoodNames.add(record.foodName);
            }
          }
        });
      } catch (error) {
        console.warn('从数据库获取已排敏记录失败:', error);
      }
      
      console.log('已排敏的食物:', Array.from(excludedFoodNames));
      
      // 计算每个食物的排敏进度
      const foodProgressMap = this._calculateFoodProgress(userRecords, categoriesWithCustom);
      
      // 对每个分类下的食材按照排敏顺序进行排序，并过滤掉已排敏的食物
      const sortedCategories = categoriesWithCustom.map(category => {
        // 自定义食物分类不进行过滤，只对系统分类进行过滤
        if (category.id === 'custom') {
          return {
            ...category,
            foods: [...category.foods]
              // 排序，自定义食物按照添加时间倒序排列
              .sort((a, b) => {
                // 假设自定义食物的order字段是时间戳，越大表示越新
                return b.order - a.order;
              })
          };
        } else {
          // 系统分类进行正常的过滤和排序
          return {
            ...category,
            foods: [...category.foods]
              // 排序
              .sort((a, b) => a.order - b.order)
              // 过滤掉已排敏的食物，但在修改模式或从宝宝信息页进入时保留已选择的食物
              .filter(food => {
                // 检查食物是否在已排敏列表中
                const isExcluded = excludedFoodNames.has(food.name);
                
                console.log('检查食物:', food.name, '是否已排敏:', isExcluded, '是否从宝宝信息页进入:', this.data.isFromBabyInfo);
                
                // 在修改模式下，保留今日排敏记录中的食物
                if (isExcluded && this.data.modifyMode && this.data.todayRecord) {
                  const result = food.name === this.data.todayRecord.foodName;
                  console.log('修改模式下，是否保留:', result);
                  return result;
                }
                
                // 从宝宝信息页进入时，不过滤已排敏食物（让用户可以选择已排敏食物）
                if (this.data.isFromBabyInfo) {
                  console.log('从宝宝信息页进入，显示所有食物');
                  return true;
                }
                
                // 其他情况，过滤掉已排敏的食物
                const result = !isExcluded;
                console.log('最终是否保留:', result);
                return result;
              })
              // 添加排敏进度信息
              .map(food => {
                const progress = foodProgressMap[food.name];
                if (progress) {
                  console.log(`📊 ${food.name} 进度:`, progress);
                  return {
                    ...food,
                    sensitivityProgress: progress
                  };
                }
                return food;
              })
          };
        }
      });
      
      // 过滤掉没有食物的系统分类，但保留自定义食物分类（即使它没有食物）
      const filteredCategories = sortedCategories.filter(category => {
        if (category.id === 'custom') {
          // 保留自定义食物分类
          return true;
        } else {
          // 系统分类只有在有食物时才保留
          return category.foods.length > 0;
        }
      });
      
      this.setData({
        foodCategories: filteredCategories,
        allFoods: filteredCategories,
        loading: false,
        selectedFoodMap: selectedFoodMap,
        selectedFoodIds: selectedFoodIds,
        foodPreferences: foodPreferences
      }, () => {
        // 页面加载后，检查所选日期是否已有排敏记录
        // 使用回调函数确保数据已更新
        if (!this.data.todayRecord && !this.data.modifyMode) {
          const existingRecord = this.checkExistingRecord(this.data.selectedDate);
          if (existingRecord) {
            // 如果已有记录且当前不是修改模式，设置为修改模式
            this.setPageStateFromExistingRecord(existingRecord);
          }
        }
        
        // 自动滚动到已选中的食物位置（使用页面整体滚动，更可靠）
        if (selectedFoodIds.length > 0) {
          const foodId = selectedFoodIds[0];
          setTimeout(() => {
            wx.pageScrollTo({
              selector: '#food-' + foodId,
              offsetTop: -80,
              duration: 300
            });
          }, 300);
        }
      });
    }, 500);
  },

  /**
   * 搜索输入事件
   * @param {Object} e - 事件对象，包含输入内容
   */
  onSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });

    // 根据关键词筛选食物
    this.filterFoods(keyword);
  },

  /**
   * 根据关键词筛选食物
   * @param {string} keyword - 搜索关键词
   */
  filterFoods: function (keyword) {
    if (!keyword) {
      // 如果关键词为空，显示所有食物
      this.setData({
        foodCategories: this.data.allFoods
      });
      return;
    }

    // 根据关键词筛选食物
    const filteredCategories = this.data.allFoods.map(category => {
      const filteredFoods = category.foods.filter(food => {
        return food.name.includes(keyword);
      });

      return {
        ...category,
        foods: filteredFoods
      };
    }).filter(category => category.foods.length > 0);

    this.setData({
      foodCategories: filteredCategories
    });
  },

  /**
   * 判断食物是否已被选中
   * @param {string|number} foodId - 食物ID
   * @returns {boolean} 是否已被选中
   */
  isFoodSelected: function (foodId) {
    // 确保foodId是字符串类型，与selectedFoodIds数组中的类型一致
    const stringFoodId = String(foodId);
    
    // 遍历selectedFoodIds数组，查找是否包含该食物ID
    for (let i = 0; i < this.data.selectedFoodIds.length; i++) {
      if (String(this.data.selectedFoodIds[i]) === stringFoodId) {
        return true;
      }
    }
    
    return false;
  },

  /**
   * 切换食物选择状态
   * @param {Object} e - 事件对象，包含食物ID
   */
  toggleFoodSelection: function (e) {
    // 获取食物ID，并转换为字符串类型，确保与mock数据类型一致
    const foodId = String(e.currentTarget.dataset.foodId);
    
    // 复制当前的selectedFoodMap对象
    let selectedFoodMap = { ...this.data.selectedFoodMap };
    let selectedFoodIds = [...this.data.selectedFoodIds];
    let foodPreferences = { ...this.data.foodPreferences };
    
    // 查找食物ID在数组中的索引
    const index = selectedFoodIds.indexOf(foodId);
    const isSelected = index > -1;
    
    // 查找食物名称
    let foodName = null;
    for (const category of this.data.foodCategories) {
      const food = category.foods.find(f => String(f._id) === foodId);
      if (food) {
        foodName = food.name;
        break;
      }
    }
    
    // 根据不同场景使用不同的选择逻辑
    if (this.data.isFromBabyInfo) {
      // 场景1：从宝宝信息页进入，支持一次勾选多个食物
      if (isSelected) {
        // 取消选择
        selectedFoodIds.splice(index, 1);
        delete selectedFoodMap[foodId];
        delete foodPreferences[foodId];
      } else {
        // 添加选择
        selectedFoodIds.push(foodId);
        selectedFoodMap[foodId] = true;
        
        // 自动带入上次设置（如果存在历史记录）
        if (foodName) {
          const lastRecord = this.findLastRecordForFood(foodName);
          if (lastRecord) {
            console.log(`自动带入食物[${foodName}]的上次设置:`, lastRecord);
            foodPreferences[foodId] = {
              likeIndex: (lastRecord.likeStatus || 0) + 1, // 转换为前端索引（1-4）
              allergyIndex: (lastRecord.allergyStatus || 0) + 1 // 转换为前端索引（1-4）
            };
          }
        }
      }
    } else {
      // 场景2：从排敏tab首页进入，支持一次勾选1个食物
      if (!isSelected) {
        // 只保留当前食物
        selectedFoodIds = [foodId];
        selectedFoodMap = { [foodId]: true };
        foodPreferences = {}; // 清空之前的偏好设置
        
        // 自动带入上次设置（如果存在历史记录）
        if (foodName) {
          const lastRecord = this.findLastRecordForFood(foodName);
          if (lastRecord) {
            console.log(`自动带入食物[${foodName}]的上次设置:`, lastRecord);
            foodPreferences[foodId] = {
              likeIndex: (lastRecord.likeStatus || 0) + 1, // 转换为前端索引（1-4）
              allergyIndex: (lastRecord.allergyStatus || 0) + 1 // 转换为前端索引（1-4）
            };
          }
        }
      } else {
        // 取消选择，清空所有选择
        selectedFoodIds = [];
        selectedFoodMap = {};
        foodPreferences = {};
      }
    }
    
    // 更新selectedFoodIds数组和selectedFoodMap对象
    this.setData({
      selectedFoodIds: selectedFoodIds,
      selectedFoodMap: selectedFoodMap,
      foodPreferences: foodPreferences
    });
  },

  /**
   * 显示自定义食物弹窗
   */
  showCustomFoodModal: function () {
    this.setData({
      showCustomFoodModal: true
    });
  },

  /**
   * 隐藏自定义食物弹窗
   */
  hideCustomFoodModal: function () {
    this.setData({
      showCustomFoodModal: false
    });
  },

  /**
   * 处理自定义食物名称输入
   * @param {Object} e - 事件对象，包含输入内容
   */
  onCustomFoodNameInput: function (e) {
    this.setData({
      'customFood.name': e.detail.value
    });
  },

  /**
   * 处理自定义食物种类选择
   * @param {Object} e - 事件对象，包含选择索引
   */
  onCustomFoodCategoryChange: function (e) {
    this.setData({
      'customFood.categoryIndex': e.detail.value
    });
  },

  /**
   * 处理自定义食物排敏天数选择
   * @param {Object} e - 事件对象，包含选择索引
   */
  onCustomFoodDaysChange: function (e) {
    // 0: 3天, 1: 5天
    const allergyLevel = e.detail.value + 1;
    this.setData({
      'customFood.allergyLevel': allergyLevel
    });
  },

  /**
   * 处理自定义食物喜欢程度选择
   * @param {Object} e - 事件对象，包含选择索引
   */
  onCustomFoodLikeChange: function (e) {
    this.setData({
      'customFood.likeIndex': e.detail.value
    });
  },

  /**
   * 处理自定义食物过敏情况选择
   * @param {Object} e - 事件对象，包含选择索引
   */
  onCustomFoodAllergyChange: function (e) {
    this.setData({
      'customFood.allergyIndex': e.detail.value
    });
  },

  /**
   * 保存自定义食物
   */
  saveCustomFood: function () {
    // 验证表单
    const customFood = this.data.customFood;
    if (!customFood.name.trim()) {
      wx.showToast({
        title: '请输入食物名称',
        icon: 'none'
      });
      return;
    }

    // 生成自定义食物ID
    const customFoodId = 'custom_' + this.data.customFoodIdCounter;
    this.setData({
      customFoodIdCounter: this.data.customFoodIdCounter + 1
    });

    // 获取食物种类名称
    const foodCategory = this.data.foodCategoryOptions[customFood.categoryIndex];

    // 创建自定义食物对象，order字段使用时间戳，用于排序
    const newCustomFood = {
      _id: customFoodId,
      name: customFood.name.trim(),
      category: foodCategory,
      month: '自定义',
      order: Date.now(), // 使用当前时间戳，用于按照添加时间倒序排列
      allergyLevel: customFood.allergyLevel
    };

    console.log('=== 开始保存自定义食物 ===');
    console.log('要保存的自定义食物:', newCustomFood);

    // 1. 先将本地存储中的数据重置为空数组，确保数据格式正确
    try {
      wx.setStorageSync('custom_sensitivity_foods', []);
      console.log('已将本地存储中的custom_sensitivity_foods重置为空数组');
    } catch (error) {
      console.error('重置本地存储失败:', error);
    }

    // 2. 再次获取本地存储中的数据
    let existingCustomFoods = [];
    try {
      existingCustomFoods = wx.getStorageSync('custom_sensitivity_foods');
      console.log('重置后从本地存储获取的自定义食物:', existingCustomFoods);
      console.log('重置后获取的数据类型:', typeof existingCustomFoods);
      console.log('重置后获取的数据是否为数组:', Array.isArray(existingCustomFoods));
      
      // 确保是数组
      if (!Array.isArray(existingCustomFoods)) {
        existingCustomFoods = [];
        console.log('重置后数据不是数组，使用空数组');
      }
    } catch (error) {
      console.error('获取重置后的自定义食物失败:', error);
      existingCustomFoods = [];
    }

    // 3. 添加新自定义食物到现有列表
    existingCustomFoods.push(newCustomFood);
    console.log('添加新自定义食物后:', existingCustomFoods);
    console.log('添加后数组长度:', existingCustomFoods.length);

    // 4. 直接保存到本地存储
    try {
      wx.setStorageSync('custom_sensitivity_foods', existingCustomFoods);
      console.log('自定义食物已成功保存到本地存储');
      
      // 验证保存结果
      const savedCustomFoods = wx.getStorageSync('custom_sensitivity_foods');
      console.log('保存后立即验证:', savedCustomFoods);
      console.log('保存后验证的类型:', typeof savedCustomFoods);
      console.log('保存后验证的是否为数组:', Array.isArray(savedCustomFoods));
      console.log('保存后验证的长度:', Array.isArray(savedCustomFoods) ? savedCustomFoods.length : 'N/A');
    } catch (error) {
      console.error('保存自定义食物到本地存储失败:', error);
    }

    // 5. 重新初始化数据，确保自定义食物能显示
    this.initData();

    // 6. 自动选择新添加的自定义食物
    this.setData({
      selectedFoodIds: [customFoodId],
      selectedFoodMap: { [customFoodId]: true },
      // 设置食物偏好
      foodPreferences: {
        [customFoodId]: {
          likeIndex: customFood.likeIndex,
          allergyIndex: customFood.allergyIndex
        }
      },
      // 隐藏弹窗
      showCustomFoodModal: false,
      // 重置自定义食物表单
      customFood: {
        name: '',
        categoryIndex: 0,
        allergyLevel: 1,
        likeIndex: 0,
        allergyIndex: 0
      }
    });

    // 显示成功提示
    wx.showToast({
      title: '自定义食物添加成功',
      icon: 'success'
    });

    console.log('=== 保存自定义食物完成 ===');
  },

  /**
   * 将自定义食物保存到本地存储
   * @param {Object} customFood - 自定义食物对象
   */
  saveCustomFoodToLocal: function (customFood) {
    try {
      console.log('=== 开始保存自定义食物到本地存储 ===');
      console.log('要保存的自定义食物:', customFood);
      
      // 1. 先获取当前本地存储中的数据
      let customFoods = wx.getStorageSync('custom_sensitivity_foods');
      console.log('保存前本地存储中的自定义食物原始数据:', customFoods);
      console.log('保存前本地存储中的自定义食物类型:', typeof customFoods);
      console.log('保存前本地存储中的自定义食物是否为数组:', Array.isArray(customFoods));
      
      // 2. 处理获取到的数据
      if (!customFoods) {
        customFoods = [];
        console.log('本地存储中没有自定义食物，创建新数组');
      } else if (!Array.isArray(customFoods)) {
        customFoods = [];
        console.log('本地存储中的自定义食物不是数组，重新创建数组');
      }
      
      // 3. 添加新的自定义食物
      customFoods.push(customFood);
      console.log('添加新自定义食物后的数据:', customFoods);
      console.log('添加新自定义食物后的数据数量:', customFoods.length);
      
      // 4. 保存到本地存储
      wx.setStorageSync('custom_sensitivity_foods', customFoods);
      console.log('使用同步方法保存自定义食物到本地存储成功');
      
      // 5. 验证保存结果
      const savedCustomFoods = wx.getStorageSync('custom_sensitivity_foods');
      console.log('保存后立即从本地存储获取的自定义食物:', savedCustomFoods);
      console.log('保存后本地存储中的自定义食物数量:', savedCustomFoods ? savedCustomFoods.length : 0);
      console.log('=== 保存自定义食物到本地存储完成 ===');
    } catch (error) {
      console.error('保存自定义食物到本地存储失败:', error);
    }
  },

  /**
   * 获取食物的喜欢程度索引
   * @param {string} foodId - 食物ID
   * @returns {number} 喜欢程度索引
   */
  getLikeIndex: function (foodId) {
    // 确保foodId是字符串类型，与onLikeChange中使用的类型一致
    const stringFoodId = String(foodId);
    return this.data.foodPreferences[stringFoodId]?.likeIndex || 0;
  },

  /**
   * 获取食物的过敏程度索引
   * @param {string} foodId - 食物ID
   * @returns {number} 过敏程度索引
   */
  getAllergyIndex: function (foodId) {
    // 确保foodId是字符串类型，与onAllergyChange中使用的类型一致
    const stringFoodId = String(foodId);
    return this.data.foodPreferences[stringFoodId]?.allergyIndex || 0;
  },

  /**
   * 喜欢程度变化事件
   * @param {Object} e - 事件对象，包含食物ID和喜欢程度索引
   */
  onLikeChange: function (e) {
    const foodId = String(e.currentTarget.dataset.foodId);
    const likeIndex = e.detail.value;
    
    console.log('onLikeChange called, foodId:', foodId, 'likeIndex:', likeIndex);
    
    // 复制当前的foodPreferences对象
    const foodPreferences = {...this.data.foodPreferences};
    
    // 确保foodPreferences[foodId]是一个对象
    if (!foodPreferences[foodId]) {
      foodPreferences[foodId] = {};
    }
    
    // 更新喜欢程度索引
    foodPreferences[foodId].likeIndex = likeIndex;
    
    // 更新foodPreferences对象
    this.setData({
      foodPreferences: foodPreferences
    }, () => {
      console.log('onLikeChange setData completed, foodPreferences:', this.data.foodPreferences);
      console.log('onLikeChange setData completed, getLikeIndex:', this.getLikeIndex(foodId));
    });
  },

  /**
   * 过敏程度变化事件
   * @param {Object} e - 事件对象，包含食物ID和过敏程度索引
   */
  onAllergyChange: function (e) {
    const foodId = String(e.currentTarget.dataset.foodId);
    const allergyIndex = e.detail.value;
    
    console.log('onAllergyChange called, foodId:', foodId, 'allergyIndex:', allergyIndex);
    
    // 复制当前的foodPreferences对象
    const foodPreferences = {...this.data.foodPreferences};
    
    // 确保foodPreferences[foodId]是一个对象
    if (!foodPreferences[foodId]) {
      foodPreferences[foodId] = {};
    }
    
    // 更新过敏程度索引
    foodPreferences[foodId].allergyIndex = allergyIndex;
    
    // 更新foodPreferences对象
    this.setData({
      foodPreferences: foodPreferences
    }, () => {
      console.log('onAllergyChange setData completed, foodPreferences:', this.data.foodPreferences);
      console.log('onAllergyChange setData completed, getAllergyIndex:', this.getAllergyIndex(foodId));
    });
  },

  /**
   * 日期变化事件
   * @param {Object} e - 事件对象，包含选择的日期
   */
  onDateChange: function (e) {
    const selectedDate = e.detail.value;
    console.log('选择的日期:', selectedDate);
    
    // 更新selectedDate数据
    this.setData({
      selectedDate: selectedDate
    }, () => {
      // 确保selectedDate更新后再检查记录
      console.log('日期已更新为:', this.data.selectedDate);
      
      // 检查所选日期是否已有排敏记录
      const existingRecord = this.checkExistingRecord(selectedDate);
      if (existingRecord) {
        console.log('找到已有记录:', existingRecord);
        // 如果已有记录，设置为修改模式
        this.setPageStateFromExistingRecord(existingRecord);
      } else {
        console.log('未找到记录，重置为添加模式');
        // 如果没有记录，重置为添加模式
        this.data.modifyMode = false;
        this.data.todayRecord = null;
        this.setData({
          selectedFoodIds: [],
          selectedFoodMap: {},
          foodPreferences: {}
        });
        console.log('已设置为添加模式');
      }
    });
  },

  /**
   * 完成选择，保存结果
   */
  confirmSelection: function () {
    // 获取已选择的食物
    const selectedFoods = [];
    
    // 遍历所有食物分类和食物，找到已选择的食物
    this.data.foodCategories.forEach(category => {
      category.foods.forEach(food => {
        // 确保 food._id 是字符串，与 selectedFoodIds 和 foodPreferences 的键保持一致
        const foodIdStr = String(food._id);
        if (this.data.selectedFoodIds.includes(foodIdStr) || this.data.selectedFoodIds.includes(food._id)) {
          // 获取食物的偏好设置（使用字符串键）
          const preferences = this.data.foodPreferences[foodIdStr] || {};
          
          console.log('确认选择 - 食物:', food.name, 'foodId:', foodIdStr, 'preferences:', preferences);
          
          // 添加到已选择的食物列表
          selectedFoods.push({
            foodId: food._id,
            foodName: food.name,
            category: category.name,
            recommendation: category.recommendation,
            likeIndex: Number(preferences.likeIndex || 0),
            likeText: this.data.likeOptions[Number(preferences.likeIndex || 0)],
            allergyIndex: Number(preferences.allergyIndex || 0),
            allergyText: this.data.allergyOptions[Number(preferences.allergyIndex || 0)]
          });
        }
      });
    });
    
    // 保存选择的食物到本地存储和数据库
    const saveSelectedFoods = async () => {
      try {
        const app = getApp();
        const globalUserInfo = app.globalData.userInfo;
        const storageUserInfo = wx.getStorageSync('userInfo');
        const userInfo = globalUserInfo || storageUserInfo;
        
        console.log('=== 保存排敏记录 ===');
        console.log('globalUserInfo:', globalUserInfo ? { openId: globalUserInfo.openId, _id: globalUserInfo._id } : null);
        console.log('storageUserInfo:', storageUserInfo ? { openId: storageUserInfo.openId, _id: storageUserInfo._id } : null);
        console.log('使用的userInfo.openId:', userInfo?.openId);
        
        if (userInfo && userInfo.openId && selectedFoods.length > 0) {
          // 获取当前宝宝信息
          let babyInfo = this.data.babyInfo;
          if (!babyInfo) {
            // 尝试从本地存储获取宝宝信息
            const localBabyInfo = wx.getStorageSync('babyInfo');
            babyInfo = localBabyInfo || {};
          }
          
          // 为每个选择的食物创建排敏记录
          for (const food of selectedFoods) {
            // 创建排敏记录对象，使用用户选择的日期
            const selectedDate = this.data.selectedDate;
            
            // 使用 YYYY-MM-DD 格式存储日期，避免时区问题
            // 这样 normalizeDateString 可以直接返回相同格式
            const dateStr = this.normalizeDateString(selectedDate);
            
            // 获取当前家庭ID
            const familyId = wx.getStorageSync('currentFamilyId') || null;

            const sensitivityRecord = {
              userId: userInfo.openId,
              babyId: babyInfo._id || 'local-baby-id',
              foodId: food.foodId,
              foodName: food.foodName,
              category: food.category,
              status: 1, // 1表示进行中排敏，让服务层处理排敏天数逻辑
              likeStatus: food.likeIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
              allergyStatus: food.allergyIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
              allergyLevel: 1, // 默认低敏，后续可以从食物对象中获取
              date: dateStr, // 使用 YYYY-MM-DD 格式，避免时区问题
              createTime: new Date(),
              updatedAt: new Date().toISOString(),
              familyId: familyId
            };
            
            console.log('准备保存的排敏记录:', {
              userId: sensitivityRecord.userId,
              foodName: sensitivityRecord.foodName,
              date: sensitivityRecord.date,
              likeStatus: sensitivityRecord.likeStatus,
              allergyStatus: sensitivityRecord.allergyStatus
            });
            
            // 根据是否为修改模式调用不同的服务方法
            if (this.data.modifyMode) {
              // 修改模式下，更新现有记录
              await sensitivityService.updateSensitivityRecord(sensitivityRecord);
              console.log('已更新排敏记录:', sensitivityRecord.foodName);
            } else {
              // 非修改模式下，保存新记录
              await sensitivityService.saveSensitivityRecord(sensitivityRecord);
              console.log('已保存排敏记录:', sensitivityRecord.foodName);
            }
          }
          
          console.log('已选择的食物已保存:', selectedFoods.map(f => f.foodName));
        } else {
          console.warn('缺少必要信息，无法保存排敏记录:', {
            hasUserInfo: !!userInfo,
            hasOpenId: !!(userInfo && userInfo.openId),
            selectedFoodsCount: selectedFoods.length
          });
        }
      } catch (error) {
        console.error('保存排敏记录失败:', error);
      }
    };
    
    // 执行保存操作
    saveSelectedFoods().then(() => {
      // 显示选择结果
      wx.showToast({
        title: `已选择${selectedFoods.length}种食物`,
        icon: 'success',
        duration: 1500,
        complete: () => {
          // 延迟判断宝宝信息并跳转
          setTimeout(() => {
            // 检查是否已经填写了宝宝信息
            const userInfo = wx.getStorageSync('userInfo');
            let hasBabyInfo = false;
            
            // 检查用户信息中是否包含宝宝信息
            if (userInfo) {
              // 检查是否有宝宝昵称、宝宝年龄或完整的宝宝信息
              hasBabyInfo = !!(userInfo.babyName || userInfo.babyAge || userInfo.babyInfo);
            }
            
            // 检查是否是从其他页面进入的
            const pages = getCurrentPages();
            console.log('📱 当前页面栈:', pages.map(p => p.route));
            if (pages.length > 1) {
              const prevPage = pages[pages.length - 2];
              console.log('📱 上一页:', prevPage.route, 'onFoodsSelected存在:', typeof prevPage.onFoodsSelected === 'function');
              
              // 安全检查：只有当onFoodsSelected方法存在时才调用
              if (typeof prevPage.onFoodsSelected === 'function') {
                // 调用上一页的方法更新选中的食物信息
                console.log('📤 调用 prevPage.onFoodsSelected，数据:', selectedFoods);
                prevPage.onFoodsSelected(selectedFoods);
              } else {
                console.warn('⚠️ 上一页没有 onFoodsSelected 方法');
              }
              
              // 如果上一页是排敏首页，不再主动调用 checkBabyInfo
              // 因为返回首页后 onShow 会自动刷新，避免并发查询导致数据闪烁
              
              // 返回上一页
              wx.navigateBack();
            } else if (hasBabyInfo) {
              // 已经填写宝宝信息，跳转到排敏tab首页
              wx.switchTab({
                url: '/pages/sensitivity/index'
              });
            } else {
              // 没有填写宝宝信息，跳转到宝宝信息填写页，并传递已选择的食物信息
              wx.navigateTo({
                url: `/subpackages/profile/pages/baby-info?selectedFoods=${encodeURIComponent(JSON.stringify(selectedFoods))}`
              });
            }
          }, 1500);
        }
      });
    });
  },
  
  /**
   * 阻止事件冒泡
   */
  preventBubble: function() {
    // 仅用于阻止事件冒泡，无需其他操作
  }
});
// pages/profile/baby-info.js
const userService = require('../../../services/userService');
const familyService = require('../../../services/familyService');
const { safeDateFormat } = require('../../../utils/helpers');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    babyInfo: {
      nickname: '',
      birthday: '',
      gender: '',
      safeFoods: '',
      safeFoodsList: []
    },
    currentDate: '',
    lastUpdateTime: 0, // 数据最后更新时间戳，用于防止 onShow 覆盖刚更新的数据
    families: [],
    hasOwnFamily: false,
    currentTabId: 'my_family',
    isCurrentTabReadonly: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 设置当前日期为选择器的结束日期，确保只显示过去的日期
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    // 设置日期选择器的起始年份为10年前，允许选择历史年份
    const startYear = year - 10;
    const startDate = `${startYear}-01-01`;
    
    this.setData({
      currentDate: currentDate,
      startDate: startDate
    });
    
    // 加载家庭信息和宝宝信息
    this.loadFamilyInfo().then(() => {
      // 检查是否有已选择的食物信息
      if (options.selectedFoods) {
        try {
          const selectedFoods = JSON.parse(decodeURIComponent(options.selectedFoods));
          this.setData({
            'babyInfo.selectedFoods': selectedFoods,
            'babyInfo.selectedFoodsList': selectedFoods
          });
        } catch (error) {
          console.error('解析已选择食物信息失败:', error);
        }
      }
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function() {
    const userService = require('../../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    console.log('👀 onShow 被调用，当前数据时间戳:', this.data.lastUpdateTime);
    // 检查是否刚刚更新过数据（避免覆盖从食物选择页返回的数据）
    const now = Date.now();
    // 延长到10秒，避免从食物选择页返回时数据被旧数据覆盖导致列表跳动
    if (this.data.lastUpdateTime && (now - this.data.lastUpdateTime < 10000)) {
      console.log('⏭️ 跳过加载，数据刚刚更新');
      // 重置时间戳，允许下次正常加载
      this.setData({ lastUpdateTime: 0 });
      return;
    }
    // 每次显示页面时重新加载家庭信息，确保数据最新
    this.loadFamilyInfo();
  },

  /**
   * 加载家庭信息并设置 tabs
   */
  loadFamilyInfo: async function() {
    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const openId = userInfo.openId || userInfo.openid || userInfo._id || '';
      
      const result = await familyService.getMyFamilies();
      const familiesRaw = result.families || [];
      const families = familiesRaw.map(f => ({
        ...f,
        name: f.familyName || `${f.babyNickname || '宝宝'}的家`,
        isOwner: f.creatorOpenId === openId
      })).sort((a, b) => {
        // 自己创建的家庭排在前面
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        return 0;
      });
      
      const hasOwnFamily = families.some(f => f.isOwner);
      
      // 确定默认 tab
      let currentTabId = this.data.currentTabId;
      const validIds = families.map(f => f._id);
      if (!hasOwnFamily) validIds.push('my_family');
      
      if (!currentTabId || !validIds.includes(currentTabId)) {
        if (families.length > 0) {
          currentTabId = families[0]._id;
        } else {
          currentTabId = 'my_family';
        }
      }

      const isCurrentTabReadonly = currentTabId !== 'my_family' && !families.find(f => f._id === currentTabId)?.isOwner;
      
      this.setData({ families, hasOwnFamily, currentTabId, isCurrentTabReadonly });
      
      if (!isCurrentTabReadonly) {
        await this.loadBabyInfo();
      } else {
        const family = families.find(f => f._id === currentTabId);
        const familyBabyInfo = family?.babyInfo || {};
        this.setData({
          babyInfo: {
            nickname: familyBabyInfo.nickname || family?.babyNickname || '',
            birthday: familyBabyInfo.birthday || '',
            gender: familyBabyInfo.gender || '',
            safeFoods: '',
            safeFoodsList: [],
            selectedFoods: '',
            selectedFoodsList: []
          }
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
      this.setData({ currentTabId: 'my_family' });
      await this.loadBabyInfo();
    }
  },

  /**
   * 切换家庭 tab
   */
  switchTab: function(e) {
    const tabId = e.currentTarget.dataset.tabId;
    if (tabId === this.data.currentTabId) return;
    const isCurrentTabReadonly = tabId !== 'my_family' && !this.data.families.find(f => f._id === tabId)?.isOwner;
    this.setData({ currentTabId: tabId, isCurrentTabReadonly });
    if (!isCurrentTabReadonly) {
      this.loadBabyInfo();
    } else {
      const family = this.data.families.find(f => f._id === tabId);
      const familyBabyInfo = family?.babyInfo || {};
      this.setData({
        babyInfo: {
          nickname: familyBabyInfo.nickname || family?.babyNickname || '',
          birthday: familyBabyInfo.birthday || '',
          gender: familyBabyInfo.gender || '',
          safeFoods: '',
          safeFoodsList: [],
          selectedFoods: '',
          selectedFoodsList: []
        }
      });
    }
  },

  /**
   * 加载宝宝信息（按当前 tab 对应的家庭隔离）
   */
  loadBabyInfo: async function() {
    try {
      const currentTabId = this.data.currentTabId;
      const familyId = currentTabId !== 'my_family' ? currentTabId : null;
      console.log('📥 loadBabyInfo 开始加载，currentTabId:', currentTabId, 'familyId:', familyId);
      
      // 保护：如果数据刚刚更新过，且当前已有食物列表，跳过加载避免覆盖
      const now = Date.now();
      if (this.data.lastUpdateTime && (now - this.data.lastUpdateTime < 10000)) {
        const currentList = this.data.babyInfo?.selectedFoodsList || [];
        if (currentList.length > 0) {
          console.log('⏭️ loadBabyInfo 跳过，数据刚刚更新且已有食物列表');
          this.setData({ lastUpdateTime: 0 });
          return;
        }
      }
      
      const userInfo = await userService.getUserInfo();
      if (!userInfo) return;
      
      // 按家庭获取宝宝信息（优先家庭隔离数据）
      const sensitivityService = require('../../../services/sensitivityService');
      let babyInfo = await sensitivityService.getFamilyBabyInfo(familyId);
      
      // 兜底：如果按家庭没有数据，且当前是家庭 tab，尝试从 family 对象读取
      if (familyId && (!babyInfo || !babyInfo.nickname)) {
        const family = this.data.families.find(f => f._id === familyId);
        if (family && family.babyInfo) {
          babyInfo = family.babyInfo;
        }
      }
      
      // 最终兜底：全局 userInfo.babyInfo
      if (!babyInfo || !babyInfo.nickname) {
        babyInfo = userInfo.babyInfo || {};
      }
      
      let safeFoodsList = [];
      let safeFoods = '';
      
      if (babyInfo.safeFoodsList) {
        if (Array.isArray(babyInfo.safeFoodsList)) {
          safeFoodsList = babyInfo.safeFoodsList.map(food => {
            if (typeof food === 'string') {
              return { foodId: food, foodName: food, category: '', likeStatus: -2, allergyStatus: -1 };
            } else {
              return {
                foodId: food.foodId || food._id || food.name || food,
                foodName: food.foodName || food.name || food,
                category: food.category || '',
                likeStatus: food.likeStatus !== undefined ? food.likeStatus : -2,
                allergyStatus: food.allergyStatus !== undefined ? food.allergyStatus : -1
              };
            }
          });
        } else if (typeof babyInfo.safeFoodsList === 'string') {
          const foodsArray = babyInfo.safeFoodsList.split(',').map(food => food.trim()).filter(food => food);
          safeFoodsList = foodsArray.map(foodName => ({
            foodId: foodName, foodName: foodName, category: '', likeStatus: -2, allergyStatus: -1
          }));
        }
      } else if (babyInfo.safeFoods) {
        const foodsArray = babyInfo.safeFoods.split(',').map(food => food.trim()).filter(food => food);
        safeFoodsList = foodsArray.map(foodName => ({
          foodId: foodName, foodName: foodName, category: '', likeStatus: -2, allergyStatus: -1
        }));
      }
      
      // 从排敏记录中同步已完成的食材（仅当前家庭）
      const userId = userInfo.openId || userInfo._id;
      const babyId = babyInfo._id || 'local-baby-id';
      try {
        const records = await sensitivityService.getUserSensitivityRecords(userId, babyId, familyId);
        const config = await sensitivityService.getAllergyConfig();
        const foodGroups = {};
        records.forEach(record => {
          const foodName = record.foodName;
          if (!foodGroups[foodName]) foodGroups[foodName] = [];
          foodGroups[foodName].push(record);
        });
        for (const [foodName, foodRecords] of Object.entries(foodGroups)) {
          const uniqueDates = new Set();
          foodRecords.forEach(record => {
            const date = new Date(record.date);
            uniqueDates.add(safeDateFormat(date));
          });
          const allFoods = await sensitivityService.getSensitivityFoods();
          const food = allFoods.find(f => f.name === foodName);
          const requiredDays = food ? config[food.allergyLevel]?.days || 3 : 3;
          if (uniqueDates.size >= requiredDays) {
            const exists = safeFoodsList.some(f => f.foodName === foodName);
            if (!exists) {
              const lastRecord = foodRecords[foodRecords.length - 1];
              let likeStatus = -2;
              if (lastRecord) {
                if (lastRecord.likeStatus === 0) likeStatus = -1;
                else if (lastRecord.likeStatus === 1) likeStatus = 0;
                else if (lastRecord.likeStatus === 2) likeStatus = 1;
              }
              let allergyStatus = -1;
              if (lastRecord) {
                if (lastRecord.allergyStatus === 0) allergyStatus = 0;
                else if (lastRecord.allergyStatus === 1) allergyStatus = 1;
                else if (lastRecord.allergyStatus === 2) allergyStatus = 2;
              }
              safeFoodsList.push({
                foodId: food ? food._id : foodName,
                foodName: foodName,
                category: food ? food.category : '',
                likeStatus,
                allergyStatus
              });
              console.log(`✅ 从排敏记录同步已完成食物: ${foodName}`);
            }
          }
        }
      } catch (e) {
        console.warn('从排敏记录同步已完成食物失败:', e);
      }
      
      safeFoods = safeFoodsList.map(food => food.foodName).join(',');
      
      this.setData({
        babyInfo: {
          nickname: babyInfo.nickname || userInfo.babyName || '',
          birthday: babyInfo.birthday || '',
          gender: babyInfo.gender || '',
          safeFoods: safeFoods,
          safeFoodsList: safeFoodsList,
          selectedFoods: safeFoods,
          selectedFoodsList: safeFoodsList
        }
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      this.setData({
        babyInfo: { nickname: '', birthday: '', gender: '', safeFoods: '', safeFoodsList: [], selectedFoods: '', selectedFoodsList: [] }
      });
    }
  },

  /**
   * 昵称输入
   */
  onNicknameInput: function(e) {
    this.setData({
      'babyInfo.nickname': e.detail.value
    });
  },

  /**
   * 出生日期变化事件
   */
  onBirthdayChange: function(e) {
    const date = e.detail.value;
    this.setData({
      'babyInfo.birthday': date
    });
  },

  /**
   * 性别选择
   */
  onGenderChange: function(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      'babyInfo.gender': gender
    });
  },

  /**
   * 跳转到食物选择页面
   */
  navigateToFoodSelect() {
    const { selectedFoodsList } = this.data.babyInfo;
    
    wx.navigateTo({
      url: `/subpackages/sensitivity/pages/food-select?selectedFoods=${encodeURIComponent(JSON.stringify(selectedFoodsList))}&from=babyInfo`
    });
  },
  
  /**
   * 删除已选择的食物
   */
  deleteSelectedFood(e) {
    const index = e.currentTarget.dataset.index;
    const selectedFoodsList = [...this.data.babyInfo.selectedFoodsList];
    selectedFoodsList.splice(index, 1);
    
    this.setData({
      'babyInfo.selectedFoodsList': selectedFoodsList,
      'babyInfo.selectedFoods': selectedFoodsList.map(food => food.foodName).join(',')
    });
  },

  /**
   * 接收从食物选择页面返回的选中食物信息
   * @param {Array} selectedFoods - 选中的食物列表
   */
  onFoodsSelected(selectedFoods) {
    console.log('📥 onFoodsSelected 被调用，传入数据:', selectedFoods);
    if (!selectedFoods || selectedFoods.length === 0) {
      console.log('⚠️ 没有传入食物数据');
      return;
    }
    
    // 获取当前已选择的食物列表
    const currentSelectedFoodsList = this.data.babyInfo.selectedFoodsList || [];
    console.log('📋 当前已选择食物:', currentSelectedFoodsList);
    
    // 创建一个Map来存储唯一的食物，避免重复
    const foodMap = new Map();
    
    // 首先添加当前已选择的食物
    currentSelectedFoodsList.forEach(food => {
      const foodId = food.foodId || food._id || food.name || food;
      foodMap.set(foodId, food);
    });
    
    // 然后添加新选择的食物（转换字段格式）
    selectedFoods.forEach(food => {
      const foodId = food.foodId || food._id || food.name || food;
      console.log(`🍽️ 处理新食物: ${food.foodName}, foodId: ${foodId}, likeIndex: ${food.likeIndex}, allergyIndex: ${food.allergyIndex}`);
      
      // 转换 food-select 的 likeIndex 为 baby-info 页面标准的 likeStatus
      // food-select likeIndex: 0=未选择, 1=不喜欢, 2=一般, 3=喜欢
      // baby-info likeStatus: -2=未选择(不显示), -1=不喜欢, 0=一般, 1=喜欢
      const likeIndex = Number(food.likeIndex);
      let likeStatus = -2; // 默认为未选择
      if (likeIndex === 1) likeStatus = -1;     // 不喜欢
      else if (likeIndex === 2) likeStatus = 0;  // 一般
      else if (likeIndex === 3) likeStatus = 1;  // 喜欢
      
      // 转换 food-select 的 allergyIndex 为 baby-info 页面标准的 allergyStatus
      // food-select allergyIndex: 0=未选择, 1=不过敏, 2=轻微过敏, 3=重度过敏
      // baby-info allergyStatus: -1=未选择(不显示), 0=不过敏, 1=轻微过敏, 2=严重过敏
      const allergyIndex = Number(food.allergyIndex);
      let allergyStatus = -1; // 默认为未选择
      if (allergyIndex === 1) allergyStatus = 0; // 不过敏
      else if (allergyIndex === 2) allergyStatus = 1; // 轻微过敏
      else if (allergyIndex === 3) allergyStatus = 2; // 严重过敏
      
      const foodData = {
        foodId: foodId,
        foodName: food.foodName || food.name,
        category: food.category || '',
        likeStatus: likeStatus,
        allergyStatus: allergyStatus
      };
      console.log(`💾 设置食物数据:`, foodData);
      foodMap.set(foodId, foodData);
    });
    
    // 转换为数组
    const mergedFoodsList = Array.from(foodMap.values());
    const safeFoodsStr = mergedFoodsList.map(food => food.foodName).join(',');
    
    console.log('📤 合并后的食物列表:', mergedFoodsList);
    
    // 更新选中的食物信息到页面，并标记更新时间
    this.setData({
      'babyInfo.selectedFoods': safeFoodsStr,
      'babyInfo.selectedFoodsList': mergedFoodsList,
      lastUpdateTime: Date.now()
    }, () => {
      console.log('✅ setData 完成，当前数据:', this.data.babyInfo.selectedFoodsList);
    });
    
    // 同时更新本地存储的 userInfo 和家庭隔离缓存，确保数据持久化
    // 这样在 onShow 调用 loadBabyInfo 时能加载到最新数据
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      if (!userInfo.babyInfo) {
        userInfo.babyInfo = {};
      }
      userInfo.babyInfo.safeFoods = safeFoodsStr;
      userInfo.babyInfo.safeFoodsList = mergedFoodsList;
      userInfo.babyInfo.selectedFoods = safeFoodsStr;
      userInfo.babyInfo.selectedFoodsList = mergedFoodsList;
      wx.setStorageSync('userInfo', userInfo);
      
      // 同步写入家庭隔离缓存（防止 loadBabyInfo 从 families 集合回退时读到旧数据）
      const sensitivityService = require('../../../services/sensitivityService');
      const familyId = this.data.currentTabId !== 'my_family' ? this.data.currentTabId : null;
      sensitivityService.saveFamilyBabyInfo(userInfo.babyInfo, familyId);
      
      console.log('✅ 已同步更新 userInfo 和家庭缓存中的食物列表');
    } catch (e) {
      console.warn('同步更新 userInfo 失败:', e);
    }
  },



  /**
   * 保存宝宝信息
   */
  saveBabyInfo: async function() {
    if (this.data.isCurrentTabReadonly) {
      wx.showToast({ title: '只能编辑自己的家庭信息', icon: 'none' });
      return;
    }

    const { nickname, birthday, gender } = this.data.babyInfo;
    
    // 基本信息验证
    if (!nickname) {
      wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
      return;
    }
    
    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    
    if (!gender) {
      wx.showToast({ title: '请选择宝宝性别', icon: 'none' });
      return;
    }
    
    // 计算宝宝年龄
    const age = this.calculateAge(birthday);
    
    // 显示保存中提示
    wx.showLoading({ title: '保存中' });
    
    // 更新用户信息，添加宝宝信息
    const userInfo = {
      babyName: nickname,
      babyAge: age,
      babyInfo: this.data.babyInfo
    };
    
    try {
      const app = getApp();
      const currentTabId = this.data.currentTabId;
      const familyId = currentTabId !== 'my_family' ? currentTabId : null;
      
      // 确保babyId始终有定义
      let babyId = 'local-baby-id';
      
      // 获取选中的食物列表，确保是数组
      const selectedFoodsList = this.data.babyInfo.selectedFoodsList || [];
      
      // 处理选中的食物列表，确保格式正确
      let safeFoodsList = [];
      let safeFoodsStr = '';
      
      if (Array.isArray(selectedFoodsList) && selectedFoodsList.length > 0) {
        safeFoodsList = selectedFoodsList.map(food => {
          if (typeof food === 'string') {
            return { foodId: food, foodName: food, category: '', likeStatus: -2, allergyStatus: -1 };
          } else {
            return {
              foodId: food.foodId || food._id || food.name || food,
              foodName: food.foodName || food.name || food,
              category: food.category || '',
              likeStatus: food.likeStatus !== undefined ? food.likeStatus : -2,
              allergyStatus: food.allergyStatus !== undefined ? food.allergyStatus : -1
            };
          }
        });
        safeFoodsStr = safeFoodsList.map(food => food.foodName).join(',');
      }
      
      const fullBabyInfo = {
        nickname,
        birthday,
        gender,
        safeFoods: safeFoodsStr,
        safeFoodsList: safeFoodsList,
        babyAge: age,
        _id: babyId
      };
      
      // 1. 按家庭隔离保存宝宝信息（优先）
      const sensitivityService = require('../../../services/sensitivityService');
      await sensitivityService.saveFamilyBabyInfo(fullBabyInfo, familyId);
      
      // 2. 如果有家庭，同步更新 families 集合的 babyInfo
      if (familyId) {
        try {
          await familyService.updateBabyInfo(familyId, fullBabyInfo);
          console.log('✅ 已同步宝宝信息到家庭:', familyId);
        } catch (e) {
          console.warn('同步宝宝信息到家庭失败:', e);
        }
      }
      
      // 3. 保存到全局用户资料（兼容旧逻辑）
      userInfo.babyInfo = fullBabyInfo;
      await userService.updateUserInfo(userInfo);
      
      // 4. 保存到 baby_info 集合（通过云函数，用户级别兜底）
      if (app.globalData.userInfo && app.globalData.userInfo.openId) {
        const saveRes = await wx.cloud.callFunction({
          name: 'babyManager',
          data: {
            action: 'saveBabyInfo',
            babyInfo: fullBabyInfo
          }
        });
        if (saveRes.result && saveRes.result.success) {
          babyId = saveRes.result.babyId;
          fullBabyInfo._id = babyId;
        }
      }
      
      // 更新全局 userInfo
      if (app.globalData.userInfo) {
        app.globalData.userInfo.babyInfo = fullBabyInfo;
        wx.setStorageSync('userInfo', { ...app.globalData.userInfo });
      }
      
      // 5. 清理当前家庭的排敏记录（宝宝信息页添加的食物不应再有排敏记录）
      const userId = app.globalData.userInfo?.openId;
      const selectedFoodNames = new Set(safeFoodsList.map(f => f.foodName).filter(Boolean));
      const sensitivityRecords = wx.getStorageSync('sensitivity_records') || [];
      const newSensitivityRecords = sensitivityRecords.filter(record => {
        // 只删除当前用户、当前家庭下的匹配记录
        if (record.userId !== userId) return true;
        if (familyId && record.familyId !== familyId) return true;
        if (!familyId && record.familyId) return true;
        if (selectedFoodNames.has(record.foodName)) {
          console.log(`🗑️ 删除排敏记录: ${record.foodName} (familyId: ${record.familyId})`);
          return false;
        }
        return true;
      });
      wx.setStorageSync('sensitivity_records', newSensitivityRecords);
      
      // 自动创建家庭
      try {
        if (!this.data.hasOwnFamily) {
          const createRes = await familyService.createFamily(
            `${nickname}的家`,
            { nickname, gender, birthday }
          );
          wx.removeStorageSync('pendingFamilyCreation');
          
          // 创建成功后立即同步完整的 babyInfo（包含 safeFoodsList）到新家庭
          if (createRes && createRes.familyId) {
            try {
              await familyService.updateBabyInfo(createRes.familyId, fullBabyInfo);
              await sensitivityService.saveFamilyBabyInfo(fullBabyInfo, createRes.familyId);
              console.log('✅ 创建家庭后已同步完整宝宝信息到家庭:', createRes.familyId);
            } catch (syncError) {
              console.warn('创建家庭后同步宝宝信息失败:', syncError);
            }
          }
        }
      } catch (familyError) {
        console.error('🏠 自动创建家庭失败:', familyError);
      }
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      
      // 延迟返回上一页，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('保存失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /**
   * 计算宝宝年龄
   */
  calculateAge: function(birthdayStr) {
    const birthday = new Date(birthdayStr);
    const today = new Date();
    
    let years = today.getFullYear() - birthday.getFullYear();
    let months = today.getMonth() - birthday.getMonth();
    
    // 如果还没到生日月份，需要减一岁
    if (months < 0 || (months === 0 && today.getDate() < birthday.getDate())) {
      years--;
      months += 12;
    }
    
    // 计算日期差，用于更精确的年龄计算
    const daysDiff = today.getDate() - birthday.getDate();
    
    // 根据年龄返回不同格式的年龄表示
    if (years === 0) {
      if (months === 0) {
        return `${Math.ceil(daysDiff / 7)}周`;
      } else {
        return `${months}个月`;
      }
    } else if (years < 3) {
      return `${years}岁${months > 0 ? months + '个月' : ''}`;
    } else {
      return `${years}岁`;
    }
  }
});
// pages/profile/baby-info.js
const userService = require('../../services/userService');

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
    currentDate: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
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
    
    // 加载宝宝信息
    this.loadBabyInfo();
    
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
  },

  /**
   * 加载宝宝信息
   */
  loadBabyInfo: async function() {
    try {
      const userInfo = await userService.getUserInfo();
      if (userInfo) {
        // 检查是否有单独的babyInfo对象
        let babyInfo = userInfo.babyInfo || {};
        
        // 优先使用userInfo中的babyInfo数据，确保数据一致性
        let safeFoodsList = [];
        let safeFoods = '';
        
        if (babyInfo.safeFoodsList) {
          if (Array.isArray(babyInfo.safeFoodsList)) {
            // 如果safeFoodsList是数组，直接使用
            safeFoodsList = babyInfo.safeFoodsList.map(food => {
              // 确保每个元素都是对象，而不是字符串
              if (typeof food === 'string') {
                return {
                  foodId: food,
                  foodName: food,
                  category: '',
                  likeText: '',
                  allergyText: ''
                };
              } else {
                // 确保对象有必要的字段
                return {
                  foodId: food.foodId || food._id || food.name || food,
                  foodName: food.foodName || food.name || food,
                  category: food.category || '',
                  likeText: food.likeText || '',
                  allergyText: food.allergyText || ''
                };
              }
            });
          } else if (typeof babyInfo.safeFoodsList === 'string') {
            // 如果safeFoodsList是字符串，按逗号分割处理
            const foodsArray = babyInfo.safeFoodsList.split(',').map(food => food.trim()).filter(food => food);
            safeFoodsList = foodsArray.map(foodName => ({
              foodId: foodName,
              foodName: foodName,
              category: '',
              likeText: '',
              allergyText: ''
            }));
          }
        } else if (babyInfo.safeFoods) {
          // 处理字符串格式的safeFoods
          const foodsArray = babyInfo.safeFoods.split(',').map(food => food.trim()).filter(food => food);
          safeFoodsList = foodsArray.map(foodName => ({
            foodId: foodName,
            foodName: foodName,
            category: '',
            likeText: '',
            allergyText: ''
          }));
        }
        
        // 生成字符串格式的safeFoods
        safeFoods = safeFoodsList.map(food => food.foodName).join(',');
        
        this.setData({
          babyInfo: {
            nickname: userInfo.babyName || babyInfo.babyName || babyInfo.nickname || '',
            birthday: babyInfo.birthday || '',
            gender: babyInfo.gender || '',
            safeFoods: safeFoods,
            safeFoodsList: safeFoodsList,
            selectedFoods: safeFoods,
            selectedFoodsList: safeFoodsList
          }
        });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 出错时显示默认值
      this.setData({
        babyInfo: {
          nickname: '',
          birthday: '',
          gender: '',
          safeFoods: '',
          safeFoodsList: [],
          selectedFoods: '',
          selectedFoodsList: []
        }
      });
    }
  },

  /**
   * 输入变化处理
   */
  onInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`babyInfo.${field}`]: e.detail.value
    });
  },

  /**
   * 出生日期变化事件
   */
  onDateChange: function(e) {
    const date = e.detail.value;
    this.setData({
      'babyInfo.birthday': date
    });
  },

  /**
   * 性别选择
   */
  onGenderSelect: function(e) {
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
      url: `/pages/sensitivity/food-select?selectedFoods=${encodeURIComponent(JSON.stringify(selectedFoodsList))}&from=babyInfo`  // 传递已选食物列表和来源标识到二级页面
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
    // 获取当前已选择的食物列表
    const currentSelectedFoodsList = this.data.babyInfo.selectedFoodsList || [];
    
    // 创建一个Map来存储唯一的食物，避免重复
    const foodMap = new Map();
    
    // 首先添加当前已选择的食物
    currentSelectedFoodsList.forEach(food => {
      const foodId = food.foodId || food._id || food.name || food;
      foodMap.set(foodId, food);
    });
    
    // 然后添加新选择的食物
    selectedFoods.forEach(food => {
      const foodId = food.foodId || food._id || food.name || food;
      foodMap.set(foodId, food);
    });
    
    // 转换为数组
    const mergedFoodsList = Array.from(foodMap.values());
    
    // 更新选中的食物信息，合并现有食物和新选择的食物
    this.setData({
      'babyInfo.selectedFoods': mergedFoodsList.map(food => food.foodName).join(','),
      'babyInfo.selectedFoodsList': mergedFoodsList
    });
  },



  /**
   * 保存宝宝信息
   */
  saveBabyInfo: async function() {
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
      // 获取app实例，确保在整个try块内都可用
      const app = getApp();
      // 确保babyId始终有定义
      let babyId = 'local-baby-id';
      
      // 获取选中的食物列表，确保是数组
      const selectedFoodsList = this.data.babyInfo.selectedFoodsList || [];
      
      // 处理选中的食物列表，确保格式正确
      let safeFoodsList = [];
      let safeFoodsStr = '';
      
      if (Array.isArray(selectedFoodsList) && selectedFoodsList.length > 0) {
        // 确保safeFoodsList格式正确，只包含食物对象
        safeFoodsList = selectedFoodsList.map(food => {
          if (typeof food === 'string') {
            // 处理字符串格式的食物
            return {
              foodId: food,
              foodName: food,
              category: '' // 字符串格式的食物没有分类，默认为空
            };
          } else {
            // 处理对象格式的食物，确保必填字段存在，同时保留category字段
            return {
              foodId: food.foodId || food._id || food.name || food,
              foodName: food.foodName || food.name || food,
              category: food.category || '' // 保留category字段
            };
          }
        });
        
        // 生成字符串格式的safeFoods
        safeFoodsStr = safeFoodsList.map(food => food.foodName).join(',');
      }
      
      // 更新userInfo中的babyInfo
      userInfo.babyInfo = {
        ...userInfo.babyInfo,
        safeFoods: safeFoodsStr,
        safeFoodsList: safeFoodsList
      };
      
      // 1. 调用用户服务更新信息
      await userService.updateUserInfo(userInfo);
      
      // 2. 保存宝宝信息到数据库
      if (app.globalData.userInfo && app.globalData.userInfo.openId) {
        const db = app.globalData.db;
        if (db) {
          // 保存宝宝信息到数据库
          const babyInfoData = {
            userId: app.globalData.userInfo.openId,
            nickname: nickname,
            birthday: birthday,
            gender: gender,
            safeFoods: safeFoodsStr,
            safeFoodsList: safeFoodsList,
            babyAge: age,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // 检查是否已存在宝宝信息
          const res = await db.collection('baby_info').where({
            userId: app.globalData.userInfo.openId
          }).get();
          
          if (res.data && res.data.length > 0) {
            // 更新现有记录
            await db.collection('baby_info').doc(res.data[0]._id).update({
              data: babyInfoData
            });
            babyId = res.data[0]._id;
          } else {
            // 创建新记录
            const result = await db.collection('baby_info').add({
              data: babyInfoData
            });
            babyId = result._id;
          }
        }
      }
      
      // 3. 保存已排敏食物到本地存储和数据库
      const userId = app.globalData.userInfo?.openId;
      // 使用数据库中的真实babyId或默认值
      const savedBabyId = babyId;
      
      // 3. 保存已排敏食物到本地存储和数据库
      // 首先获取所有排敏记录
      const sensitivityRecords = wx.getStorageSync('sensitivity_records') || [];
      
      // 处理选中的食物列表，确保格式正确
      const selectedFoodIds = new Set();
      const selectedFoodNames = new Set();
      
      // 提取选中食物的ID和名称
      safeFoodsList.forEach(food => {
        selectedFoodIds.add(food.foodId);
        selectedFoodNames.add(food.foodName);
      });
      
      // 过滤出需要保留的记录（只有在选中列表中的食物记录才保留）
      const newSensitivityRecords = sensitivityRecords.filter(record => {
        // 检查记录是否属于当前用户和宝宝
        if (record.userId !== userId || (record.babyId !== savedBabyId && record.babyId !== 'local-baby-id')) {
          return true; // 不属于当前用户/宝宝的记录，保留
        }
        
        // 检查记录是否在选中列表中
        return selectedFoodIds.has(record.foodId) || selectedFoodNames.has(record.foodName);
      });
      
      // 添加新的排敏记录
      for (const food of safeFoodsList) {
        const foodId = food.foodId;
        const foodName = food.foodName;
        
        // 检查记录是否已经存在
        const recordExists = newSensitivityRecords.some(record => {
          return record.userId === userId && 
                 (record.babyId === savedBabyId || record.babyId === 'local-baby-id') && 
                 (record.foodId === foodId || record.foodName === foodName);
        });
        
        if (!recordExists) {
          // 创建新的排敏记录
          const record = {
            userId: userId,
            babyId: savedBabyId,
            foodId: foodId,
            foodName: foodName,
            date: new Date(),
            likeStatus: 0, // 默认中立
            allergyStatus: 0, // 默认不过敏
            status: 1, // 默认排敏中
            continuousDays: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // 添加到记录列表
          newSensitivityRecords.push(record);
          
          // 保存到数据库
          const db = app.globalData.db;
          if (db) {
            try {
              await db.collection('sensitivity_records').add({
                data: record
              });
            } catch (dbError) {
              console.warn('保存排敏记录到数据库失败，仅保存到本地存储:', dbError);
            }
          }
        }
      }
      
      // 保存到本地存储
      wx.setStorageSync('sensitivity_records', newSensitivityRecords);
      
      // 更新全局app实例中的userInfo，确保下次加载时能获取到最新数据
      if (app.globalData.userInfo) {
        app.globalData.userInfo = {
          ...app.globalData.userInfo,
          ...userInfo
        };
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
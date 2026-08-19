// pages/sensitivity/index.js
// 食物排敏记录页面
const app = getApp();
const sensitivityService = require('../../services/sensitivityService');
const familyService = require('../../services/familyService');
const { safeDateFormat } = require('../../utils/helpers');
const { formatDate } = require('../../utils/dateUtils');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    babyInfo: null,
    recommendedFoods: [],
    sensitivityProgress: 0,
    todaySensitivityRecord: null,
    likeStatusText: '',
    allergyStatusText: '',
    showBabyInfoModal: false,
    recommendationTitle: '今日推荐排敏食物',
    selectedDate: formatDate(new Date()),
    showDatePicker: false,
    selectedFood: null,
    // 宝宝信息表单
    babyInfoForm: {
      nickname: '',
      birthday: '',
      gender: 'boy'
    },
    showBabyInfoForm: false,
    currentDate: formatDate(new Date()),
    startDate: '2014-01-01',
    families: [],
    currentFamilyId: null,
    currentFamilyName: '我的家庭',
    showJoinFamilyModal: false,
    inviteCode: '',
    switchingTab: false,
    // 推荐食物记录弹窗
    showFoodRecordModal: false,
    recordFood: null,
    recordLikeStatus: 1, // 0=不喜欢 1=一般 2=喜欢，默认一般
    recordAllergyStatus: 0, // 0=不过敏 1=轻微过敏 2=重度过敏，默认不过敏
    recordSaving: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ hasLoaded: true });

    // 确保userInfo存在
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    } else {
      // 如果没有用户信息，设置为空对象，避免后续操作出错
      this.setData({
        userInfo: null
      });
    }
    this.loadFamilyInfo().then(() => {
      this.checkBabyInfo();
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    if (this.data.hasLoaded) {
      this.loadFamilyInfo().then(() => {
        this.checkBabyInfo();
        // 延迟获取今日排敏记录，避免从 food-select 返回时覆盖即时更新的数据
        setTimeout(() => {
          this.getTodaySensitivityRecord();
        }, 300);
      });
    } else {
      this.setData({ hasLoaded: true });
    }
  },

  /**
   * 加载家庭信息并设置当前家庭
   */
  loadFamilyInfo: async function() {
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const currentOpenId = currentUserInfo.openId || currentUserInfo._id || currentUserInfo.openid || currentUserInfo.openID || '';

    try {
      const result = await familyService.getMyFamilies();
      const familiesRaw = result.families || [];
      const createdFamilies = [];
      const joinedFamilies = [];
      const families = [];

      familiesRaw.forEach(family => {
        const rawBabyNickname = family.babyInfo?.nickname || family.babyNickname || '宝宝';
        const sanitizedBabyNickname = /^(微信用户|家庭成员)/.test(rawBabyNickname) ? '宝宝' : rawBabyNickname;
        const sanitizedFamilyName = family.familyName && !/^(微信用户|家庭成员)/.test(family.familyName) ? family.familyName : '';
        const familyData = {
          ...family,
          babyNickname: sanitizedBabyNickname,
          creatorOpenId: family.creatorOpenId || family.creator || family.ownerOpenId || '',
          name: sanitizedFamilyName || `${sanitizedBabyNickname}的家`,
          displayName: sanitizedFamilyName || `${sanitizedBabyNickname}的家`
        };

        families.push(familyData);
        if (familyData.creatorOpenId && familyData.creatorOpenId === currentOpenId) {
          createdFamilies.push(familyData);
        } else {
          joinedFamilies.push(familyData);
        }
      });

      // 自己创建的家庭排在前面
      families.sort((a, b) => {
        const aOwner = a.creatorOpenId === currentOpenId ? 1 : 0;
        const bOwner = b.creatorOpenId === currentOpenId ? 1 : 0;
        return bOwner - aOwner;
      });

      // 优先保留用户当前已选择的家庭（避免 onShow 时强制切回默认家庭）
      let currentFamilyId = this.data.currentFamilyId;
      let currentFamily = families.find(f => f._id === currentFamilyId);
      
      if (!currentFamily) {
        currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
        currentFamily = families.find(f => f._id === currentFamilyId);
      }
      
      if (!currentFamily) {
        // 首次进入或没有已选家庭时，默认优先展示用户创建的家庭
        if (createdFamilies.length > 0) {
          currentFamily = createdFamilies[0];
        } else if (joinedFamilies.length > 0) {
          currentFamily = joinedFamilies[0];
        }
      }

      if (currentFamily) {
        currentFamilyId = currentFamily._id;
        wx.setStorageSync('currentFamilyId', currentFamilyId);
        const currentFamilyName = currentFamily.displayName || currentFamily.name || `${currentFamily.babyNickname || '宝宝'}的家`;
        this.setData({
          families,
          currentFamilyId,
          currentFamilyName
        });
        // 迁移旧的无 familyId 记录到当前家庭
        this.migrateLocalRecords(currentFamilyId);
      } else {
        this.setData({
          families,
          currentFamilyId: null,
          currentFamilyName: '我的家庭'
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 迁移旧的无 familyId 本地记录到当前家庭
   */
  migrateLocalRecords: function(familyId) {
    if (!familyId) return;
    try {
      const allRecords = wx.getStorageSync('sensitivity_records') || [];
      let hasChanged = false;
      const migratedRecords = allRecords.map(record => {
        if (!record.familyId) {
          hasChanged = true;
          return { ...record, familyId };
        }
        return record;
      });
      if (hasChanged) {
        wx.setStorageSync('sensitivity_records', migratedRecords);
        console.log('✅ 已迁移旧排敏记录到家庭:', familyId);
      }
    } catch (error) {
      console.warn('迁移本地排敏记录失败:', error);
    }
  },

  /**
   * 切换家庭 tab
   */
  switchFamilyTab: async function(e) {
    const familyId = e.currentTarget.dataset.tabId;
    if (!familyId || familyId === this.data.currentFamilyId || this.data.switchingTab) {
      return;
    }

    const family = this.data.families.find(f => f._id === familyId);
    if (!family) return;

    this.setData({ switchingTab: true });

    try {
      wx.showLoading({ title: '切换中...' });
      await familyService.switchFamily(familyId);
      this.setData({
        currentFamilyId: familyId,
        currentFamilyName: family.displayName || family.name || `${family.babyNickname || '宝宝'}的家`
      });
      // 刷新排敏数据
      await this.checkBabyInfo();
      await this.getTodaySensitivityRecord();
    } catch (error) {
      console.error('切换家庭失败:', error);
      wx.showToast({ title: '切换家庭失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ switchingTab: false });
    }
  },

  /**
   * 检查宝宝信息是否存在
   */
  checkBabyInfo: async function () {
    try {
      // 如果用户未登录，使用默认空数据
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.openId) {
        console.log('用户未登录，使用默认数据');
        this.setData({
          babyInfo: { _id: 'local-baby-id', nickname: '', safeFoodsList: [] },
          recommendedFoods: [],
          sensitivityProgress: 0,
          showBabyInfoModal: false
        });
        return;
      }

      console.log('当前用户信息:', userInfo);

      // 如果用户已经加入了家庭或创建了家庭，不强制显示宝宝信息表单
      const families = this.data.families || [];
      if (families.length > 0) {
        let babyInfo = null;
        const currentFamily = families.find(item => item._id === this.data.currentFamilyId) || {};
        const familyBabyInfo = currentFamily.babyInfo || {};
        const userBabyInfo = userInfo.babyInfo || {};
        if (familyBabyInfo.nickname || familyBabyInfo.birthday) {
          babyInfo = familyBabyInfo;
        } else {
          babyInfo = userBabyInfo;
        }
        this.setData({
          babyInfo: babyInfo || { _id: 'local-baby-id', nickname: '', safeFoodsList: [] },
          showBabyInfoForm: false,
          showBabyInfoModal: false
        });
        this.getRecommendedFoods();
        this.getSensitivityProgress();
        this.getTodaySensitivityRecord();
        return;
      }

      let babyInfo = null;
      const userId = userInfo.openId || userInfo.openid;
      
      // 从本地存储直接获取宝宝信息
      const localBabyInfo = wx.getStorageSync('babyInfo');
      console.log('从本地存储获取的宝宝信息:', localBabyInfo);
      
      if (localBabyInfo) {
        babyInfo = localBabyInfo;
      } else if (userInfo.babyInfo) {
        // 从全局用户信息获取宝宝信息
        babyInfo = userInfo.babyInfo;
      } else {
        // 尝试从数据库获取宝宝信息
        try {
          babyInfo = await sensitivityService.getBabyInfo(userId);
          console.log('从数据库获取的宝宝信息:', babyInfo);
        } catch (dbError) {
          console.warn('从数据库获取宝宝信息失败:', dbError);
        }
      }
      
      // 检查宝宝信息是否完整（首次使用需要填写）
      const isBabyInfoComplete = babyInfo && babyInfo.nickname && babyInfo.birthday;
      
      if (!isBabyInfoComplete) {
        console.log('宝宝信息不完整，显示表单让用户填写');
        // 设置默认空数据
        babyInfo = babyInfo || {
          _id: 'local-baby-id',
          nickname: '',
          birthday: '',
          gender: '',
          safeFoods: '',
          safeFoodsList: []
        };
        
        // 显示宝宝信息填写表单
        this.setData({
          showBabyInfoForm: true,
          babyInfoForm: {
            nickname: babyInfo.nickname || '',
            birthday: babyInfo.birthday || '',
            gender: babyInfo.gender || 'boy'
          }
        });
      } else {
        // 信息完整，获取推荐和进度
        this.getRecommendedFoods();
        this.getSensitivityProgress();
      }
      
      console.log('最终使用的宝宝信息:', babyInfo);
      
      this.setData({
        babyInfo: babyInfo,
        showBabyInfoModal: false
      });
      
      // 获取今日排敏记录
      this.getTodaySensitivityRecord();
    } catch (error) {
      console.error('检查宝宝信息失败:', error);
      wx.showToast({
        title: '获取宝宝信息失败',
        icon: 'none'
      });
    }
  },

  /**
   * 获取推荐排敏食物
   */
  getRecommendedFoods: async function () {
    try {
      // 确保用户已登录
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.openId) {
        console.log('用户未登录，跳过获取推荐食物');
        return;
      }

      const userId = userInfo.openId || userInfo.openid;
      const babyId = this.data.babyInfo && this.data.babyInfo._id ? this.data.babyInfo._id : 'local-baby-id';
      const familyId = this.data.currentFamilyId;

      // 获取今日家庭排敏记录（用于判断推荐标题）
      const todayStr = safeDateFormat(new Date());
      const familyRecords = await sensitivityService.getUserSensitivityRecords(userId, babyId, familyId);
      const todayRecords = familyRecords.filter(record => {
        const recordDateStr = safeDateFormat(record.date);
        return recordDateStr === todayStr;
      });

      // 获取推荐排敏食物
      const recommendedFoods = await sensitivityService.getRecommendedFoods(userId, babyId, 3, familyId);
      
      // 根据今日是否已有排敏记录，设置推荐模块标题
      const recommendationTitle = todayRecords.length > 0 ? '明日推荐排敏食物' : '今日推荐排敏食物';
      
      this.setData({
        recommendedFoods: recommendedFoods || [],
        recommendationTitle: recommendationTitle
      });
      
      // 不默认选中食物，只有用户点击时才高亮并弹出记录弹窗
      this.setData({
        selectedFood: null
      });
    } catch (error) {
      console.error('获取推荐排敏食物失败:', error);
      wx.showToast({
        title: '获取推荐食物失败',
        icon: 'none'
      });
      // 出错时确保有默认值
      this.setData({
        recommendedFoods: [],
        selectedFood: null,
        recommendationTitle: '今日推荐排敏食物'
      });
    }
  },

  /**
   * 获取排敏进度
   */
  getSensitivityProgress: async function () {
    try {
      // 确保用户已登录
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.openId) {
        console.log('用户未登录，跳过获取排敏进度');
        return;
      }

      const userId = userInfo.openId || userInfo.openid;
      const babyId = this.data.babyInfo && this.data.babyInfo._id ? this.data.babyInfo._id : 'local-baby-id';
      const familyId = this.data.currentFamilyId;
      const progress = await sensitivityService.getSensitivityProgress(userId, babyId, familyId);
      this.setData({
        sensitivityProgress: progress ? progress.progress : 0
      });
    } catch (error) {
      console.error('获取排敏进度失败:', error);
      // 出错时确保有默认值
      this.setData({
        sensitivityProgress: 0
      });
    }
  },

  /**
   * 获取今日排敏记录
   */
  getTodaySensitivityRecord: async function () {
    try {
      // 如果刚刚从食物选择页返回，跳过异步查询避免覆盖最新数据
      if (this._lastFoodSelectedTime && Date.now() - this._lastFoodSelectedTime < 2000) {
        console.log('跳过 getTodaySensitivityRecord，刚刚从食物选择页返回');
        return;
      }
      
      // 确保用户已登录
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.openId) {
        console.log('用户未登录，跳过获取排敏记录');
        return;
      }

      // 获取今日日期（YYYY-MM-DD格式）
      const todayStr = safeDateFormat(new Date());
      const userId = userInfo.openId || userInfo.openid;
      const familyId = this.data.currentFamilyId;
      const babyId = this.data.babyInfo && this.data.babyInfo._id ? this.data.babyInfo._id : 'local-baby-id';

      // 调用服务层获取合并后的排敏记录（含云端），确保家庭成员共享可见
      const allRecords = await sensitivityService.getUserSensitivityRecords(userId, babyId, familyId);
      const todayRecords = allRecords.filter(record => {
        const recordDateStr = safeDateFormat(record.date);
        return recordDateStr === todayStr;
      });

      // 按 updatedAt 排序，取最新的
      todayRecords.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

      if (todayRecords.length > 0) {
        const todayRecord = todayRecords[0];
        
        // 转换状态为文本
        // likeStatus: -1=未选择, 0=不喜欢, 1=一般, 2=喜欢
        const likeStatusMap = {
          '-1': '未选择',
          '0': '不喜欢',
          '1': '一般',
          '2': '喜欢'
        };
        // allergyStatus: -1=未选择, 0=不过敏, 1=轻微过敏, 2=重度过敏
        const allergyStatusMap = {
          '-1': '未选择',
          '0': '不过敏',
          '1': '轻微过敏',
          '2': '重度过敏'
        };
        
        const likeStatusText = likeStatusMap[String(todayRecord.likeStatus)] || '';
        const allergyStatusText = allergyStatusMap[String(todayRecord.allergyStatus)] || '';
        
        this.setData({
          todaySensitivityRecord: todayRecord,
          likeStatusText: likeStatusText,
          allergyStatusText: allergyStatusText
        });
      } else {
        this.setData({
          todaySensitivityRecord: null,
          likeStatusText: '',
          allergyStatusText: ''
        });
      }
    } catch (error) {
      console.error('获取今日排敏记录失败:', error);
      this.setData({
        todaySensitivityRecord: null,
        likeStatusText: '',
        allergyStatusText: ''
      });
    }
  },

  /**
   * 跳转到排敏食物选择页面
   */
  navigateToFoodSelect: function () {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const selectedDate = this.data.selectedDate || todayStr;
    const todayRecord = this.data.todaySensitivityRecord;
    
    let url = `/subpackages/sensitivity/pages/food-select?selectedDate=${selectedDate}`;
    
    if (todayRecord) {
      url += `&modify=true&record=${encodeURIComponent(JSON.stringify(todayRecord))}`;
    }
    
    wx.navigateTo({ url });
  },

  /**
   * 修改今日排敏记录
   */
  modifyTodayRecord: function () {
    // 获取今日排敏记录
    const todayRecord = this.data.todaySensitivityRecord;
    
    if (todayRecord) {
      // 获取原记录的日期
      const recordDate = safeDateFormat(todayRecord.date);
      // 跳转到排敏食物选择页面，并传递今日排敏记录和记录日期
      wx.navigateTo({
        url: `/subpackages/sensitivity/pages/food-select?modify=true&record=${encodeURIComponent(JSON.stringify(todayRecord))}&selectedDate=${recordDate}`
      });
    } else {
      // 没有今日排敏记录，直接跳转到排敏食物选择页面
      this.navigateToFoodSelect();
    }
  },

  /**
   * 删除今日排敏记录
   */
  deleteTodayRecord: function () {
    const todayRecord = this.data.todaySensitivityRecord;
    if (!todayRecord) return;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除今日的排敏记录吗？',
      confirmColor: '#8B7355',
      success: (res) => {
        if (res.confirm) {
          this._doDeleteTodayRecord(todayRecord);
        }
      }
    });
  },

  /**
   * 执行删除今日排敏记录
   */
  _doDeleteTodayRecord: async function (todayRecord) {
    try {
      wx.showLoading({ title: '删除中...' });
      
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.openId) {
        wx.hideLoading();
        wx.showToast({ title: '未登录', icon: 'none' });
        return;
      }

      const todayStr = safeDateFormat(new Date());
      const userId = userInfo.openId || userInfo.openid;

      // 从本地存储删除
      const allRecords = wx.getStorageSync('sensitivity_records') || [];
      const currentFamilyId = this.data.currentFamilyId || null;
      const filteredRecords = allRecords.filter(record => {
        const recordDateStr = safeDateFormat(record.date);
        const recordFamilyId = record.familyId || null;
        
        if (currentFamilyId) {
          // 家庭模式下：删除今天当前家庭的所有记录（所有成员共享一份）
          if (recordDateStr === todayStr && recordFamilyId === currentFamilyId) {
            return false;
          }
          return true;
        }
        
        // 非家庭模式下按用户隔离删除
        const recordUserId = record.userId || record.openId || record.openid || record._openid;
        if (recordUserId === userId && recordDateStr === todayStr && recordFamilyId === currentFamilyId) {
          return false;
        }
        return true;
      });
      wx.setStorageSync('sensitivity_records', filteredRecords);

      // 尝试从云端删除（走云函数，避免家庭成员无权限删除他人创建的记录）
      try {
        await wx.cloud.callFunction({
          name: 'sensitivityManager',
          data: {
            action: 'deleteRecord',
            date: todayStr,
            familyId: currentFamilyId
          }
        });
      } catch (cloudError) {
        console.warn('从云端删除记录失败:', cloudError);
      }

      // 更新页面状态
      this.setData({
        todaySensitivityRecord: null,
        likeStatusText: '',
        allergyStatusText: ''
      });

      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });

      // 刷新推荐食物
      await this.getRecommendedFoods();
    } catch (error) {
      wx.hideLoading();
      console.error('删除今日排敏记录失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },



  /**
   * 打开宝宝信息填写页
   */
  openBabyInfoPage: function () {
    wx.navigateTo({
      url: '/subpackages/profile/pages/baby-info'
    });
  },

  /**
   * 宝宝昵称输入
   */
  onNicknameInput: function(e) {
    this.setData({
      'babyInfoForm.nickname': e.detail.value
    });
  },

  /**
   * 宝宝生日选择
   */
  onBirthdayChange: function(e) {
    this.setData({
      'babyInfoForm.birthday': e.detail.value
    });
  },

  /**
   * 宝宝性别选择
   */
  onGenderChange: function(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      'babyInfoForm.gender': gender
    });
  },

  /**
   * 保存宝宝信息
   */
  saveBabyInfo: async function() {
    const { babyInfoForm } = this.data;
    
    // 表单验证
    if (!babyInfoForm.nickname || !babyInfoForm.nickname.trim()) {
      wx.showToast({
        title: '请输入宝宝昵称',
        icon: 'none'
      });
      return;
    }
    
    if (!babyInfoForm.birthday) {
      wx.showToast({
        title: '请选择宝宝生日',
        icon: 'none'
      });
      return;
    }

    if (!babyInfoForm.gender && babyInfoForm.gender !== 0) {
      wx.showToast({
        title: '请选择宝宝性别',
        icon: 'none'
      });
      return;
    }
    
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || (!userInfo.openId && !userInfo.openid)) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      const userId = userInfo.openId || userInfo.openid;
      
      // 构建宝宝信息数据
      const babyData = {
        _id: 'local-baby-id',
        nickname: babyInfoForm.nickname.trim(),
        birthday: babyInfoForm.birthday,
        gender: babyInfoForm.gender,
        safeFoodsList: [],
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 先尝试保存到云端
      let cloudSaveSuccess = false;
      let savedBabyId = null;
      try {
        savedBabyId = await sensitivityService.saveBabyInfo(babyData);
        cloudSaveSuccess = true;
        console.log('宝宝信息保存到云端成功，babyId:', savedBabyId);
      } catch (cloudError) {
        console.error('保存宝宝信息到云端失败:', cloudError);
        // 云端保存失败，不保存到本地，下次继续引导填写
        wx.showToast({
          title: '保存失败，请检查网络后重试',
          icon: 'none'
        });
        return; // 不执行后续本地保存逻辑
      }

      // 使用云端返回的真实 babyId
      if (savedBabyId) {
        babyData._id = savedBabyId;
      }
      
      // 云端保存成功后，再保存到本地
      wx.setStorageSync('babyInfo', babyData);
      
      // 更新全局数据
      app.globalData.userInfo.babyInfo = babyData;
      
      // 同时更新本地存储的 userInfo，确保其他页面能读取到
      try {
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.babyInfo = babyData;
        // 同时添加 babyName 字段，保持数据一致性
        userInfo.babyName = babyData.nickname;
        wx.setStorageSync('userInfo', userInfo);
        console.log('✅ 已同步更新 userInfo 中的宝宝信息');
      } catch (e) {
        console.warn('同步更新 userInfo 失败:', e);
      }
      
      // 更新页面状态
      this.setData({
        babyInfo: babyData,
        showBabyInfoForm: false
      });

      // 自动创建家庭
      try {
        const familyResult = await familyService.getMyFamilies();
        const hasFamily = familyResult.hasFamily || (familyResult.families && familyResult.families.length > 0);
        if (!hasFamily) {
          await familyService.createFamily(
            `${babyData.nickname}的家`,
            {
              nickname: babyData.nickname,
              gender: babyData.gender,
              birthday: babyData.birthday
            }
          );
          console.log('🏠 排敏页保存宝宝信息后自动创建家庭成功');
          await this.loadFamilyInfo();
        }
      } catch (familyError) {
        console.error('🏠 排敏页自动创建家庭失败:', familyError);
      }
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      // 加载排敏数据
      this.getRecommendedFoods();
      this.getSensitivityProgress();
      this.getTodaySensitivityRecord();
      
    } catch (error) {
      console.error('保存宝宝信息失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    if (this.data.babyInfo) {
      this.getRecommendedFoods();
      this.getSensitivityProgress();
    }
    wx.stopPullDownRefresh();
  },

  /**
   * 接收从食物选择页面返回的已选择食物
   * @param {Array} selectedFoods - 已选择的食物列表
   */
  onFoodsSelected: async function (selectedFoods) {
    // 标记刚刚通过食物选择页更新了数据，短时间内 getTodaySensitivityRecord 不应覆盖
    this._lastFoodSelectedTime = Date.now();
    
    // 确保selectedFoods存在且有数据
    if (selectedFoods && selectedFoods.length > 0) {
      const food = selectedFoods[0];
      
      // 更新今日排敏记录
      const todayRecord = {
        foodId: food.foodId,
        foodName: food.foodName,
        category: food.category,
        likeStatus: food.likeIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
        allergyStatus: food.allergyIndex - 1, // 转换为后端需要的状态值（-1, 0, 1, 2）
        date: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        familyId: this.data.currentFamilyId
      };
      
      // 转换状态为文本
      const getStatusText = (status) => {
        switch (status) {
          case -1:
            return '未记录';
          case 0:
            return '不过敏';
          case 1:
            return '轻微过敏';
          case 2:
            return '重度过敏';
          default:
            return '未记录';
        }
      };
      
      const getLikeText = (status) => {
        switch (status) {
          case -1:
            return '未记录';
          case 0:
            return '不喜欢';
          case 1:
            return '一般';
          case 2:
            return '喜欢';
          default:
            return '未记录';
        }
      };
      
      const likeStatusText = getLikeText(todayRecord.likeStatus);
      const allergyStatusText = getStatusText(todayRecord.allergyStatus);
      
      this.setData({
        todaySensitivityRecord: todayRecord,
        likeStatusText: likeStatusText,
        allergyStatusText: allergyStatusText
      });
      
      // 同步更新本地存储，避免后续 getTodaySensitivityRecord 读取到旧数据
      try {
        const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
        const userId = userInfo.openId || userInfo.openid;
        const babyId = this.data.babyInfo && this.data.babyInfo._id ? this.data.babyInfo._id : 'local-baby-id';
        await sensitivityService.updateSensitivityRecord({
          userId,
          babyId,
          ...todayRecord
        });
      } catch (e) {
        console.warn('onFoodsSelected 同步到本地存储失败:', e);
      }
      
      // 更新推荐模块标题
      this.setData({
        recommendationTitle: '明日推荐排敏食物'
      });
    }
  },

  /**
   * 选择推荐食物，弹出记录弹窗
   */
  selectFood: function(e) {
    // 今日已有排敏记录时，不再弹出记录弹窗（同一天不建议排敏多种食物）
    if (this.data.todaySensitivityRecord) {
      wx.showToast({
        title: '今天已经记录过了，明天再来吧！未排敏完成的食物不建议同一天内食用多种，给宝宝一些适应时间吧！',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    const foodId = e.currentTarget.dataset.foodId;
    const food = this.data.recommendedFoods.find(f => f._id === foodId);
    if (!food) return;
    this.setData({
      selectedFood: food,
      recordFood: food,
      recordLikeStatus: 1,
      recordAllergyStatus: 0,
      showFoodRecordModal: true
    });
  },

  /**
   * 隐藏推荐食物记录弹窗
   */
  hideFoodRecordModal: function() {
    this.setData({ showFoodRecordModal: false, recordFood: null, recordSaving: false, selectedFood: null });
  },

  /**
   * 选择是否喜欢
   */
  onRecordLikeChange: function(e) {
    const value = Number(e.currentTarget.dataset.value);
    this.setData({ recordLikeStatus: value });
  },

  /**
   * 选择是否过敏
   */
  onRecordAllergyChange: function(e) {
    const value = Number(e.currentTarget.dataset.value);
    this.setData({ recordAllergyStatus: value });
  },

  /**
   * 保存推荐食物排敏记录
   */
  saveFoodRecord: async function() {
    if (this.data.recordSaving) return;
    const food = this.data.recordFood;
    if (!food) return;

    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const userId = userInfo.openId || userInfo.openid;
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ recordSaving: true });

    const likeStatus = this.data.recordLikeStatus;
    const allergyStatus = this.data.recordAllergyStatus;
    const record = {
      userId: userId,
      babyId: this.data.babyInfo && this.data.babyInfo._id ? this.data.babyInfo._id : 'local-baby-id',
      foodId: food._id,
      foodName: food.name,
      category: food.category,
      status: 1,
      likeStatus: likeStatus,
      allergyStatus: allergyStatus,
      allergyLevel: food.allergyLevel,
      date: safeDateFormat(new Date()),
      createTime: new Date(),
      updatedAt: new Date().toISOString(),
      familyId: this.data.currentFamilyId || null
    };

    try {
      await sensitivityService.saveSensitivityRecord(record);
    } catch (error) {
      console.error('保存排敏记录失败:', error);
      this.setData({ recordSaving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      return;
    }

    // 标记刚刚更新了数据，短时间内 getTodaySensitivityRecord 不应覆盖
    this._lastFoodSelectedTime = Date.now();

    const likeStatusText = ['不喜欢', '一般', '喜欢'][likeStatus] || '未记录';
    const allergyStatusText = ['不过敏', '轻微过敏', '重度过敏'][allergyStatus] || '未记录';

    this.setData({
      showFoodRecordModal: false,
      recordFood: null,
      recordSaving: false,
      selectedFood: null,
      todaySensitivityRecord: record,
      likeStatusText: likeStatusText,
      allergyStatusText: allergyStatusText,
      recommendationTitle: '明日推荐排敏食物'
    });

    wx.showToast({ title: '已保存', icon: 'success' });
  },

  /**
   * 显示加入家庭弹窗
   */
  showJoinFamilyModal: function() {
    this.setData({ showJoinFamilyModal: true });
  },

  /**
   * 隐藏加入家庭弹窗
   */
  hideJoinFamilyModal: function() {
    this.setData({ showJoinFamilyModal: false, inviteCode: '' });
  },

  /**
   * 邀请码输入
   */
  onInviteCodeChange: function(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  /**
   * 通过邀请码加入家庭
   */
  joinFamilyByInviteCode: async function() {
    const inviteCode = this.data.inviteCode && this.data.inviteCode.trim();
    if (!inviteCode || inviteCode.length !== 6 || !/^[A-Z0-9]{6}$/i.test(inviteCode)) {
      wx.showToast({ title: '请输入6位字母数字邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...', mask: true });
    try {
      const res = await familyService.joinFamily(inviteCode.toUpperCase());
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '加入家庭成功', icon: 'success' });
        this.setData({ showJoinFamilyModal: false, inviteCode: '' });
        await this.loadFamilyInfo();
        this.checkBabyInfo();
      } else {
        wx.showToast({ title: res.message || '加入失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '加入失败', icon: 'none' });
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '宝宝辅食排敏记录',
      path: '/pages/sensitivity/index'
    };
  }
})
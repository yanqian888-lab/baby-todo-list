// pages/index/index.js
// 引入工具函数
const dateUtils = require('../../utils/dateUtils');
const taskUtils = require('../../utils/taskUtils');
const { BatchUpdater } = require('../../utils/pagination');
const familyService = require('../../services/familyService');
const sensitivityService = require('../../services/sensitivityService');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    todayTasks: [], // 今日任务（可打卡）
    upcomingTasks: [], // 待完成任务（暂不可打卡）
    hasTasks: false, // 用户是否有任务（包含历史/未完成）
    hasEverCreatedTask: false, // 用户是否曾经创建过任务（用于空状态判断）
    todayStats: {
      total: 0,        // 今日总任务数（包含已完成和未完成）
      completed: 0,    // 今日已完成任务数
      remaining: 0,    // 今日未完成任务数
      percentage: 0
    },
    currentDate: '', // 当前日期
    userInfo: null, // 用户信息
    greeting: '', // 问候语
    currentFamilyId: null,
    currentFamilyName: '我的家庭',
    families: [],
    isFamilyCreator: false,
    userStats: {
      streakDays: 0,
      totalDays: 0,
      lastCheckin: '',
      today: { checked: false, time: '' }
    },
    loading: true, // 加载状态，初始为true避免显示空状态
    checkingIn: false, // 打卡中状态，防止重复点击
    page: 1, // 当前页码
    pageSize: 20, // 每页数量
    hasMore: true, // 是否还有更多数据
    showBabyInfoForm: false,
    babyInfoForm: {
      nickname: '',
      birthday: '',
      gender: 'boy'
    },
    startDate: '2014-01-01',
    pickerEndDate: dateUtils.formatDate(new Date()),
    showJoinFamilyModal: false,
    inviteCode: ''
  },

  /**
   * 批量更新器
   */
  batchUpdater: null,

  /**
   * 初始化进行中标志（避免 onLoad 与 onShow 重复初始化）
   */
  _loading: false,
  
  /**
   * 获取全局用户信息
   */
  getUserInfo: function() {
    const app = getApp();
    let userInfo = app.globalData.userInfo;
    
    // 检查全局数据中的用户信息是否完整
    if (userInfo && userInfo.nickName && userInfo.avatarUrl) {
      this.setData({
        userInfo: userInfo,
        greeting: this.getGreeting()
      });
      console.log('从全局数据获取用户信息:', userInfo);
    } else {
      // 从本地存储获取用户信息
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo && storedUserInfo.nickName && storedUserInfo.avatarUrl) {
        // 更新全局数据，确保数据一致性
        app.globalData.userInfo = storedUserInfo;
        this.setData({
          userInfo: storedUserInfo,
          greeting: this.getGreeting()
        });
        console.log('从本地存储恢复用户信息:', storedUserInfo);
      } else {
        // 使用默认信息
        const defaultUserInfo = {
          nickName: '妈妈',
          avatarUrl: '/images/logo.png',
          gender: 0
        };
        this.setData({
          userInfo: defaultUserInfo,
          greeting: this.getGreeting()
        });
        console.log('使用默认用户信息:', defaultUserInfo);
      }
    }
  },

  /**
   * 加载家庭信息并设置当前家庭
   */
  loadFamilyInfo: async function() {
    const app = getApp();
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

      let currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
      let currentFamily = families.find(f => f._id === currentFamilyId);
      if (!currentFamily) {
        if (createdFamilies.length > 0) {
          currentFamily = createdFamilies[0];
        } else if (joinedFamilies.length > 0) {
          currentFamily = joinedFamilies[0];
        }
      }

      if (currentFamily) {
        currentFamilyId = currentFamily._id;
        wx.setStorageSync('currentFamilyId', currentFamilyId);
        const currentFamilyName = currentFamily.familyName || `${currentFamily.babyNickname || '宝宝'}的家`;
        const isFamilyCreator = (currentFamily.creatorOpenId || currentFamily.creator || currentFamily.ownerOpenId) === currentOpenId;
        this.setData({
          families,
          currentFamilyId,
          currentFamilyName,
          isFamilyCreator
        });
      } else {
        wx.removeStorageSync('currentFamilyId');
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentFamilyId = null;
        }
        this.setData({
          families,
          currentFamilyId: null,
          currentFamilyName: '我的家庭',
          todayTasks: [],
          upcomingTasks: [],
          isFamilyCreator: false
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 打开家庭选择菜单
   */
  openFamilyPicker: function() {
    const families = this.data.families || [];
    if (families.length <= 1) {
      return;
    }

    const itemList = families.map(family => family.name);
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedFamily = families[res.tapIndex];
        if (selectedFamily) {
          this.selectFamily(selectedFamily);
        }
      },
      fail: (err) => {
        console.log('家庭选择取消或失败:', err);
      }
    });
  },

  selectFamily: async function(family) {
    if (!family || !family._id) {
      return;
    }

    if (family._id === this.data.currentFamilyId) {
      return;
    }

    try {
      wx.showLoading({ title: '切换中...' });
      await familyService.switchFamily(family._id);
      const currentOpenId = this.data.userInfo?.openId || this.data.userInfo?._id || this.data.userInfo?.openid || this.data.userInfo?.openID || '';
      const isFamilyCreator = (family.creatorOpenId || family.creator || family.ownerOpenId) === currentOpenId;
      this.setData({
        currentFamilyId: family._id,
        currentFamilyName: family.name || `${family.babyNickname || '宝宝'}的家`,
        isFamilyCreator
      });
      // 刷新所有家庭相关数据（两个接口只依赖已设置的 currentFamilyId，互不依赖，并行请求）
      await Promise.all([
        this.getTodoTasks(true),
        this.getUserStatistics()
      ]);
    } catch (error) {
      console.error('切换家庭失败:', error);
      wx.showToast({ title: '切换家庭失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 获取问候语
   */
  getGreeting: function() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return '早上好';
    } else if (hour >= 12 && hour < 14) {
      return '中午好';
    } else if (hour >= 14 && hour < 18) {
      return '下午好';
    } else {
      return '晚上好';
    }
  },

  /**
   * 转换星期数字为中文文本（使用工具函数）
   * @param {Array|string|number|object} days - 星期数字数据
   * @returns {string} 格式化后的星期文本
   */
  getWeekdayText: function(days) {
    return taskUtils.getWeekdayText(days);
  },

  /**
   * 处理选择的日期数组（使用工具函数）
   * @param {Array|string|number|object} days - 日期数据
   * @param {string} type - 'week' 或 'month'
   * @returns {Array} 处理后的数字数组
   */
  _processSelectedDays: function(days, type = 'week') {
    return taskUtils.processSelectedDays(days, type);
  },
  
  /**
   * 转换月份日期数字为中文文本（使用工具函数）
   * @param {Array|string|number} days - 月份日期数据
   * @returns {string} 格式化后的日期文本
   */
  getMonthdayText: function(days) {
    return taskUtils.getMonthdayText(days);
  },

  /**
   * 计算下一次打卡日期文本
   * @param {string} frequency - 任务频率：daily, weekly, monthly
   * @param {Array} selectedDays - 选中的星期几（weekly）
   * @param {Array} selectedMonthDays - 选中的月份日期（monthly）
   * @returns {string} 下一次打卡日期文本
   */
  /**
   * 判断循环任务今天是否可执行
   * @param {string} frequency 频率类型
   * @param {Array} selectedDays 周任务选中的星期（0=周日）
   * @param {Array} selectedMonthDays 月任务选中的日期
   * @returns {boolean} 今天是否可执行
   */
  _isTaskExecutableToday: function(frequency, selectedDays, selectedMonthDays) {
    if (frequency === 'daily' || !frequency || frequency === 'none') {
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (frequency === 'weekly') {
      if (!selectedDays || selectedDays.length === 0) {
        console.warn('⚠️ 周任务 selectedDays 为空，默认今天不可执行');
        return false;
      }
      const todayDayOfWeek = today.getDay();
      const executable = selectedDays.some(day => Number(day) === todayDayOfWeek);
      console.log(`📅 周任务可执行检查: 今天星期${todayDayOfWeek}, selectedDays=[${selectedDays.join(',')}], 结果=${executable}`);
      return executable;
    }
    if (frequency === 'monthly') {
      if (!selectedMonthDays || selectedMonthDays.length === 0) {
        console.warn('⚠️ 月任务 selectedMonthDays 为空，默认今天不可执行');
        return false;
      }
      const todayDateOfMonth = today.getDate();
      const executable = selectedMonthDays.some(day => Number(day) === todayDateOfMonth);
      console.log(`📅 月任务可执行检查: 今天日期${todayDateOfMonth}, selectedMonthDays=[${selectedMonthDays.join(',')}], 结果=${executable}`);
      return executable;
    }
    return true;
  },

  _getNextCheckInDateText: function(frequency, selectedDays, selectedMonthDays) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDayOfWeek = today.getDay(); // 0-6, 0=周日
    const todayDateOfMonth = today.getDate(); // 1-31
    
    // 获取明天的日期
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay();
    const tomorrowDateOfMonth = tomorrow.getDate();
    
    // 获取今天的日期字符串 MM-DD
    const formatDate = (date) => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}-${day}`;
    };
    
    // 获取星期几文本
    const getWeekdayName = (dayIndex) => {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return weekdays[dayIndex];
    };
    
    if (frequency === 'daily') {
      // 每日任务：下次是明天
      return '明天';
    }
    
    if (frequency === 'weekly' && selectedDays && selectedDays.length > 0) {
      // 周任务：找下一个选中的星期几
      // selectedDays 已经是 JS 标准（0=周日, 1=周一...）
      const sortedDays = [...selectedDays].sort((a, b) => a - b);
      
      // 找今天之后的下一个选中日期
      let nextDay = sortedDays.find(day => day > todayDayOfWeek);
      
      if (nextDay !== undefined) {
        // 本周内还有选中的日期
        // 如果是明天，显示"明天"
        if (nextDay === tomorrowDayOfWeek) {
          return '明天';
        }
        return getWeekdayName(nextDay);
      } else {
        // 本周没有了，取下周第一个选中的日期
        // 如果下周第一个是明天（跨周情况），显示"明天"
        if (sortedDays[0] === tomorrowDayOfWeek) {
          return '明天';
        }
        return getWeekdayName(sortedDays[0]);
      }
    }
    
    if (frequency === 'monthly' && selectedMonthDays && selectedMonthDays.length > 0) {
      // 月任务：找下一个选中的日期
      const sortedDays = [...selectedMonthDays].sort((a, b) => a - b);
      
      // 找今天之后的下一个选中日期
      let nextDay = sortedDays.find(day => day > todayDateOfMonth);
      
      if (nextDay !== undefined) {
        // 本月内还有选中的日期
        // 如果是明天，显示"明天"
        if (nextDay === tomorrowDateOfMonth) {
          return '明天';
        }
        return `${nextDay}日`;
      } else {
        // 本月没有了，取下月第一个选中的日期
        // 如果下月第一个是明天（跨月情况），显示"明天"
        if (sortedDays[0] === tomorrowDateOfMonth) {
          return '明天';
        }
        return `${sortedDays[0]}日`;
      }
    }
    
    return '今日已完成';
  },

  async onLoad(options) {
    console.log('页面加载，初始化数据...');
    // 优先检查登录状态
    if (!require('../../services/userService').checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    // 初始化进行中标志，onShow 在此期间跳过，避免重复初始化
    this._loading = true;
    try {
      // 更新当前日期
      this.updateCurrentDate();
      // 获取用户信息
      this.getUserInfo();
      // 加载家庭信息并设置当前家庭
      await this.loadFamilyInfo();
      // 调用初始化数据函数
      await this.initData();
    } finally {
      this._loading = false;
      this.setData({ hasLoaded: true });
    }
  },
  
  /**
   * 生命周期函数--监听页面显示
   */
  async onShow() {
    // 优先检查登录状态，未登录直接跳转
    if (!require('../../services/userService').checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    // onLoad 初始化尚未完成，跳过本次刷新
    if (this._loading) {
      return;
    }
    // 避免 onLoad 和 onShow 首次重复初始化
    if (!this.data.hasLoaded) {
      this.setData({ hasLoaded: true });
    } else {
      // 更新当前日期
      this.updateCurrentDate();
      // 获取用户信息
      this.getUserInfo();
      // 加载家庭信息并设置当前家庭
      await this.loadFamilyInfo();
      // 每次显示页面时刷新数据并处理可能的错误
      await this.initData().catch(error => {
        console.error('页面显示时初始化数据失败:', error);
      });
      // 检查宝宝信息是否完善
      this.checkBabyInfoComplete();
    }
  },
  
  /**
   * 检查宝宝信息是否完善
   * 如果用户已加入或创建了家庭，则不强制显示完善宝宝信息表单
   * 只有在未加入任何家庭且宝宝信息不完善时才显示
   */
  checkBabyInfoComplete: function() {
    const families = this.data.families || [];
    
    // 如果用户已经加入了家庭或创建了家庭，不强制显示宝宝信息表单
    if (families.length > 0) {
      this.setData({
        showBabyInfoForm: false
      });
      return;
    }

    // 用户未加入/创建家庭时，检查本地宝宝信息
    const userBabyInfo = this.data.userInfo?.babyInfo || {};
    const babyInfo = userBabyInfo;
    const isBabyInfoComplete = babyInfo && babyInfo.nickname && babyInfo.birthday;

    if (!isBabyInfoComplete) {
      const initialNickname = babyInfo.nickname || '';
      const initialGender = babyInfo.gender || 'boy';

      this.setData({
        showBabyInfoForm: true,
        babyInfoForm: {
          nickname: initialNickname,
          birthday: babyInfo.birthday || '',
          gender: initialGender
        }
      });
    } else {
      this.setData({
        showBabyInfoForm: false
      });
    }
  },

  /**
   * 显示加入家庭弹窗
   */
  showJoinFamilyModal: function() {
    this.setData({
      showJoinFamilyModal: true,
      inviteCode: ''
    });
  },

  /**
   * 隐藏加入家庭弹窗
   */
  hideJoinFamilyModal: function() {
    this.setData({
      showJoinFamilyModal: false,
      inviteCode: ''
    });
  },

  /**
   * 输入邀请码
   */
  onInviteCodeInput: function(e) {
    this.setData({
      inviteCode: e.detail.value.trim().toUpperCase()
    });
  },

  /**
   * 提交邀请码加入家庭
   */
  submitJoinFamily: async function() {
    const inviteCode = this.data.inviteCode;
    if (!inviteCode || inviteCode.length !== 6 || !/^[A-Z0-9]{6}$/i.test(inviteCode)) {
      wx.showToast({ title: '请输入6位字母数字邀请码', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '加入中...' });
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: {
          action: 'joinFamily',
          inviteCode: inviteCode
        }
      });

      if (result.result && result.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' });
        this.hideJoinFamilyModal();
        // 立即写入缓存
        const familyId = result.result.familyId;
        if (familyId) {
          wx.setStorageSync('currentFamilyId', familyId);
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.currentFamilyId = familyId;
          }
        }
        // 刷新家庭信息和页面数据
        familyService.clearCache(); // 本方法绕过 familyService 直接调 familyManager，需手动清缓存
        await this.loadFamilyInfo();
        this.setData({ showBabyInfoForm: false });
        await this.initData();
      } else {
        wx.showToast({
          title: result.result?.error || '加入失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加入家庭失败:', error);
      wx.showToast({ title: '加入失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onNicknameInput: function(e) {
    this.setData({
      'babyInfoForm.nickname': e.detail.value
    });
  },

  onBirthdayChange: function(e) {
    this.setData({
      'babyInfoForm.birthday': e.detail.value
    });
  },

  onGenderChange: function(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      'babyInfoForm.gender': gender
    });
  },

  saveBabyInfo: async function() {
    const { babyInfoForm } = this.data;
    if (!babyInfoForm.nickname || !babyInfoForm.nickname.trim()) {
      wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
      return;
    }

    if (!babyInfoForm.birthday) {
      wx.showToast({ title: '请选择宝宝生日', icon: 'none' });
      return;
    }

    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const userId = userInfo.openId || userInfo.openid || userInfo.openID || '';
      if (!userId) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      const babyData = {
        userId: userId,
        nickname: babyInfoForm.nickname.trim(),
        birthday: babyInfoForm.birthday,
        gender: babyInfoForm.gender,
        safeFoodsList: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 优先保存到云端 babyManager 获取真实 babyId
      let realBabyId = null;
      try {
        const saveRes = await wx.cloud.callFunction({
          name: 'babyManager',
          data: {
            action: 'saveBabyInfo',
            babyInfo: babyData
          }
        });
        if (saveRes.result && saveRes.result.success && saveRes.result.babyId) {
          realBabyId = saveRes.result.babyId;
          babyData._id = realBabyId;
        }
      } catch (bmErr) {
        console.warn('调用 babyManager 失败，回退到本地保存:', bmErr);
      }

      // 如果 babyManager 失败，回退到 sensitivityService
      if (!realBabyId) {
        try {
          await sensitivityService.saveBabyInfo(babyData);
        } catch (svcErr) {
          console.warn('sensitivityService 保存也失败，仅保留本地:', svcErr);
        }
      }

      wx.setStorageSync('babyInfo', babyData);

      app.globalData.userInfo = app.globalData.userInfo || {};
      app.globalData.userInfo.babyInfo = babyData;
      app.globalData.userInfo.babyName = babyData.nickname;

      const storedUserInfo = wx.getStorageSync('userInfo') || {};
      storedUserInfo.babyInfo = babyData;
      storedUserInfo.babyName = babyData.nickname;
      wx.setStorageSync('userInfo', storedUserInfo);

      const families = this.data.families || [];
      const familyIndex = families.findIndex(item => item._id === this.data.currentFamilyId);
      if (familyIndex !== -1) {
        families[familyIndex].babyInfo = babyData;
      }

      this.setData({
        showBabyInfoForm: false,
        families: families
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
          console.log('🏠 首页保存宝宝信息后自动创建家庭成功');
          // 刷新家庭信息
          await this.loadFamilyInfo();
        }
      } catch (familyError) {
        console.error('🏠 首页自动创建家庭失败:', familyError);
      }

      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存宝宝信息失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /**
   * 更新当前日期显示
   */
  updateCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    
    this.setData({
      currentDate: `${year}年${month}月${day}日 ${weekday}`,
      pickerEndDate: `${year}-${month}-${day}`
    });
  },

  /**
   * 初始化数据
   * @param {boolean} skipLoading - 是否跳过加载提示，当由已显示loading的方法调用时使用
   */
  /**
   * 获取用户统计信息（连续打卡天数等）
   */
  async getUserStatistics() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserStatistics',
        data: {
          familyId: this.data.currentFamilyId
        }
      });
      
      if (result.result && result.result.success && result.result.data) {
        console.log('✅ 获取用户统计信息成功:', result.result.data);
        this.setData({
          userStats: result.result.data
        });
      } else if (result.result && !result.result.success) {
        console.warn('⚠️ 获取用户统计信息返回失败:', result.result.error);
      }
    } catch (error) {
      console.error('❌ 获取用户统计信息失败:', error);
      // 云函数失败时不阻断页面显示
    }
  },

  /**
   * 初始化数据
   */
  async initData(skipLoading = false) {
    try {
      // 获取用户信息和问候语
      this.getUserInfo();
      if (!skipLoading) {
        wx.showLoading({ title: '加载中' });
      }
      
      // 并行获取各类数据，使用Promise.allSettled确保即使某个方法失败，其他方法也能继续执行
      await Promise.allSettled([
        this.getTodoTasks(true), // 传递true跳过重复加载动画
        this.getUserStatistics()
      ]);
      
      // 计算统计数据
      this.calculateStats();
      
      // 确保页面有数据显示
      if (this.data.todayTasks.length === 0 && this.data.upcomingTasks.length === 0) {
        console.log('页面暂无任务数据');
      }
    } catch (error) {
      console.error('初始化数据失败:', error);
      // 确保页面不会空白
      this.setData({
        todayTasks: [],
        upcomingTasks: [],
        todayStats: {
          total: 0,
          completed: 0,
          remaining: 0,
          percentage: 0
        }
      });
    } finally {
      if (!skipLoading) {
        wx.hideLoading();
      }
      // 无论成功失败，都设置loading为false
      this.setData({ loading: false });
    }
  },

  /**
   * 获取待打卡任务列表
   * @param {boolean} skipLoading - 是否跳过加载提示，当由已显示loading的方法调用时使用
   */
  /**
   * 获取当前家庭ID
   */
  getCurrentFamilyId: function() {
    if (this.data.currentFamilyId === null || this.data.currentFamilyId === undefined) return null;
    if (this.data.currentFamilyId) return this.data.currentFamilyId;
    
    const familyId = wx.getStorageSync('currentFamilyId');
    if (familyId) return familyId;
    
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.currentFamilyId) return userInfo.currentFamilyId;
    
    return null;
  },

  async getTodoTasks(skipLoading = false) {
    try {
      if (!skipLoading) {
        wx.showLoading({ title: '加载中' });
      }
      
      // 获取当前家庭ID
      const familyId = this.getCurrentFamilyId();
      
      // 调用云函数获取任务列表
      let result;
      try {
        result = await wx.cloud.callFunction({
          name: 'getTasks',
          data: {
            status: 'pending',
            includeCompleted: true,  // 包含已完成任务，让前端统一过滤
            familyId, // 传递家庭ID过滤
            size: 100  // 获取更多任务，避免大家庭漏显
          }
        });
      } catch (cloudError) {
        console.error('❌ getTasks 云函数调用失败:', cloudError);
        // 云函数失败时显示提示
        wx.showToast({
          title: '任务加载失败',
          icon: 'none'
        });
        this.setData({ todayTasks: [], loading: false });
        return;
      }
      
      const resultData = result.result || {};
      
      console.log('📝 getTasks 云函数返回数据:', JSON.stringify(resultData));
      console.log('📝 返回的任务数量:', resultData.tasks?.length || 0);
      
      if (resultData.success) {
        // 如果家庭已切换，忽略过期请求
        if (this.data.currentFamilyId !== familyId) {
          console.warn('家庭已切换，忽略过期任务数据');
          return;
        }

        // 云函数已经过滤出今天需要执行的任务，直接使用
        const filteredTasks = resultData.tasks || [];
        console.log('待打卡任务列表:', JSON.stringify(filteredTasks));
        
        // 如果返回了任务，打印详细信息
        if (filteredTasks.length > 0) {
          console.log('⚠️ 警告: 云端返回了任务，但应该为空！');
          filteredTasks.forEach((task, i) => {
            console.log(`  任务${i+1}: ${task.title}, _openid: ${task._openid}, isTemplate: ${task.isTemplate}`);
          });
        }
        
        // 调试循环任务字段
        filteredTasks.forEach((task, index) => {
          console.log(`任务${index+1}:`);
          console.log(`  frequency: ${task.frequency}`);
          console.log(`  selectedDays:`, task.selectedDays);
          console.log(`  selectedMonthDays:`, task.selectedMonthDays);
          console.log(`  cycleTimes:`, task.cycleTimes);
        });
        
        // 检查是否有任务数据，但被过滤掉了
        if (filteredTasks.length === 0 && resultData.total > 0) {
          console.log('⚠️ 警告: 有任务但未被过滤出来');
          // 尝试获取所有任务进行调试
          this.queryRawTasksForDebug();
        }
        
        // 批量获取今日打卡记录（避免 N+1 云函数调用）
        let todayCounts = {};
        if (filteredTasks.length > 0) {
          try {
            const taskIds = filteredTasks.map(t => t._id);
            const batchResult = await wx.cloud.callFunction({
              name: 'getTaskClockIns',
              data: {
                taskIds: taskIds,
                todayOnly: true,
                familyId: familyId || null
              }
            });
            if (batchResult.result && batchResult.result.success && batchResult.result.data && batchResult.result.data.todayCounts) {
              todayCounts = batchResult.result.data.todayCounts;
            }
          } catch (error) {
            console.error('批量获取打卡记录失败:', error);
          }
        }

        // 处理任务数据，转换为前端需要的格式
        const todoTasksPromises = filteredTasks.map((task) => {
          console.log(`🔄 处理任务[${task.title}]:`);
          console.log(`  原始selectedDays:`, task.selectedDays, '类型:', typeof task.selectedDays);
          
          // 改进selectedDays处理，支持各种格式
          const processedDays = this._processSelectedDays(task.selectedDays);
          console.log(`  处理后selectedDays:`, processedDays);
          
          // 预先计算星期文本，因为WXML不能直接调用Page方法
          const weekdayText = task.frequency === 'weekly' ? this.getWeekdayText(processedDays) : '';
          console.log(`  预先计算星期文本:`, weekdayText);
          
          // 计算月循环文本，优先使用云函数处理后的processedMonthDays字段
          const monthDaysToUse = task.processedMonthDays || task.selectedMonthDays;
          // 处理月任务日期时传入type='month'参数，以支持1-31范围的日期
          const processedMonthDays = task.frequency === 'monthly' ? this._processSelectedDays(monthDaysToUse, 'month') : [];
          const monthdayText = task.frequency === 'monthly' ? this.getMonthdayText(processedMonthDays) : '';
          console.log(`  处理后selectedMonthDays:`, processedMonthDays);
          console.log(`  预先计算月日期文本:`, monthdayText);
          
          // 计算单次任务的日期显示文本
          let dueDateText = '';
          if (task.frequency === 'none' || !task.frequency) {
            dueDateText = this._getDueDateText(task.dueDate || task.createTime);
          }
          
          // 从批量查询结果中获取今日打卡记录数
          const todayCheckins = todayCounts[task._id] || 0;
          console.log(`  今天打卡记录数: ${todayCheckins}`);
          
          // 每日任务默认只能完成1次
          const cycleTimes = 1;
          
          // 判断任务是否已经完成
          const isCompletedAllTimes = todayCheckins >= cycleTimes;
          
          // 计算任务是否可点击（当天可完成）
          let isClickable = true;
          let disabledText = '';
          
          // 单次任务：检查是否今天或过期
          if (task.frequency === 'none' || !task.frequency) {
            const taskDate = new Date(task.dueDate || task.createTime);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            taskDate.setHours(0, 0, 0, 0);

            const isToday = taskDate.getTime() === today.getTime();
            const isExpired = taskDate.getTime() < today.getTime();

            isClickable = isToday;
            if (isExpired) {
              disabledText = '已过期';
            } else if (!isClickable) {
              disabledText = dueDateText; // 显示日期
            }

            // 将过期状态写入任务对象，后续过滤使用
            task.isExpired = isExpired;
          } else {
            // 循环任务：检查今天是否是执行日，以及今日是否已完成
            const isTodayExecutable = this._isTaskExecutableToday(task.frequency, processedDays, processedMonthDays);
            isClickable = isTodayExecutable && !isCompletedAllTimes;
            if (!isClickable) {
              if (!isTodayExecutable) {
                // 今天不是执行日，显示下一次执行日期
                disabledText = this._getNextCheckInDateText(task.frequency, processedDays, processedMonthDays);
              } else {
                // 今天已完成，计算下一次打卡日期
                disabledText = this._getNextCheckInDateText(task.frequency, processedDays, processedMonthDays);
              }
            }
            task.isExpired = false;
          }
          
          // 获取用于排序的时间（单次任务用dueDate，循环任务用nextCheckInDate）
          let sortTime = 0;
          if (task.frequency === 'none' || !task.frequency) {
            sortTime = new Date(task.dueDate || task.createTime).getTime();
          } else {
            // 循环任务：根据下次执行日期排序
            sortTime = new Date().getTime(); // 今天
          }
          
          const currentOpenId = this.data.userInfo?.openId || this.data.userInfo?.openid || '';
          // 只有未完成所有次数的任务才保留在待打卡列表中
          return {
            id: task._id,
            name: task.title,
            subtitle: task.description || '',
            time: task.reminderTime ? this._formatTime(task.reminderTime) : '',
            type: task.frequency || 'none',
            // 单次任务：以 status 为准；循环任务：以今日打卡次数为准
            completed: (task.frequency === 'none' || !task.frequency) ? (task.status === 'completed') : isCompletedAllTimes,
            status: task.status || 'pending',
            category: task.category,
            priority: task.priority,
            // 添加循环任务相关字段
            frequency: task.frequency || 'none',
            cycleTimes: 1,
            todayCheckins: todayCheckins,
            isExpired: !!task.isExpired,
            // 使用处理后的selectedDays
            selectedDays: processedDays,
            // 优先使用云函数处理后的processedMonthDays字段
            selectedMonthDays: processedMonthDays,
            // 预先计算好的星期文本和月文本，供WXML直接使用
            weekdayText: weekdayText,
            monthdayText: monthdayText,
            // 单次任务的日期显示文本
            dueDateText: dueDateText,
            // 是否可点击
            isClickable: isClickable,
            disabledText: disabledText,
            // 排序时间
            sortTime: sortTime,
            // 任务创建人信息
            creatorNickName: task.creatorNickName || '',
            familyId: task.familyId || null,
            // 任务创建人或家庭创建人可以编辑/删除
            canEdit: task._openid === currentOpenId || (this.data.isFamilyCreator && task.familyId && task.familyId === this.data.currentFamilyId)
          };
        });
        
        // 等待所有任务处理完成
        const todoTasks = await Promise.all(todoTasksPromises);
        
        // 保留所有任务，通过 isClickable 区分今日任务和待完成任务
        // 单次任务：今天可点击，未来日期不可点击
        // 循环任务：今日未完成可点击，今日已完成或未来日期不可点击
        const filteredTodoTasks = todoTasks.filter(task => {
          // 过滤所有已完成任务（不管单次还是循环），只显示当前可执行/待完成任务
          if (task.status === 'completed') {
            return false;
          }
          // 兼容单次任务completed字段
          if (task.type === 'none' && task.completed) {
            return false;
          }
          return true;
        });
        
        // 拆分为今日任务和待完成任务（过期任务不显示在首页）
        const todayTaskList = filteredTodoTasks.filter(task => task.isClickable && !task.isExpired);
        const upcomingTaskList = filteredTodoTasks.filter(task => !task.isClickable && !task.isExpired);
        
        // 调试：记录被过滤掉的原因
        todoTasks.forEach(task => {
          const inToday = todayTaskList.some(t => t.id === task.id);
          const inUpcoming = upcomingTaskList.some(t => t.id === task.id);
          if (!inToday && !inUpcoming) {
            console.log(`⚠️ 任务被过滤: ${task.name}, status=${task.status}, type=${task.type}, completed=${task.completed}, isExpired=${task.isExpired}, frequency=${task.frequency}, dueDate=${task.dueDate || 'null'}, createTime=${task.createTime || 'null'}`);
          }
        });
        console.log('📱 今日任务:', todayTaskList.map(t => t.name));
        console.log('📱 待完成任务:', upcomingTaskList.map(t => t.name));
        
        // 计算今天已完成任务数：当天有打卡记录的任务
        const completedTodayCount = todoTasks.filter(task => task.todayCheckins > 0).length;
        
        // 按时间排序（由近及远）
        todayTaskList.sort((a, b) => a.sortTime - b.sortTime);
        upcomingTaskList.sort((a, b) => a.sortTime - b.sortTime);
        
        console.log('📱 今日任务:', todayTaskList.length);
        console.log('📱 待完成任务:', upcomingTaskList.length);
        console.log('✅ 今日已完成任务:', completedTodayCount);
        
        // 计算今日总任务数：今日完成 + 今日未完成
        const totalTodayTasks = completedTodayCount + todayTaskList.length;
        
        // 判断用户是否曾经创建过任务（使用 totalTasksCount）
        const totalTasksCount = resultData.totalTasksCount || 0;
        
        this.setData({
          hasTasks: filteredTasks.length > 0 || completedTodayCount > 0,
          hasEverCreatedTask: totalTasksCount > 0, // 用户是否曾经创建过任务
          todayTasks: todayTaskList,
          upcomingTasks: upcomingTaskList,
          'todayStats.total': totalTodayTasks,
          'todayStats.completed': completedTodayCount,
          loading: false
        });
        
        // 计算并更新统计数据
        this.calculateStats();
        
        console.log('✅ 数据已成功设置到页面，等待渲染...');
      } else {
        console.error('获取任务失败:', resultData.error || '未知错误');
        this.setData({
          todayTasks: [],
          upcomingTasks: [],
          hasEverCreatedTask: false, // 获取失败时保守处理
          'todayStats.total': 0,
          'todayStats.completed': 0,
          'todayStats.remaining': 0,
          loading: false
        });
      }
    } catch (error) {
      console.error('获取待打卡任务失败:', error);
      // 出错时显示空数组
      this.setData({
        todayTasks: [],
        upcomingTasks: [],
        hasEverCreatedTask: false, // 获取失败时保守处理
        'todayStats.total': 0,
        'todayStats.completed': 0,
        'todayStats.remaining': 0,
        loading: false
      });
    } finally {
      if (!skipLoading) {
        wx.hideLoading();
      }
    }
  },
  
  /**
   * 刷新任务列表
   */
  async refreshTasks() {
    if (this.data.refreshing) return;
    console.log('🔄 手动刷新任务列表');
    this.setData({ refreshing: true });
    wx.showLoading({ title: '刷新中...' });
    
    try {
      // 然后重新加载任务列表
      await this.initData(true);
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ refreshing: false });
    }
  },

  onPullDownRefresh: async function() {
    await this.refreshTasks();
    wx.stopPullDownRefresh();
  },

  // 调试函数：直接查询原始任务数据
  async queryRawTasksForDebug() {
    try {
      console.log('🔍 开始查询原始任务数据用于调试...');
      const familyId = this.getCurrentFamilyId();
      const debugResult = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: '', // 不指定状态，获取所有非删除任务
          includeCompleted: true,
          familyId
        }
      });
      
      const debugTasks = debugResult.result && debugResult.result.tasks || [];
      console.log('📊 调试任务总数:', debugTasks.length);
      
      if (debugTasks.length === 0) {
        console.log('⚠️ 数据库中没有找到任何任务！');
      } else {
        debugTasks.forEach((task, index) => {
          console.log(`📋 原始任务${index + 1}:`, {
            id: task._id,
            title: task.title,
            status: task.status,
            frequency: task.frequency,
            _openid: task._openid,
            isTemplate: task.isTemplate,
            selectedDays: task.selectedDays,
            selectedMonthDays: task.selectedMonthDays,
            createTime: task.createTime
          });
        });
      }
    } catch (err) {
      console.error('❌ 调试函数异常:', err);
    }
  },
  
  /**
   * 格式化时间显示
   */
  _formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 获取单次任务的日期显示文本
   * @param {string|Date} dueDate - 任务日期
   * @returns {string} 日期显示文本（今天/明天/具体日期）
   */
  _getDueDateText(dueDate) {
    if (!dueDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const taskDate = new Date(dueDate);
    taskDate.setHours(0, 0, 0, 0);
    
    // 计算日期差（天数）
    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '明天';
    } else {
      // 2天后显示具体日期，如 04-01
      const month = (taskDate.getMonth() + 1).toString().padStart(2, '0');
      const day = taskDate.getDate().toString().padStart(2, '0');
      return `${month}-${day}`;
    }
  },

  /**
   * 计算任务统计数据
   */
  calculateStats() {
    // 今日未完成任务数（仅今日任务，不包含待完成列表）
    const remaining = this.data.todayTasks.length;

    // 今日已完成任务数，从 todayStats.completed 读取
    const completed = this.data.todayStats?.completed || 0;

    // 今日任务总数：今日完成 + 今日未完成
    const total = completed + remaining;

    // 完成率
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    console.log('计算得到的统计数据:', {total, completed, remaining, percentage});
    
    this.setData({
      todayStats: {
        total,
        completed,
        remaining,
        percentage
      }
    });
  },

  /**
   * 处理任务打卡
   * @param {Object} e - 事件对象，包含任务ID
   * @returns {Promise<void>} - Promise对象，表示打卡操作的完成状态
   */
  async handleCheckIn(e) {
    console.log('收到打卡请求，事件对象:', e);
    let loadingShown = false;
    
    // 防抖检查：如果正在打卡中，直接返回
    if (this.data.checkingIn) {
      console.log('正在打卡中，忽略重复请求');
      return;
    }
    
    try {
      // 设置打卡中状态
      this.setData({ checkingIn: true });
      
      // 增强参数验证
      if (!e || typeof e !== 'object') {
        console.error('无效的事件对象:', e);
        wx.showToast({
          title: '系统错误，请重试',
          icon: 'none'
        });
        return;
      }
      
      // 检查事件对象的必要结构
      if (!e.currentTarget || typeof e.currentTarget !== 'object') {
        console.error('事件对象缺少currentTarget属性:', e);
        wx.showToast({
          title: '系统错误，请重试',
          icon: 'none'
        });
        return;
      }
      
      if (!e.currentTarget.dataset || typeof e.currentTarget.dataset !== 'object') {
        console.error('事件对象缺少dataset属性:', e);
        wx.showToast({
          title: '系统错误，请重试',
          icon: 'none'
        });
        return;
      }
      
      const taskId = e.currentTarget.dataset.id;
      
      // 增强taskId有效性验证
      if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
        console.error('无效的任务ID:', taskId);
        wx.showToast({
          title: '任务信息无效',
          icon: 'none'
        });
        return;
      }
      
      // 严格的任务ID格式验证
      if (taskId.length < 20) {
        console.error('任务ID格式不正确，长度不足:', taskId.length);
        wx.showToast({
          title: '任务ID格式错误',
          icon: 'none'
        });
        return;
      }
      
      console.log('开始打卡操作，任务ID:', taskId);
      
      // 找到被打卡的任务 - 支持id和_id两种格式，同时在今日任务和待完成任务中查找
      const taskToComplete = this.data.todayTasks.find(task => task.id === taskId || task._id === taskId) || 
                            this.data.upcomingTasks.find(task => task.id === taskId || task._id === taskId);
      
      if (!taskToComplete) {
        console.error('未找到任务:', taskId);
        wx.showToast({
          title: '任务不存在',
          icon: 'none'
        });
        return;
      }
      
      // 获取任务的循环次数和当前打卡次数
      const cycleTimes = 1; // 每日任务默认只能完成1次
      const currentCheckins = taskToComplete.todayCheckins || 0;
      const nextCheckins = currentCheckins + 1;
      const isAllCompleted = nextCheckins >= cycleTimes;
      
      console.log('任务打卡信息:', {
        cycleTimes,
        currentCheckins,
        nextCheckins,
        isAllCompleted
      });
      
      // 显示加载状态
      wx.showLoading({
        title: '打卡中...',
      });
      loadingShown = true;
      
      // 准备云函数参数，确保所有参数都严格有效
      const currentDate = new Date();
      const sanitizedTaskId = taskId.trim();
      
      // 结构化参数准备，确保所有必要字段都有有效值
      const cloudParams = {
        taskId: sanitizedTaskId,
        status: isAllCompleted ? 'completed' : 'pending', // 只有完成所有次数才标记为completed
        completedDate: isAllCompleted ? currentDate.toISOString() : null,
        checkins: nextCheckins, // 当前打卡次数
        cycleTimes: cycleTimes // 总循环次数
      };
      
      console.log('调用云函数参数 - 已验证并格式化:', JSON.stringify(cloudParams));
      console.log('云函数参数类型检查:', {
        taskIdType: typeof cloudParams.taskId,
        statusType: typeof cloudParams.status,
        completedDateType: typeof cloudParams.completedDate,
        checkinsType: typeof cloudParams.checkins,
        cycleTimesType: typeof cloudParams.cycleTimes
      });
      
      // 调用云函数更新任务状态
      console.log('开始调用updateTaskStatus云函数...');
      const cloudResult = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: cloudParams
      });
      
      console.log('云函数调用结果:', JSON.stringify(cloudResult));
      
      // 严格检查云函数返回结果格式
      if (!cloudResult || !cloudResult.result) {
        throw new Error('云函数返回格式错误');
      }
      
      if (cloudResult.result.success) {
        console.log('云函数执行成功，开始更新页面状态...');
        
        // 更新任务的打卡次数
        const updatedTask = {
          ...taskToComplete,
          todayCheckins: nextCheckins
        };
        
        const currentCompleted = this.data.todayStats?.completed || 0;
        const currentRemaining = this.data.todayTasks.length;
        
        if (isAllCompleted) {
          // 完成所有次数，从todayTasks中移除该任务
          const updatedTodayTasks = this.data.todayTasks.filter(task => task.id !== sanitizedTaskId && task._id !== sanitizedTaskId);
          
          // 同时将该任务加入待完成列表（本地乐观更新）
          const updatedUpcomingTasks = [...this.data.upcomingTasks];
          const existingIndex = updatedUpcomingTasks.findIndex(task => task.id === sanitizedTaskId || task._id === sanitizedTaskId);
          const movedTask = {
            ...updatedTask,
            completed: true,
            isClickable: false,
            disabledText: taskToComplete.frequency === 'daily' ? '明日' : this._getNextCheckInDateText(taskToComplete.frequency, taskToComplete.selectedDays || [], taskToComplete.selectedMonthDays || [])
          };
          if (existingIndex >= 0) {
            updatedUpcomingTasks[existingIndex] = movedTask;
          } else {
            updatedUpcomingTasks.push(movedTask);
          }
          
          // 更新页面数据：同步更新 completed 和 total，防止数字跳动
          this.setData({
            todayTasks: updatedTodayTasks,
            upcomingTasks: updatedUpcomingTasks,
            'todayStats.completed': currentCompleted + 1,
            'todayStats.total': (currentCompleted + 1) + updatedTodayTasks.length,
            'todayStats.remaining': updatedTodayTasks.length
          });
        } else {
          // 未完成所有次数，更新todayTasks中该任务的打卡次数
          const updatedTodayTasks = this.data.todayTasks.map(task => {
            if (task.id === sanitizedTaskId || task._id === sanitizedTaskId) {
              return updatedTask;
            }
            return task;
          });
          
          // 更新页面数据
          this.setData({
            todayTasks: updatedTodayTasks
          });
        }
        
        // 乐观更新已同步 stats，无需再调用 calculateStats（后续 getTodoTasks 会覆盖为真实值）
        if (!isAllCompleted) {
          this.calculateStats();
        }
        
        // 显示成功提示
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });
        console.log('打卡操作成功完成');
        
        // 重新获取任务数据以确保数据一致性
        await this.getTodoTasks(true);
      } else {
        const errorMsg = cloudResult.result.error || '打卡失败';
        console.error('打卡失败，云函数返回错误:', errorMsg);
        // 提供更友好的错误提示
        let displayError = errorMsg;
        if (errorMsg.includes('查询参数对象值不能均为undefined')) {
          displayError = '任务ID无效，请刷新页面后重试';
        }
        wx.showToast({
          title: displayError,
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('打卡失败，捕获到异常:', error);
      console.error('异常详情:', JSON.stringify(error));
      
      // 根据错误类型提供更具体的错误信息
      let errorMsg = '打卡失败，请重试';
      
      if (error.errMsg) {
        if (error.errMsg.includes('FunctionName')) {
          errorMsg = '云函数未找到，请检查部署';
        } else if (error.errMsg.includes('request:fail')) {
          errorMsg = '网络连接失败，请检查网络';
        } else if (error.errMsg.includes('查询参数对象值不能均为undefined')) {
          errorMsg = '任务ID无效，请刷新页面后重试';
        }
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
    } finally {
      // 隐藏加载状态 - 只有在显示了loading的情况下才隐藏
      if (loadingShown) {
        wx.hideLoading();
      }
      // 重置打卡中状态
      this.setData({ checkingIn: false });
      console.log('打卡操作流程完成');
    }
  },
  
  /**
   * 获取当前时间格式
   * @returns {string} 格式化的当前时间
   */
  _getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `今天 ${hours}:${minutes}:${seconds}`;
  },

  /**
   * 编辑任务
   */
  handleEditTask(e) {
    // 关闭左滑菜单
    this.closeAllSwipeMenus();
    
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/task/create?id=${taskId}&mode=edit`
    });
  },

  /**
   * 删除任务
   * 调用deleteTask云函数执行软删除操作，与create.js保持一致
   */
  handleDeleteTask(e) {
    // 关闭左滑菜单
    this.closeAllSwipeMenus();
    
    const taskId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个任务吗？删除后将无法恢复。',
      confirmColor: '#E57373',
      success: async (res) => {
        if (res.confirm) {
          // 显示加载状态
          wx.showLoading({
            title: '删除中...',
          });
          
          try {
            // 调用云函数执行删除操作
            const result = await wx.cloud.callFunction({
              name: 'deleteTask',
              data: {
                taskId: taskId
              }
            });
            
            wx.hideLoading();
            
            // 处理云函数返回结果
            if (result.result && result.result.success) {
              // 从本地数据中过滤掉已删除的任务
              const deletedTask = this.data.todayTasks.find(task => task.id === taskId) || this.data.upcomingTasks.find(task => task.id === taskId);
              const wasCompleted = deletedTask && (deletedTask.status === 'completed' || deletedTask.todayCheckins > 0);
              const todayTasks = this.data.todayTasks.filter(task => task.id !== taskId);
              const upcomingTasks = this.data.upcomingTasks.filter(task => task.id !== taskId);
              
              this.setData({
                todayTasks,
                upcomingTasks,
                'todayStats.completed': Math.max(0, (this.data.todayStats.completed || 0) - (wasCompleted ? 1 : 0))
              });
              
              // 重新计算统计数据
              this.calculateStats();
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            } else {
              // 更新失败的提示
              const errorMsg = result.result && result.result.error ? 
                result.result.error : '删除失败，请重试';
              
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 3000
              });
              
              console.error('云函数删除失败', result);
            }
          } catch (error) {
            wx.hideLoading();
            console.error('调用云函数失败', error);
            
            // 即使云函数调用失败，也可以从前端移除任务，提供更好的用户体验
            const todayTasks = this.data.todayTasks.filter(task => task.id !== taskId);
            const upcomingTasks = this.data.upcomingTasks.filter(task => task.id !== taskId);
            
            this.setData({
              todayTasks,
              upcomingTasks
            });
            
            this.calculateStats();
            
            // 根据错误类型显示不同提示
            let errorMsg = '删除成功（本地）';
            if (error.errMsg && error.errMsg.includes('cloud.callFunction:fail')) {
              errorMsg = '网络异常，已在本地删除';
            }
            
            wx.showToast({
              title: errorMsg,
              icon: 'success'
            });
          }
        }
      }
    });
  },

  /**
   * 关闭所有左滑菜单
   */
  closeAllSwipeMenus() {
    const todayTasks = this.data.todayTasks.map(item => {
      item.swipeLeft = false;
      return item;
    });
    const upcomingTasks = this.data.upcomingTasks.map(item => {
      item.swipeLeft = false;
      return item;
    });
    this.setData({ todayTasks, upcomingTasks });
  },

  /**
   * 处理任务点击事件 - 点击整个cell直接打卡
   */
  handleTaskTap(e) {
    const taskId = e.currentTarget.dataset.id;
    const isClickable = e.currentTarget.dataset.clickable;
    
    // 关闭其他左滑菜单
    this.closeAllSwipeMenus();
    
    // 如果任务不可点击（置灰状态），显示提示
    if (isClickable === false || isClickable === 'false') {
      console.log('任务不可点击:', taskId);
      wx.showToast({
        title: '该任务暂时无法打卡',
        icon: 'none'
      });
      return;
    }
    
    // 查找任务对象
    let task = this.data.todayTasks.find(t => t.id === taskId || t._id === taskId);
    
    console.log('Task tap detected:', { taskId, task });
    
    // 只有待打卡任务才能点击打卡
    if (task && !task.completed) {
      console.log('点击任务，执行打卡:', taskId);
      // 直接调用打卡方法
      this.handleCheckIn(e);
    } else if (task && task.completed) {
      console.log('任务已完成，无需打卡');
      wx.showToast({
        title: '任务已完成',
        icon: 'none'
      });
    } else {
      console.log('Task not found');
    }
  },

  /**
   * 左滑相关手势处理 - 今日任务
   */
  touchStart(e) {
    const index = e.currentTarget.dataset.index;
    const task = this.data.todayTasks[index];
    if (!task || !task.canEdit) {
      return;
    }

    // 关闭待完成任务的左滑菜单
    const upcomingTasks = this.data.upcomingTasks.map(item => {
      item.swipeLeft = false;
      return item;
    });
    
    const touch = e.touches[0];
    this.setData({
      upcomingTasks,
      [`todayTasks[${index}].startX`]: touch.clientX,
      [`todayTasks[${index}].startY`]: touch.clientY
    });
  },

  touchMove(e) {
    const index = e.currentTarget.dataset.index;
    const task = this.data.todayTasks[index];
    if (!task || !task.canEdit) {
      return;
    }

    const touch = e.touches[0];
    const startX = task.startX || 0;
    const startY = task.startY || 0;
    
    // 计算水平和垂直移动距离
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    
    // 如果水平移动距离大于垂直移动距离，且向左滑动超过30px
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -30) {
      // 关闭其他已打开的项
      const todayTasks = this.data.todayTasks.map((item, idx) => {
        if (idx !== index) {
          item.swipeLeft = false;
        }
        return item;
      });
      
      todayTasks[index].swipeLeft = true;
      this.setData({ todayTasks });
    } else if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 30) {
      // 向右滑动，关闭当前项
      this.setData({
        [`todayTasks[${index}].swipeLeft`]: false
      });
    }
  },

  touchEnd(e) {
    // 可以在这里添加滑动结束的逻辑
  },

  /**
   * 左滑相关手势处理 - 待完成任务
   */
  touchStartUpcoming(e) {
    const index = e.currentTarget.dataset.index;
    const task = this.data.upcomingTasks[index];
    if (!task || !task.canEdit) {
      return;
    }

    // 关闭今日任务的左滑菜单
    const todayTasks = this.data.todayTasks.map(item => {
      item.swipeLeft = false;
      return item;
    });
    
    const touch = e.touches[0];
    this.setData({
      todayTasks,
      [`upcomingTasks[${index}].startX`]: touch.clientX,
      [`upcomingTasks[${index}].startY`]: touch.clientY
    });
  },

  touchMoveUpcoming(e) {
    const index = e.currentTarget.dataset.index;
    const task = this.data.upcomingTasks[index];
    if (!task || !task.canEdit) {
      return;
    }

    const touch = e.touches[0];
    const startX = task.startX || 0;
    const startY = task.startY || 0;
    
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -30) {
      const upcomingTasks = this.data.upcomingTasks.map((item, idx) => {
        if (idx !== index) {
          item.swipeLeft = false;
        }
        return item;
      });
      
      upcomingTasks[index].swipeLeft = true;
      this.setData({ upcomingTasks });
    } else if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 30) {
      this.setData({
        [`upcomingTasks[${index}].swipeLeft`]: false
      });
    }
  },

  touchEndUpcoming(e) {
    // 滑动结束逻辑
  },

  /**
   * 打开事项建议页面
   */
  openSuggestPage() {
    const familyIdParam = this.data.currentFamilyId ? `&familyId=${this.data.currentFamilyId}` : '';
    wx.navigateTo({
      url: `/pages/task/create?showTemplates=true${familyIdParam}`
    });
  },
  
  /**
   * 打开创建任务页面
   */
  openCreateTask() {
    const familyIdParam = this.data.currentFamilyId ? `&familyId=${this.data.currentFamilyId}` : '';
    wx.navigateTo({
      url: `/pages/task/create?mode=create${familyIdParam}`
    });
  },

  /**
   * 打开 AI 育儿大师页面
   */
  goAiMaster() {
    wx.navigateTo({
      url: '/pages/ai-master/index'
    });
  },
});
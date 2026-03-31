// pages/index/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    todayTasks: [], // 今日待打卡任务
    completedTasks: [], // 已完成任务
    todayStats: {
      total: 0,
      completed: 0,
      percentage: 0
    },
    currentDate: '', // 当前日期，在onLoad或onShow中初始化
    userInfo: null, // 用户信息
    greeting: '', // 问候语
    userStats: {
      streakDays: 0, // 连续打卡天数
      totalDays: 0, // 总打卡天数
      lastCheckin: '', // 最后打卡日期
      today: { checked: false, time: '' } // 今日打卡状态
    }
  },
  
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
          avatarUrl: '/images/default-avatar.svg',
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
   * 转换星期数字为中文文本
   * @param {Array|string|number|object} days - 星期数字数组、逗号分隔字符串、单个数字、JSON字符串或对象
   * @returns {string} 格式化后的星期文本
   */
  getWeekdayText: function(days) {
    // 添加详细调试日志 - 增强版
    console.log('🌟 getWeekdayText 被调用!');
    console.log('  输入:', days, '类型:', typeof days);
    console.log('  JSON格式:', JSON.stringify(days));
    console.log('  是否数组:', Array.isArray(days));
    console.log('  数组长度:', Array.isArray(days) ? days.length : 'N/A');
    
    // 定义星期数组，调整顺序为从周日开始对应getDay()返回值
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // 安全检查，确保输入不为空或无效
    if (days === undefined || days === null || days === '' || (Array.isArray(days) && days.length === 0)) {
      console.log('⚠️ 输入为空或无效，返回默认文本');
      return '每周'; // 返回默认文本，避免显示为空
    }
    
    // 数据类型转换处理 - 优化版
    let dayArray = [];
    
    // 处理数组类型
    if (Array.isArray(days)) {
      dayArray = days;
    }
    // 处理字符串类型 - 增强解析
    else if (typeof days === 'string' && days.trim()) {
      // 清理字符串，移除所有可能的特殊字符，只保留数字和逗号
      const cleanedStr = days.replace(/[^0-9,]/g, '');
      console.log('🧹 清理后的字符串:', cleanedStr);
      
      // 先尝试简单的逗号分割
      dayArray = cleanedStr.split(',').filter(day => day.trim() !== '');
      
      // 如果清理后只剩一个数字
      if (dayArray.length === 1 && /^\d+$/.test(dayArray[0])) {
        const singleDay = Number(dayArray[0]);
        if (!isNaN(singleDay)) {
          dayArray = [singleDay];
        }
      }
    }
    // 处理数字类型
    else if (typeof days === 'number') {
      dayArray = [days];
    }
    // 处理对象类型
    else if (typeof days === 'object') {
      try {
        // 尝试获取对象的所有值
        const values = Object.values(days);
        dayArray = values.flat(); // 扁平化处理
      } catch (e) {
        console.error('❌ 对象转换失败:', e);
        return '每周';
      }
    }
    
    // 日志显示转换后的数组
    console.log('🔄 转换后的数组:', dayArray, '长度:', dayArray.length);
    
    // 过滤有效数字并去重 - 更健壮的处理
    const validDays = [];
    const seen = new Set();
    
    for (let i = 0; i < dayArray.length; i++) {
      let day = dayArray[i];
      
      // 确保是字符串或数字
      if (day === null || day === undefined) continue;
      
      // 转换为数字
      const num = Number(day);
      
      console.log(`🔍 处理第${i}个元素:`, day, '转换为数字:', num);
      
      // 严格验证数字范围 (0-6)
      if (!isNaN(num) && Number.isInteger(num) && num >= 0 && num <= 6 && !seen.has(num)) {
        validDays.push(num);
        seen.add(num);
        console.log(`✅ 添加有效星期数字: ${num}`);
      } else {
        console.log(`❌ 跳过无效值: ${day}`);
      }
    }
    
    // 排序，确保按照星期顺序排列
    validDays.sort((a, b) => a - b);
    
    console.log('✅ 有效星期数字数组:', validDays);
    
    // 转换为中文星期文本
    const weekdayTexts = validDays.map(day => {
      // 确保day是有效的索引
      if (day >= 0 && day < weekDays.length) {
        const text = weekDays[day];
        console.log(`🔤 转换星期 ${day} -> ${text}`);
        return text;
      }
      return `未知(${day})`;
    });
    
    console.log('📝 星期文本数组:', weekdayTexts);
    
    // 如果没有有效天数，返回默认文本
    if (weekdayTexts.length === 0) {
      console.log('📅 没有有效星期，返回默认文本');
      return '每周';
    }
    
    // 返回格式化的文本
    const result = `每周 ${weekdayTexts.join('、')}`;
    console.log('🎉 最终返回结果:', result);
    return result;
  },

  /**
   * 转换月份日期数字为中文文本
   * @param {Array|string|number} days - 月份日期数组或逗号分隔字符串或单个数字或JSON字符串
   * @returns {string} 格式化后的日期文本
   */
  /**
   * 处理selectedDays或selectedMonthDays字段，支持各种格式
   * @param {Array|string|number|object} days - 各种格式的天数数据
   * @returns {Array} 标准化后的数字数组
   */
  /**
   * 处理选择的日期数组
   * @param {Array|string|number|object} days - 要处理的日期数据
   * @param {string} type - 处理类型，'week'表示处理星期几(0-6)，'month'表示处理月份日期(1-31)
   * @returns {Array} 处理后的日期数组
   */
  _processSelectedDays: function(days, type = 'week') {
    console.log('🔄 _processSelectedDays 输入:', days, '类型:', typeof days, '处理类型:', type);
    
    // 安全检查，确保输入不为空或无效
    if (days === undefined || days === null || days === '') {
      console.log('⚠️ 输入为空或无效，返回空数组');
      return [];
    }
    
    let dayArray = [];
    
    // 处理数组类型
    if (Array.isArray(days)) {
      console.log('📋 处理数组类型');
      dayArray = days;
    }
    // 处理字符串类型
    else if (typeof days === 'string' && days.trim()) {
      console.log('📝 处理字符串类型:', days);
      // 清理字符串，只保留数字和逗号
      const cleanedStr = days.replace(/[^0-9,]/g, '');
      console.log('🧹 清理后的字符串:', cleanedStr);
      
      // 按逗号分割并过滤空值
      dayArray = cleanedStr.split(',').filter(day => day.trim() !== '');
    }
    // 处理数字类型
    else if (typeof days === 'number') {
      console.log('🔢 处理数字类型:', days);
      dayArray = [days];
    }
    // 处理其他类型
    else {
      try {
        // 尝试将对象转换为数组（如果可能）
        if (typeof days === 'object') {
          dayArray = Object.values(days);
        } else {
          dayArray = [days];
        }
      } catch (e) {
        console.error('❌ 转换失败:', e);
        return [];
      }
    }
    
    // 将所有元素转换为数字并过滤无效值
    const validDays = [];
    const seen = new Set();
    
    // 根据类型设置不同的过滤范围
    const min = type === 'month' ? 1 : 0;
    const max = type === 'month' ? 31 : 6;
    
    for (let i = 0; i < dayArray.length; i++) {
      const num = Number(dayArray[i]);
      if (!isNaN(num) && Number.isInteger(num) && num >= min && num <= max && !seen.has(num)) {
        validDays.push(num);
        seen.add(num);
        console.log(`✅ 添加有效数字: ${num}`);
      } else {
        console.log(`❌ 跳过无效值: ${dayArray[i]} (类型:${type}, 范围:${min}-${max})`);
      }
    }
    
    console.log('🎯 处理结果:', validDays);
    return validDays;
  },
  
  getMonthdayText: function(days) {
    // 添加详细调试日志
    console.log('🌟 getMonthdayText 输入:', days, '类型:', typeof days, 'JSON:', JSON.stringify(days));
    
    // 安全检查，确保输入不为空或无效
    if (days === undefined || days === null || days === '') {
      console.log('⚠️ 输入为空或无效');
      return '每月'; // 返回默认文本，避免显示为空
    }
    
    // 数据类型转换处理
    let dayArray = [];
    
    // 处理数组类型
    if (Array.isArray(days)) {
      dayArray = days;
    }
    // 处理字符串类型
    else if (typeof days === 'string' && days.trim()) {
      // 尝试解析JSON字符串
      if ((days.startsWith('[') && days.endsWith(']')) || (days.startsWith('{') && days.endsWith('}'))) {
        try {
          const parsed = JSON.parse(days);
          if (Array.isArray(parsed)) {
            dayArray = parsed;
            console.log('📋 成功解析JSON数组:', dayArray);
          } else {
            // 如果解析结果不是数组，尝试作为普通字符串处理
            dayArray = days.split(',').map(day => day.trim());
          }
        } catch (e) {
          console.log('📝 JSON解析失败，按普通字符串处理:', e.message);
          // 普通字符串按逗号分割
          dayArray = days.split(',').map(day => day.trim());
        }
      } else {
        // 普通字符串按逗号分割
        dayArray = days.split(',').map(day => day.trim());
      }
    }
    // 处理数字类型
    else if (typeof days === 'number') {
      dayArray = [days];
    }
    // 处理其他类型
    else {
      try {
        // 尝试将对象转换为数组（如果可能）
        if (typeof days === 'object') {
          dayArray = Object.values(days);
        } else {
          dayArray = [days];
        }
      } catch (e) {
        console.error('❌ 转换失败:', e);
        return '每月';
      }
    }
    
    // 日志显示转换后的数组
    console.log('🔄 转换后的数组:', dayArray, '长度:', dayArray.length);
    
    // 过滤有效数字并去重
    const validDays = [];
    const seen = new Set();
    
    for (let i = 0; i < dayArray.length; i++) {
      let day = dayArray[i];
      
      // 如果是字符串，先清理可能的引号和空白
      if (typeof day === 'string') {
        day = day.replace(/['"\[\]\s]/g, '');
      }
      
      const num = Number(day);
      
      console.log(`🔍 处理第${i}个元素:`, day, '转换为数字:', num);
      
      if (!isNaN(num) && num >= 1 && num <= 31 && !seen.has(num)) {
        validDays.push(num);
        seen.add(num);
      }
    }
    
    // 排序
    validDays.sort((a, b) => a - b);
    
    console.log('✅ 有效月份日期数字:', validDays);
    
    // 转换为中文日期文本
    const dayTexts = validDays.map(day => {
      const text = `${day}日`;
      console.log(`🔤 转换日期 ${day} -> ${text}`);
      return text;
    });
    
    console.log('📝 日期文本数组:', dayTexts);
    
    // 如果没有有效天数，返回默认文本
    if (dayTexts.length === 0) {
      console.log('📅 没有有效日期，返回默认文本');
      return '每月';
    }
    
    // 返回格式化的文本
    const result = `每月 ${dayTexts.join('、')}`;
    console.log('🎉 最终返回:', result);
    return result;
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('页面加载，初始化数据...');
    // 更新当前日期
    this.updateCurrentDate();
    // 获取用户信息
    this.getUserInfo();
    // 调用初始化数据函数
    this.initData();
    
    // 执行测试函数，用于诊断月任务日期显示问题
    console.log('🔍 执行月任务相关测试...');
    this.testProcessSelectedDays();
    this.testMonthdayText();
    this.testMonthlyTaskProcessing();
  },
  
  /**
   * 检查用户登录状态
   */
  checkLoginStatus: function() {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      // 未登录则跳转到登录页面
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 更新当前日期
    this.updateCurrentDate();
    // 获取用户信息
    this.getUserInfo();
    // 每次显示页面时刷新数据并处理可能的错误
    this.initData().catch(error => {
      console.error('页面显示时初始化数据失败:', error);
    });
    
    // 检查用户登录状态
    this.checkLoginStatus();
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
      currentDate: `${year}年${month}月${day}日 ${weekday}`
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
        name: 'getUserStatistics'
      });
      
      if (result.result.success && result.result.data) {
        console.log('✅ 获取用户统计信息成功:', result.result.data);
        this.setData({
          userStats: result.result.data
        });
      }
    } catch (error) {
      console.error('❌ 获取用户统计信息失败:', error);
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
        this.getCompletedTasks(true),
        this.getUserStatistics()
      ]);
      
      // 计算统计数据
      this.calculateStats();
      
      // 确保页面有数据显示
      if (this.data.todayTasks.length === 0 && this.data.completedTasks.length === 0) {
        console.log('页面暂无任务数据');
      }
    } catch (error) {
      console.error('初始化数据失败:', error);
      // 确保页面不会空白
      this.setData({
        todayTasks: [],
        completedTasks: [],
        todayStats: {
          total: 0,
          completed: 0,
          percentage: 0
        }
      });
    } finally {
      if (!skipLoading) {
        wx.hideLoading();
      }
    }
  },

  /**
   * 获取待打卡任务列表
   * @param {boolean} skipLoading - 是否跳过加载提示，当由已显示loading的方法调用时使用
   */
  async getTodoTasks(skipLoading = false) {
    try {
      if (!skipLoading) {
        wx.showLoading({ title: '加载中' });
      }
      // 添加当前时间信息，用于调试
      const now = new Date();
      console.log('开始获取待打卡任务...');
      console.log('当前日期:', now.toLocaleDateString());
      console.log('当前星期几(0-6):', now.getDay());
      
      // 调用云函数获取任务列表，设置includeCompleted为false确保只获取待打卡任务
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: 'pending',
          includeCompleted: false
        }
      });
      
      console.log('获取待打卡任务结果:', JSON.stringify(result));
      const resultData = result.result || {};
      console.log('云函数返回状态:', resultData.success);
      console.log('云函数返回任务总数:', resultData.total);
      
      if (resultData.success) {
        // 云函数已经过滤出今天需要执行的任务，直接使用
        const filteredTasks = resultData.tasks || [];
        console.log('待打卡任务列表:', JSON.stringify(filteredTasks));
        
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
        
        // 处理任务数据，转换为前端需要的格式
        // 并行处理所有任务，获取每个任务的打卡记录数
        const todoTasksPromises = filteredTasks.map(async (task) => {
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
          
          // 获取今天的打卡记录数
          let todayCheckins = 0;
          try {
            const checkinsResult = await wx.cloud.callFunction({
              name: 'getTaskClockIns',
              data: {
                taskId: task._id,
                todayOnly: true // 只查询今天的打卡记录
              }
            });
            
            console.log(`  云函数返回结果:`, JSON.stringify(checkinsResult));
            
            if (checkinsResult.result.success && checkinsResult.result.data) {
              // 直接使用云函数返回的todayCount字段
              todayCheckins = checkinsResult.result.data.todayCount || 0;
              console.log(`  今天打卡记录数: ${todayCheckins}`);
              
              // 添加调试信息
              if (checkinsResult.result.data.debugInfo) {
                console.log(`  调试信息:`, JSON.stringify(checkinsResult.result.data.debugInfo));
              }
            } else {
              console.error(`获取任务${task._id}打卡记录失败:`, checkinsResult.result.error);
            }
          } catch (error) {
            console.error(`获取任务${task._id}打卡记录异常:`, error);
          }
          
          // 每日任务默认只能完成1次
          const cycleTimes = 1;
          
          // 判断任务是否已经完成
          const isCompletedAllTimes = todayCheckins >= cycleTimes;
          
          // 只有未完成所有次数的任务才保留在待打卡列表中
          return {
            id: task._id,
            name: task.title,
            subtitle: task.description || '待完成任务',
            time: task.reminderTime ? this._formatTime(task.reminderTime) : '',
            type: task.frequency || 'none',
            completed: isCompletedAllTimes, // 标记是否已完成所有次数
            category: task.category,
            priority: task.priority,
            // 添加循环任务相关字段
            frequency: task.frequency || 'none',
            cycleTimes: 1,
            todayCheckins: todayCheckins,
            // 使用处理后的selectedDays
            selectedDays: processedDays,
            // 优先使用云函数处理后的processedMonthDays字段
            selectedMonthDays: processedMonthDays,
            // 预先计算好的星期文本和月文本，供WXML直接使用
            weekdayText: weekdayText,
            monthdayText: monthdayText
          };
        });
        
        // 等待所有任务处理完成
        const todoTasks = await Promise.all(todoTasksPromises);
        
        // 过滤掉已完成所有次数的任务
        const filteredTodoTasks = todoTasks.filter(task => !task.completed);
        
        // 最终数据验证
        console.log('📱 最终设置到页面的数据:');
        filteredTodoTasks.forEach((task, index) => {
          console.log(`  任务${index+1} [${task.name}]:`);
          console.log(`    frequency:`, task.frequency);
          console.log(`    selectedDays:`, task.selectedDays);
          console.log(`    预先计算的星期文本:`, task.weekdayText);
          console.log(`    今日打卡次数: ${task.todayCheckins}`);
        });
        
        this.setData({
          todayTasks: filteredTodoTasks,
          loading: false
        });
        
        console.log('✅ 数据已成功设置到页面，等待渲染...');
      } else {
        console.error('获取任务失败:', resultData.error || '未知错误');
        // 失败时也尝试获取原始数据
        this.queryRawTasksForDebug();
        this.setData({
          todayTasks: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('获取待打卡任务失败:', error);
      // 出错时显示空数组
      this.setData({
        todayTasks: [],
        loading: false
      });
    } finally {
      if (!skipLoading) {
        wx.hideLoading();
      }
    }
  },
  
  // 调试函数：直接查询原始任务数据
  async queryRawTasksForDebug() {
    try {
      console.log('开始查询原始任务数据用于调试...');
      const debugResult = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: '', // 不指定状态，获取所有非删除任务
          includeCompleted: true
        }
      });
      
      console.log('调试查询结果:', JSON.stringify(debugResult));
      const debugTasks = debugResult.result && debugResult.result.tasks || [];
      console.log('调试任务总数:', debugTasks.length);
      debugTasks.forEach(task => {
        console.log(`原始任务 - ID: ${task._id}, 标题: ${task.title}, 状态: ${task.status}, 频率: ${task.frequency}, selectedDays: ${JSON.stringify(task.selectedDays)}`);
      });
    } catch (err) {
      console.error('调试函数异常:', err);
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
   * 获取已完成任务列表
   * @param {boolean} skipLoading - 是否跳过加载提示，当由已显示loading的方法调用时使用
   */
  async getCompletedTasks(skipLoading = false) {
    try {
      if (!skipLoading) {
        wx.showLoading({ title: '加载中' });
      }
      // 从云数据库获取已完成的任务
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: 'completed'
        }
      });
      
      if (result.result.success) {
        // 处理已完成任务数据
        const completedTasks = result.result.tasks.map(task => {
          // 处理selectedDays数据
          const processedDays = this._processSelectedDays(task.selectedDays);
          // 优先使用云函数处理后的processedMonthDays字段
          const monthDaysToUse = task.processedMonthDays || task.selectedMonthDays;
          // 处理月任务日期时传入type='month'参数，以支持1-31范围的日期
          const processedMonthDays = task.frequency === 'monthly' ? this._processSelectedDays(monthDaysToUse, 'month') : [];
          
          // 预先计算星期文本和月文本
          const weekdayText = task.frequency === 'weekly' ? this.getWeekdayText(processedDays) : '';
          const monthdayText = task.frequency === 'monthly' ? this.getMonthdayText(processedMonthDays) : '';
          console.log(`已完成任务 ${task._id} 处理后selectedMonthDays:`, processedMonthDays);
          console.log(`已完成任务 ${task._id} 月日期文本:`, monthdayText);
          
          // 获取可用于排序的原始时间戳
          let sortTime = 0;
          
          // 优先使用云函数返回的completedDate字段（数据库中的时间戳）
          if (task.completedDate) {
            sortTime = new Date(task.completedDate).getTime();
          } 
          // 对于没有completedDate的任务，尝试使用completedTime字段
          else if (task.completedTime) {
            // 创建一个日期对象
            const date = new Date();
            
            // 如果是昨天的任务，调整日期
            if (task.completedTime.includes('昨天')) {
              date.setDate(date.getDate() - 1);
            } else if (task.completedTime.includes('今天')) {
              // 今天的任务，保持当前日期
            } else {
              // 其他情况，尝试直接解析为日期
              const parsedDate = new Date(task.completedTime);
              if (!isNaN(parsedDate.getTime())) {
                sortTime = parsedDate.getTime();
              } else {
                // 提取时间部分
                const timeMatch = task.completedTime.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                  date.setHours(parseInt(timeMatch[1]));
                  date.setMinutes(parseInt(timeMatch[2]));
                  date.setSeconds(parseInt(timeMatch[3]));
                  sortTime = date.getTime();
                }
              }
            }
          }
          
          // 每日任务默认只能完成1次
          const cycleTimes = 1;
          const todayCheckins = 1; // 已完成任务肯定是完成了所有打卡次数
          
          return {
            id: task._id,
            name: task.title,
            subtitle: task.description || '已完成任务',
            time: task.reminderTime ? this._formatTime(task.reminderTime) : '',
            completedTime: task.completedTime ? this._formatCompletedTime(task.completedTime) : '未知时间',
            category: task.category,
            // 添加循环任务相关字段
            frequency: task.frequency || 'none',
            cycleTimes: 1,
            todayCheckins: todayCheckins,
            selectedDays: processedDays,
            selectedMonthDays: processedMonthDays,
            // 预先计算好的星期文本和月文本，供WXML直接使用
            weekdayText: weekdayText,
            monthdayText: monthdayText,
            // 用于排序的时间戳
            sortTime: sortTime
          };
        });
        
        // 按照完成时间排序，由近到远排列
        completedTasks.sort((a, b) => {
          // 降序排列（最新的在前）
          return b.sortTime - a.sortTime;
        });
        
        this.setData({
          completedTasks: completedTasks
        });
      }
    } catch (error) {
      console.error('获取已完成任务失败:', error);
      // 出错时显示空数组
      this.setData({
        completedTasks: []
      });
    } finally {
      if (!skipLoading) {
        wx.hideLoading();
      }
    }
  },
  /**
   * 格式化完成时间显示
   */
  _formatCompletedTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const prefix = isToday ? '今天' : '昨天';
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${prefix} ${hours}:${minutes}:${seconds}`;
  },

  /**
   * 计算任务统计数据
   */
  calculateStats() {
    // 总任务数 = 待打卡任务数 + 已完成任务数
    const total = this.data.todayTasks.length + this.data.completedTasks.length;
    
    // 已完成任务数 = completedTasks数组长度 + todayTasks中已完成所有打卡次数的任务数
    const completedInTodayTasks = this.data.todayTasks.filter(task => {
      const todayCheckins = task.todayCheckins || 0;
      return todayCheckins >= 1; // 每日任务默认只能完成1次
    }).length;
    
    const completed = this.data.completedTasks.length + completedInTodayTasks;
    
    // 直接计算完成率百分比并存储
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    console.log('计算得到的统计数据:', {total, completed, percentage, completedInTodayTasks});
    
    this.setData({
      todayStats: {
        total,
        completed,
        percentage // 添加计算好的百分比字段
      }
    });
  },

  /**
   * 处理打卡操作
   */
  /**
   * 处理任务打卡
   * @param {Object} e - 事件对象，包含任务ID
   * @returns {Promise<void>} - Promise对象，表示打卡操作的完成状态
   */
  async handleCheckIn(e) {
    console.log('收到打卡请求，事件对象:', e);
    let loadingShown = false;
    
    try {
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
      
      // 找到被打卡的任务 - 支持id和_id两种格式，同时在今日任务和已完成任务中查找
      const taskToComplete = this.data.todayTasks.find(task => task.id === taskId || task._id === taskId) || 
                            this.data.completedTasks.find(task => task.id === taskId || task._id === taskId);
      
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
        
        if (isAllCompleted) {
          // 完成所有次数，从todayTasks中移除该任务并添加到completedTasks
          const updatedTodayTasks = this.data.todayTasks.filter(task => task.id !== sanitizedTaskId && task._id !== sanitizedTaskId);
          
          // 创建带有完成时间的任务对象
          const completedTask = {
            ...updatedTask,
            completed: true,
            completedTime: this._getCurrentTime() // 添加完成时间
          };
          
          // 将任务添加到completedTasks数组
          const updatedCompletedTasks = [completedTask, ...this.data.completedTasks];
          
          // 更新页面数据
          this.setData({
            todayTasks: updatedTodayTasks,
            completedTasks: updatedCompletedTasks
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
        
        this.calculateStats();
        
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
    const taskId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个任务吗？',
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
              const todayTasks = this.data.todayTasks.filter(task => task.id !== taskId);
              const completedTasks = this.data.completedTasks.filter(task => task.id !== taskId);
              
              this.setData({
                todayTasks,
                completedTasks
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
            const completedTasks = this.data.completedTasks.filter(task => task.id !== taskId);
            
            this.setData({
              todayTasks,
              completedTasks
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
   * 处理任务点击事件
   * 对于循环任务，跳转到打卡统计页面
   */
  handleTaskTap(e) {
    const taskId = e.currentTarget.dataset.id;
    
    // 查找任务对象
    let task = this.data.todayTasks.find(t => t.id === taskId) || 
               this.data.completedTasks.find(t => t.id === taskId);
    
    console.log('Task tap detected:', { taskId, task });
    
    if (task) {
      if (task.frequency && task.frequency !== 'none') {
        console.log('Navigating to task stats page for cyclic task');
        // 是循环任务，跳转到打卡统计页面
        wx.navigateTo({
          url: '/pages/clockin/task-stats?' + 
               'taskId=' + encodeURIComponent(taskId) + 
               '&taskName=' + encodeURIComponent(task.name),
          fail: function(err) {
            console.error('Navigation failed:', err);
          }
        });
      } else {
        console.log('Not a cyclic task, no navigation');
      }
    } else {
      console.log('Task not found');
    }
  },

  /**
   * 打开事项建议页面
   */
  openSuggestPage() {
    wx.navigateTo({
      url: '/pages/suggest/list'
    });
  },
  
  /**
   * 打开创建任务页面
   */
  openCreateTask() {
    wx.navigateTo({
      url: '/pages/task/create'
    });
  },
  

  
  // 测试月任务日期格式化函数
  testMonthdayText() {
    console.log('🔍 开始测试月任务日期格式化...');
    
    // 测试不同格式的输入数据
    const testCases = [
      { name: '数字数组格式', input: [1, 5, 10], expected: '每月 1日、5日、10日' },
      { name: '字符串数组格式', input: ['1', '5', '10'], expected: '每月 1日、5日、10日' },
      { name: '单个数字', input: 15, expected: '每月 15日' },
      { name: '单个字符串', input: '20', expected: '每月 20日' },
      { name: '空数组', input: [], expected: '每月' },
      { name: '包含无效值的数组', input: [1, 'invalid', 30, 32], expected: '每月 1日、30日' },
      { name: '对象格式', input: { "1": true, "5": true, "10": true }, expected: '每月 1日、5日、10日' },
      { name: 'JSON字符串', input: '[2,4,6,8]', expected: '每月 2日、4日、6日、8日' }
    ];
    
    // 执行测试
    testCases.forEach(test => {
      try {
        console.log(`📋 测试用例: ${test.name}`);
        console.log(`🔢 输入:`, test.input);
        
        const result = this.getMonthdayText(test.input);
        console.log(`✅ 输出: "${result}"`);
        console.log(`🎯 预期: "${test.expected}"`);
        console.log(`🔍 测试${result === test.expected ? '通过' : '失败'}`);
      } catch (error) {
        console.error(`❌ 测试用例${test.name}执行出错:`, error);
      }
      console.log('------------------------------');
    });
    
    console.log('🔍 月任务日期格式化测试完成');
  },
  
  // 测试月任务日期显示功能完整流程
  testCompleteMonthlyTaskFlow() {
    console.log('\n======= 开始月任务日期显示功能完整测试 =======');
    
    // 测试1: 完整月任务处理流程
    console.log('\n测试1: 完整月任务处理流程');
    const mockTask = {
      selectedDays: [5, 15, 25],
      type: 'month'
    };
    
    // 步骤1: 处理选中日期
    const processedDays = this._processSelectedDays(mockTask.selectedDays, 'month');
    console.log('处理后的日期:', processedDays);
    
    // 步骤2: 生成日期文本
    const displayText = this.getMonthdayText(processedDays);
    console.log('显示文本:', displayText);
    console.log('测试结果:', displayText === '每月 5日、15日、25日' ? '通过' : '失败');
    
    // 测试2: 边界条件 - 无效日期处理
    console.log('\n测试2: 边界条件 - 无效日期处理');
    const mockTaskInvalid = {
      selectedDays: [0, 32, 10, -5],
      type: 'month'
    };
    
    const processedDaysInvalid = this._processSelectedDays(mockTaskInvalid.selectedDays, 'month');
    const displayTextInvalid = this.getMonthdayText(processedDaysInvalid);
    console.log('处理后的有效日期:', processedDaysInvalid);
    console.log('显示文本:', displayTextInvalid);
    console.log('测试结果:', displayTextInvalid === '每月 10日' ? '通过' : '失败');
    
    // 测试3: 边界条件 - 空输入
    console.log('\n测试3: 边界条件 - 空输入');
    const mockTaskEmpty = {
      selectedDays: [],
      type: 'month'
    };
    
    const processedDaysEmpty = this._processSelectedDays(mockTaskEmpty.selectedDays, 'month');
    const displayTextEmpty = this.getMonthdayText(processedDaysEmpty);
    console.log('处理后的日期:', processedDaysEmpty);
    console.log('显示文本:', displayTextEmpty);
    console.log('测试结果:', displayTextEmpty === '每月' ? '通过' : '失败');
    
    console.log('\n======= 月任务日期显示功能完整测试结束 =======');
  },
    
    // 测试周任务索引转换功能
    testWeeklyTaskIndexConversion() {
    console.log('====== 测试周任务索引转换功能 ======');
    
    // 模拟创建页面的索引值(0=周一,1=周二,...,6=周日)
    const pageIndices1 = ['0', '2', '4']; // 周一,周三,周五
    const pageIndices2 = ['6']; // 周日
    const pageIndices3 = ['0', '1', '2', '3', '4', '5', '6']; // 所有天
    const pageIndices4 = []; // 空
    
    // 模拟创建页面转换逻辑
    const convertToJavaScriptIndex = (pageIndexStr) => {
      const pageIndex = parseInt(pageIndexStr);
      return pageIndex === 6 ? 0 : pageIndex + 1;
    };
    
    // 转换并显示结果
    const result1 = pageIndices1.map(convertToJavaScriptIndex);
    console.log('页面索引 [周一,周三,周五] -> JS索引:', result1); // 应输出 [1,3,5]
    
    const result2 = pageIndices2.map(convertToJavaScriptIndex);
    console.log('页面索引 [周日] -> JS索引:', result2); // 应输出 [0]
    
    const result3 = pageIndices3.map(convertToJavaScriptIndex);
    console.log('页面索引 [所有天] -> JS索引:', result3); // 应输出 [1,2,3,4,5,6,0]
    
    const result4 = pageIndices4.map(convertToJavaScriptIndex);
    console.log('页面索引 [空] -> JS索引:', result4); // 应输出 []
    
    // 测试getWeekdayText函数对转换后索引的处理
    console.log('\ngetWeekdayText对转换后索引的处理:');
    console.log('周一,周三,周五 -> 文本:', this.getWeekdayText(result1)); // 应输出 "每周 周一、周三、周五"
    console.log('周日 -> 文本:', this.getWeekdayText(result2)); // 应输出 "每周 周日"
    console.log('所有天 -> 文本:', this.getWeekdayText(result3)); // 应输出 "每周 周日、周一、周二、周三、周四、周五、周六"
    console.log('空 -> 文本:', this.getWeekdayText(result4)); // 应输出 "每周"
    
    // 测试日期匹配逻辑
    const todayDay = new Date().getDay();
    console.log('\n今日星期索引:', todayDay, '(0=周日,1=周一,...6=周六)');
    
    // 模拟任务的selectedDays和今日是否匹配
    console.log('测试任务是否应显示:');
    console.log('任务在[周一,周三,周五] - 今日是否匹配:', result1.includes(todayDay));
    console.log('任务在[周日] - 今日是否匹配:', result2.includes(todayDay));
    console.log('任务在[所有天] - 今日是否匹配:', result3.includes(todayDay));
    
    console.log('====== 周任务测试完成 ======');
    return {
      conversionTest: true,
      todayMatchTest: result1.includes(todayDay),
      testResults: {
        pageIndices1,
        converted1: result1,
        pageIndices2,
        converted2: result2,
        todayDay
      }
    };
  },
  
  // 测试_processSelectedDays函数
  testProcessSelectedDays() {
    console.log('🔍 开始测试_processSelectedDays函数...');
    
    // 测试week类型（默认，0-6范围）
    console.log('📅 测试week类型（0-6范围）:');
    const weekTestCases = [
      { name: '数字数组', input: [1, 3, 5], expected: [1, 3, 5] },
      { name: '超出范围的值(week)', input: [1, 7, 8], expected: [1] }, // 7和8超出week范围(0-6)
      { name: '字符串数组', input: ['1', '3', '5'], expected: [1, 3, 5] },
      { name: '单个数字', input: 2, expected: [2] },
      { name: '对象格式', input: { "1": true, "3": true, "5": true }, expected: [1, 3, 5] },
      { name: 'null值', input: null, expected: [] }
    ];
    
    weekTestCases.forEach(test => {
      try {
        console.log(`📋 测试用例: ${test.name}`);
        console.log(`🔢 输入:`, test.input);
        
        const result = this._processSelectedDays(test.input, 'week');
        console.log(`✅ 输出:`, result);
        console.log(`🎯 预期:`, test.expected);
        
        const isEqual = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`🔍 week类型测试${isEqual ? '通过' : '失败'}`);
      } catch (error) {
        console.error(`❌ 测试用例${test.name}执行出错:`, error);
      }
      console.log('------------------------------');
    });
    
    // 测试month类型（1-31范围）
    console.log('📅 测试month类型（1-31范围）:');
    const monthTestCases = [
      { name: '数字数组', input: [1, 15, 30], expected: [1, 15, 30] },
      { name: '超出范围的值(month)', input: [1, 32, 35], expected: [1] }, // 32和35超出month范围(1-31)
      { name: '字符串数组', input: ['1', '15', '30'], expected: [1, 15, 30] },
      { name: '单个数字', input: 25, expected: [25] },
      { name: '对象格式', input: { "1": true, "15": true, "30": true }, expected: [1, 15, 30] },
      { name: 'JSON字符串', input: '[2,10,20,30]', expected: [2,10,20,30] },
      { name: 'null值', input: null, expected: [] }
    ];
    
    monthTestCases.forEach(test => {
      try {
        console.log(`📋 测试用例: ${test.name}`);
        console.log(`🔢 输入:`, test.input);
        
        const result = this._processSelectedDays(test.input, 'month');
        console.log(`✅ 输出:`, result);
        console.log(`🎯 预期:`, test.expected);
        
        const isEqual = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`🔍 month类型测试${isEqual ? '通过' : '失败'}`);
      } catch (error) {
        console.error(`❌ 测试用例${test.name}执行出错:`, error);
      }
      console.log('------------------------------');
    });
    
    console.log('🔍 _processSelectedDays函数测试完成');
  },
  
  // 测试完整的月任务处理流程
  async testMonthlyTaskProcessing() {
    console.log('🔍 开始测试完整的月任务处理流程...');
    
    try {
      // 1. 测试_processSelectedDays函数的month类型
      console.log('✅ 执行_processSelectedDays函数测试');
      this.testProcessSelectedDays();
      
      // 2. 测试getMonthdayText函数
      console.log('\n✅ 执行getMonthdayText函数测试');
      this.testMonthdayText();
      
      // 3. 创建测试月任务
      console.log('\n✅ 创建测试月任务');
      await this.createTestTask();
      
      // 4. 重新加载数据验证显示
      console.log('\n✅ 重新加载任务数据验证显示');
      await this.initData();
      
      // 5. 验证月任务数据
      console.log('\n✅ 验证月任务数据');
      const monthlyTasks = [...this.data.todayTasks, ...this.data.completedTasks]
        .filter(task => task.frequency === 'monthly');
      
      console.log(`找到 ${monthlyTasks.length} 个月任务`);
      monthlyTasks.forEach(task => {
        console.log(`\n月任务: ${task.name}`);
        console.log(`类型: ${task.frequency}`);
        console.log(`处理后日期:`, task.selectedMonthDays);
        console.log(`显示文本: ${task.monthdayText}`);
        console.log(`是否有正确的月日期文本: ${task.monthdayText && task.monthdayText.includes('每月')}`);
      });
      
      console.log('\n🎉 月任务处理流程测试完成！请检查页面上的月任务是否正确显示日期信息。');
    } catch (error) {
      console.error('❌ 月任务测试过程中出错:', error);
    }
  },
  
  // 创建测试任务用于验证
  async createTestTask() {
    // 模拟创建月任务
    console.log('🔧 准备创建测试月任务...');
    
    try {
      // 生成测试任务数据
      const testTask = {
        title: '测试月任务 - ' + new Date().getTime(),
        description: '这是一个用于测试的月任务',
        frequency: 'monthly',
        selectedMonthDays: [1, 15, 25]
      };
      
      // 模拟云函数调用
      console.log('🚀 模拟创建任务...');
      
      // 这里可以根据需要添加真实的云函数调用
      // const result = await wx.cloud.callFunction({
      //   name: 'addTask',
      //   data: testTask
      // });
      
      // 返回模拟结果
      console.log('✅ 测试任务创建成功');
      return {
        ...testTask,
        id: 'test-' + new Date().getTime(),
        createTime: new Date().getTime()
      };
    } catch (error) {
      console.error('❌ 创建测试任务失败:', error);
      throw error;
    }
  },

  /**
   * 打开创建任务页面
   * 点击+按钮直接跳转到编辑事项页面
   */
  openCreateTask() {
    wx.navigateTo({
      url: '/pages/task/create?mode=create'
    });
  }
});
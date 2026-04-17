// pages/clockin/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    currentDate: '',
    monthlyCompletionRate: 0,
    clockInData: {
      today: {
        checked: false,
        time: ''
      },
      streakDays: 0,
      totalDays: 0,
      lastCheckin: ''
    },
    records: [],
    loading: false,
    refreshing: false,
    clockingIn: false,
    hasMore: true,
    pageNum: 0,
    pageSize: 10
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ hasLoaded: true });

    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 更新当前日期
    this.updateCurrentDate();
    // 加载用户信息
    this.getUserInfo();
    // 加载打卡状态
    this.loadClockInStatus();
    // 加载打卡记录
    this.loadClockInRecords();
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
      // 更新当前日期
      this.updateCurrentDate();
      // 每次进入页面都重新加载打卡状态
      this.loadClockInStatus();
    } else {
      this.setData({ hasLoaded: true });
    }
  },
  
  /**
   * 更新当前日期显示
   */
  updateCurrentDate: function() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('zh-CN', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long'
    });
    this.setData({
      currentDate: formattedDate
    });
  },
  
  /**
   * 计算月度完成率
   */
  calculateMonthlyCompletionRate: function() {
    const streakDays = this.data.clockInData.streakDays || 0;
    const rate = Math.round((streakDays / 30) * 100);
    this.setData({
      monthlyCompletionRate: rate
    });
  },

  /**
   * 加载用户信息
   */
  getUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
    }
  },

  /**
   * 加载打卡状态
   */
  loadClockInStatus: async function() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserStatistics',
        data: { dummyParam: true } // 添加默认参数，避免查询参数均为undefined
      });
      
      if (res.result.success) {
        const stats = res.result.data || res.result; // 兼容两种返回结构
        this.setData({
        clockInData: {
          today: stats.today || { checked: false, time: '' },
          streakDays: stats.streakDays || 0,
          totalDays: stats.totalDays || 0,
          lastCheckin: stats.lastCheckin || ''
        }
      });
      
      // 更新月度完成率
      this.calculateMonthlyCompletionRate();
      }
    } catch (error) {
      console.error('加载打卡状态失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 加载打卡记录
   */
  loadClockInRecords: async function(isRefresh = false) {
    if (this.data.loading || (!this.data.hasMore && !isRefresh)) {
      return;
    }

    if (isRefresh) {
      this.setData({
        refreshing: true,
        records: [],
        pageNum: 0,
        hasMore: true
      });
    } else {
      this.setData({
        loading: true
      });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getClockIns',
        data: {
          page: this.data.pageNum + 1, // 调整为云函数期望的page参数（从1开始）
          pageSize: this.data.pageSize
        }
      });

      if (res.result.success) {
        const newRecords = res.result.clockIns || []; // 云函数返回的是clockIns字段
        const allRecords = isRefresh ? newRecords : [...this.data.records, ...newRecords];
        
        this.setData({
          records: allRecords,
          hasMore: newRecords.length === this.data.pageSize,
          pageNum: isRefresh ? 1 : this.data.pageNum + 1
        });
      }
    } catch (error) {
      console.error('加载打卡记录失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({
        loading: false,
        refreshing: false
      });
    }
  },

  /**
   * 今日打卡
   */
  doClockIn: async function() {
    // 如果今天已打卡，不允许重复打卡
    if (this.data.clockInData.today.checked) {
      wx.showToast({
        title: '今日已打卡',
        icon: 'none'
      });
      return;
    }

    if (this.data.clockingIn) return;
    this.setData({ clockingIn: true });

    try {
      wx.showLoading({
        title: '打卡中...',
        mask: true
      });

      const res = await wx.cloud.callFunction({
        name: 'clockIn'
      });

      if (res.result.success) {
        wx.showToast({
          title: '打卡成功！',
          icon: 'success'
        });
        
        // 更新打卡状态
        this.loadClockInStatus();
        // 重新加载打卡记录
        this.loadClockInRecords(true);
      } else {
        wx.showToast({
          title: res.result.error || res.result.message || '打卡失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('打卡失败:', error);
      wx.showToast({
        title: '打卡失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ clockingIn: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    this.loadClockInRecords(true).then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 上拉加载更多
   */
  onReachBottom: function() {
    this.loadClockInRecords();
  },

  /**
   * 查看打卡日历
   */
  viewCalendar: function() {
    wx.navigateTo({
      url: '/pages/clockin/calendar'
    });
  },


});
// 数据统计页面
Page({
  /**
   * 页面的初始数据
   */
  data: {
    statistics: null, // 统计数据
    timeRange: 'week', // 默认时间范围：week, month, year
    loading: true, // 加载状态
    timeRangeOptions: [
      { value: 'week', label: '最近一周' },
      { value: 'month', label: '最近一月' },
      { value: 'year', label: '最近一年' }
    ]
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
    this.loadStatistics()
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
      // 每次显示页面时重新加载数据
      this.loadStatistics()
    } else {
      this.setData({ hasLoaded: true });
    }
  },

  /**
   * 加载统计数据
   */
  loadStatistics: function () {
    const { timeRange } = this.data
    this.setData({ loading: true })

    // 添加一个标志控制是否使用mock数据（方便开发测试）
    const USE_MOCK_DATA = false; // 生产环境设为false，网络失败时自动降级使用mock数据
    
    if (USE_MOCK_DATA) {
      // 使用本地mock数据
      setTimeout(() => {
        const mockData = this.getMockStatisticsData(timeRange);
        this.setData({
          statistics: mockData,
          loading: false
        });
        console.log('使用mock数据加载成功');
      }, 500);
      return;
    }

    const familyId = wx.getStorageSync('currentFamilyId') || null;
    wx.cloud.callFunction({
      name: 'getStatistics',
      data: { timeRange, familyId },
      success: res => {
        console.log('云函数调用结果:', JSON.stringify(res));
        if (res.result && res.result.success) {
          this.setData({
            statistics: res.result.statistics
          })
        } else {
          console.error('云函数返回失败:', res.result ? res.result.error : '未知错误');
          wx.showToast({
            title: '获取统计数据失败: ' + (res.result ? res.result.error : '服务器错误'),
            icon: 'none',
            duration: 3000
          })
          // 失败时可以使用mock数据作为降级方案
          // this.setData({ statistics: this.getMockStatisticsData(timeRange) });
        }
      },
      fail: err => {
        console.error('获取统计数据失败:', JSON.stringify(err))
        wx.showToast({
          title: '获取统计数据失败: ' + (err.errMsg || '未知错误'),
          icon: 'none',
          duration: 3000
        })
        // 网络失败时使用mock数据作为降级方案
        // this.setData({ statistics: this.getMockStatisticsData(timeRange) });
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  /**
   * 切换时间范围
   */
  changeTimeRange: function (e) {
    const timeRange = e.currentTarget.dataset.value
    this.setData({ timeRange })
    this.loadStatistics()
  },

  /**
   * 跳转到任务管理页面
   */
  goToTasks: function () {
    wx.navigateTo({
      url: '/pages/task/index'
    })
  },

  /**
   * 跳转到打卡页面
   */
  goToClockIn: function () {
    wx.navigateTo({
      url: '/pages/clockin/index'
    })
  },

  /**
   * 获取mock统计数据
   * @param {string} timeRange - 时间范围
   * @returns {Object} mock统计数据
   */
  getMockStatisticsData: function (timeRange) {
    // 根据不同时间范围返回不同的mock数据
    if (timeRange === 'week') {
      return {
        totalTasks: 15,
        completedTasks: 12,
        taskCompletionRate: 80,
        totalClockIns: 7,
        consecutiveDays: 7,
        taskCategories: [
          { _id: '喂养', count: 5 },
          { _id: '睡眠', count: 4 },
          { _id: '健康', count: 3 },
          { _id: '娱乐', count: 3 }
        ]
      };
    } else if (timeRange === 'month') {
      return {
        totalTasks: 60,
        completedTasks: 52,
        taskCompletionRate: 87,
        totalClockIns: 28,
        consecutiveDays: 15,
        taskCategories: [
          { _id: '喂养', count: 20 },
          { _id: '睡眠', count: 15 },
          { _id: '健康', count: 12 },
          { _id: '娱乐', count: 10 },
          { _id: '教育', count: 3 }
        ]
      };
    } else { // year
      return {
        totalTasks: 720,
        completedTasks: 650,
        taskCompletionRate: 90,
        totalClockIns: 340,
        consecutiveDays: 30,
        taskCategories: [
          { _id: '喂养', count: 240 },
          { _id: '睡眠', count: 180 },
          { _id: '健康', count: 120 },
          { _id: '娱乐', count: 90 },
          { _id: '教育', count: 60 },
          { _id: '其他', count: 30 }
        ]
      };
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadStatistics()
    wx.stopPullDownRefresh()
  }
})
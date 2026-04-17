// pages/clockin/calendar.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    calendarData: [],
    checkedDays: [],
    loading: false
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

    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 生成日历数据
    this.generateCalendarData();
    // 加载打卡记录
    this.loadCheckedDays();
  },

  /**
   * 生成日历数据
   */
  generateCalendarData: function() {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    
    // 获取当月第一天是星期几
    const firstDay = new Date(year, month - 1, 1).getDay();
    // 获取当月的天数
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const calendarData = [];
    
    // 添加上个月的最后几天占位
    for (let i = 0; i < firstDay; i++) {
      calendarData.push({
        day: '',
        type: 'prev'
      });
    }
    
    // 添加当月的天数
    for (let i = 1; i <= daysInMonth; i++) {
      // 判断是否为今天
      const today = new Date();
      const isToday = today.getFullYear() === year && 
                      today.getMonth() + 1 === month && 
                      today.getDate() === i;
      
      calendarData.push({
        day: i,
        type: 'current',
        isToday: isToday
      });
    }
    
    // 添加下个月的前几天占位，使日历总天数为42
    const totalDays = Math.ceil(calendarData.length / 7) * 7;
    for (let i = calendarData.length; i < totalDays; i++) {
      calendarData.push({
        day: '',
        type: 'next'
      });
    }
    
    this.setData({
      calendarData: calendarData
    });
  },

  /**
   * 加载打卡记录
   */
  loadCheckedDays: async function() {
    this.setData({
      loading: true
    });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'getClockInDates',
        data: {
          year: this.data.currentYear,
          month: this.data.currentMonth
        }
      });
      
      if (res.result.success) {
        this.setData({
          checkedDays: res.result.clockInDates || []
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
        loading: false
      });
    }
  },

  /**
   * 计算本月打卡完成率
   */
  calculateCompletionRate: function() {
    const days = this.data.checkedDays.length;
    const total = new Date(this.data.currentYear, this.data.currentMonth, 0).getDate();
    return total > 0 ? Math.round((days / total) * 100) : 0;
  },

  /**
   * 上个月
   */
  prevMonth: function() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth - 1;
    
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    
    this.setData({
      currentYear: year,
      currentMonth: month
    }, () => {
      this.generateCalendarData();
      this.loadCheckedDays();
    });
  },

  /**
   * 下个月
   */
  nextMonth: function() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth + 1;
    
    if (month > 12) {
      month = 1;
      year += 1;
    }
    
    this.setData({
      currentYear: year,
      currentMonth: month
    }, () => {
      this.generateCalendarData();
      this.loadCheckedDays();
    });
  },

  /**
   * 回到今天
   */
  goToToday: function() {
    const today = new Date();
    
    this.setData({
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1
    }, () => {
      this.generateCalendarData();
      this.loadCheckedDays();
    });
  },

  /**
   * 判断某天是否已打卡
   */
  isChecked: function(day) {
    if (!day || day === '') return false;
    const dateStr = `${this.data.currentYear}-${String(this.data.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return this.data.checkedDays.includes(dateStr);
  },

  /**
   * 点击日期查看详情
   */
  onDayTap: function(e) {
    const { day, type } = e.currentTarget.dataset;
    
    if (type !== 'current' || !day) return;
    
    const dateStr = `${this.data.currentYear}-${String(this.data.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isChecked = this.isChecked(day);
    
    wx.showModal({
      title: dateStr,
      content: isChecked ? '当天已打卡' : '当天未打卡',
      showCancel: false
    });
  },

  /**
   * 返回上一页
   */
  navigateBack: function() {
    wx.navigateBack();
  }
});
// 任务详情页
const db = wx.cloud.database();
const _ = db.command;

Page({
  /**
   * 页面的初始数据
   */
  data: {
    task: null,
    checkInRecords: [],
    loading: true,
    stats: {
      totalCheckIns: 0,
      streakDays: 0,
      lastCheckIn: ''
    }
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

    if (options && options.id) {
      this.setData({ taskId: options.id });
      this.loadTaskDetail(options.id);
    } else {
      wx.showToast({
        title: '任务ID不存在',
        icon: 'none'
      });
      wx.navigateBack();
    }
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
    if (this.data.taskId) {
      this.loadTaskDetail(this.data.taskId);
    }
  },

  /**
   * 加载任务详情
   */
  loadTaskDetail: async function (taskId) {
    this.setData({ loading: true });
    
    try {
      // 通过云函数获取任务详情（带权限校验）
      const result = await wx.cloud.callFunction({
        name: 'getTaskDetail',
        data: { taskId }
      });
      
      if (!result.result || !result.result.success) {
        throw new Error(result.result ? result.result.error : '加载失败');
      }
      
      const task = result.result.data.task;
      const records = (result.result.data.clockIns || []).map(record => {
        const date = this.parseToDateObject(record.completedAt);
        return {
          ...record,
          dateStr: this.formatDate(date),
          timeStr: this.formatTime(date),
          userName: record.nickName || record.userName || ''
        };
      });

      const recordsWithUserNames = await this.fillRecordUserNames(records);
      
      // 计算统计数据
      const stats = this.calculateStats(recordsWithUserNames);
      
      this.setData({
        task: {
          ...task,
          categoryText: this.getCategoryText(task.category),
          formattedDueDate: this.getFormattedDueDate(task.dueDate),
          frequencyText: this.getFrequencyText(task.frequency),
          weekdayText: task.selectedDays ? this.getWeekdayText(task.selectedDays) : ''
        },
        checkInRecords: recordsWithUserNames,
        stats,
        loading: false
      });
    } catch (error) {
      console.error('加载任务详情失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      // 权限不足或任务不存在时返回上一页
      if (error.message && (error.message.includes('无权') || error.message.includes('不存在'))) {
        setTimeout(() => wx.navigateBack(), 1500);
      }
    }
  },

  /**
   * 计算打卡统计
   */
  calculateStats: function (records) {
    if (!records || records.length === 0) {
      return {
        totalCheckIns: 0,
        streakDays: 0,
        lastCheckIn: ''
      };
    }
    
    const totalCheckIns = records.length;
    const lastCheckIn = records[0].dateStr;
    
    // 计算连续打卡天数
    const uniqueDates = [...new Set(records.map(r => r.dateStr))].sort().reverse();
    let streakDays = 1;
    
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffTime = prevDate.getTime() - currDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streakDays++;
      } else {
        break;
      }
    }
    
    return {
      totalCheckIns,
      streakDays,
      lastCheckIn
    };
  },

  /**
   * 获取频率文本
   */
  getFrequencyText: function (frequency) {
    const map = {
      'daily': '每日',
      'weekly': '每周',
      'monthly': '每月',
      'once': '单次',
      'none': '单次'
    };
    return map[frequency] || '单次';
  },

  getCategoryText: function(category) {
    const categories = {
      care: '日常护理',
      feeding: '喂养',
      health: '健康',
      development: '发育',
      hygiene: '清洁',
      activity: '运动',
      study: '学习'
    };
    return categories[category] || category || '';
  },

  getFormattedDueDate: function(dueDate) {
    if (!dueDate) return '';
    const dateObj = this.parseToDateObject(dueDate);
    return dateObj ? this.formatDate(dateObj) : '';
  },

  parseToDateObject: function(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object') {
      if (value._seconds !== undefined || value._nanoseconds !== undefined) {
        return new Date((value._seconds || 0) * 1000 + Math.round((value._nanoseconds || 0) / 1000000));
      }
      if (value.seconds !== undefined) {
        return new Date((value.seconds || 0) * 1000 + Math.round((value.nanoseconds || 0) / 1000000));
      }
      if (value.$date) {
        return this.parseToDateObject(value.$date);
      }
      if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
      }
    }
    return null;
  },

  fillRecordUserNames: async function(records) {
    if (!Array.isArray(records) || records.length === 0) return records;

    const openIds = [...new Set(records.map(r => r._openid).filter(id => id))];
    if (openIds.length === 0) return records;

    try {
      const userRes = await db.collection('users').where({
        openid: _.in(openIds)
      }).get();
      const users = userRes.data || [];
      const userMap = users.reduce((map, user) => {
        map[user.openid] = user.nickName || user.nickname || user.userInfo?.nickName || user.userInfo?.nickname || '家庭成员';
        return map;
      }, {});

      return records.map(record => ({
        ...record,
        userName: record.userName || userMap[record._openid] || record.nickName || record.userName || '家庭成员'
      }));
    } catch (error) {
      console.warn('获取打卡人昵称失败:', error);
      return records.map(record => ({
        ...record,
        userName: record.userName || record.nickName || '家庭成员'
      }));
    }
  },

  /**
   * 获取星期文本
   */
  getWeekdayText: function (days) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    if (Array.isArray(days)) {
      return days.map(d => weekdays[d]).join('、');
    }
    return '';
  },

  /**
   * 格式化日期
   */
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 格式化时间
   */
  formatTime: function (date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 返回上一页
   */
  goBack: function () {
    wx.navigateBack();
  }
});

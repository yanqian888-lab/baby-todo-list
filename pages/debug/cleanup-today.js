// pages/debug/cleanup-today.js
// 清理当天记录页面

const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    result: '',
    todayDate: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 设置今天的日期
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    this.setData({
      todayDate: todayStr
    });
  },

  /**
   * 清理当天所有记录
   */
  cleanupTodayRecords: function() {
    try {
      wx.showLoading({ title: '清理中...' });
      
      // 获取今天的日期字符串
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // 1. 清理本地存储中的当天记录
      const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
      const beforeCount = allLocalRecords.length;
      
      // 过滤掉今天的所有记录
      const filteredLocalRecords = allLocalRecords.filter(record => {
        let recordDate = record.date;
        if (!recordDate) {
          return true; // 保留没有日期的记录
        }
        if (typeof recordDate !== 'string') {
          recordDate = new Date(recordDate).toISOString();
        }
        const recordDateStr = new Date(recordDate).toISOString().split('T')[0];
        return recordDateStr !== todayStr;
      });
      
      // 保存清理后的本地记录
      wx.setStorageSync('sensitivity_records', filteredLocalRecords);
      
      const deletedCount = beforeCount - filteredLocalRecords.length;
      
      this.setData({
        result: `清理完成！\n清理前: ${beforeCount} 条记录\n清理后: ${filteredLocalRecords.length} 条记录\n删除了 ${deletedCount} 条当天记录`
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '清理完成',
        icon: 'success'
      });
      
      // 清理完成后，重新加载排敏记录页面
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (error) {
      wx.hideLoading();
      console.error('清理当天记录失败:', error);
      this.setData({
        result: '清理失败: ' + error.message
      });
      wx.showToast({
        title: '清理失败',
        icon: 'none'
      });
    }
  },

  /**
   * 返回上一页
   */
  navigateBack: function() {
    wx.navigateBack();
  }
});

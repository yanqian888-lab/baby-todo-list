// pages/debug/index.js
// 调试工具页面

const clearAllTestData = require('../../scripts/clear-all-data');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    storageCount: 0,
    result: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.refreshStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.refreshStatus();
  },

  /**
   * 刷新数据状态
   */
  refreshStatus: function() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      this.setData({
        storageCount: storageInfo.keys.length
      });
    } catch (error) {
      console.error('获取存储信息失败:', error);
      this.setData({
        storageCount: '获取失败'
      });
    }
  },

  /**
   * 清空所有测试数据
   */
  clearAllData: function() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有测试数据吗？此操作不可恢复！',
      confirmText: '确定清空',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '清空数据中...' });
            
            // 清空本地存储
            const localKeys = wx.getStorageInfoSync().keys;
            const keysToClear = localKeys.filter(key => {
              return key.includes('sensitivity') || 
                     key === 'babyInfo' || 
                     key === 'userInfo' || 
                     key.includes('clockin') || 
                     key.includes('task') || 
                     key.includes('test');
            });
            
            keysToClear.forEach(key => {
              wx.removeStorageSync(key);
            });
            
            // 清空云数据库（如果有权限）
            try {
              const db = wx.cloud.database();
              
              // 清空排敏记录
              db.collection('sensitivity_records').where({}).remove();
              // 清空宝宝信息
              db.collection('baby_info').where({}).remove();
              // 清空任务记录
              db.collection('tasks').where({}).remove();
              // 清空打卡记录
              db.collection('clockin_records').where({}).remove();
            } catch (dbError) {
              console.warn('清空云数据库失败（可能是权限问题）:', dbError);
            }
            
            wx.hideLoading();
            
            this.setData({
              result: `清空完成！\n清空了 ${keysToClear.length} 项本地存储数据`,
              storageCount: wx.getStorageInfoSync().keys.length
            });
            
            wx.showToast({
              title: '数据清空完成',
              icon: 'success',
              duration: 2000
            });
          } catch (error) {
            wx.hideLoading();
            console.error('清空数据失败:', error);
            this.setData({
              result: '清空数据失败: ' + error.message
            });
            wx.showToast({
              title: '清空失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * 仅清空排敏记录
   */
  clearSensitivityData: function() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有排敏记录吗？此操作不可恢复！',
      confirmText: '确定清空',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清空本地存储中的排敏记录
            wx.removeStorageSync('sensitivity_records');
            
            // 清空云数据库中的排敏记录
            try {
              const db = wx.cloud.database();
              db.collection('sensitivity_records').where({}).remove();
            } catch (dbError) {
              console.warn('清空排敏记录数据库失败:', dbError);
            }
            
            this.setData({
              result: '排敏记录清空完成！',
              storageCount: wx.getStorageInfoSync().keys.length
            });
            
            wx.showToast({
              title: '排敏记录清空完成',
              icon: 'success',
              duration: 2000
            });
          } catch (error) {
            console.error('清空排敏记录失败:', error);
            this.setData({
              result: '清空排敏记录失败: ' + error.message
            });
            wx.showToast({
              title: '清空失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * 仅清空宝宝信息
   */
  clearBabyInfo: function() {
    wx.showModal({
      title: '警告',
      content: '确定要清空宝宝信息吗？此操作不可恢复！',
      confirmText: '确定清空',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清空本地存储中的宝宝信息
            wx.removeStorageSync('babyInfo');
            
            // 清空云数据库中的宝宝信息
            try {
              const db = wx.cloud.database();
              db.collection('baby_info').where({}).remove();
            } catch (dbError) {
              console.warn('清空宝宝信息数据库失败:', dbError);
            }
            
            // 重置全局用户信息中的宝宝信息
            const app = getApp();
            if (app.globalData.userInfo) {
              app.globalData.userInfo.babyInfo = null;
            }
            
            this.setData({
              result: '宝宝信息清空完成！',
              storageCount: wx.getStorageInfoSync().keys.length
            });
            
            wx.showToast({
              title: '宝宝信息清空完成',
              icon: 'success',
              duration: 2000
            });
          } catch (error) {
            console.error('清空宝宝信息失败:', error);
            this.setData({
              result: '清空宝宝信息失败: ' + error.message
            });
            wx.showToast({
              title: '清空失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * 仅清空打卡记录
   */
  clearClockinData: function() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有打卡记录吗？此操作不可恢复！',
      confirmText: '确定清空',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清空本地存储中的打卡数据
            const localKeys = wx.getStorageInfoSync().keys;
            const keysToClear = localKeys.filter(key => {
              return key.includes('clockin') || key.includes('task');
            });
            
            keysToClear.forEach(key => {
              wx.removeStorageSync(key);
            });
            
            // 清空云数据库中的打卡记录
            try {
              const db = wx.cloud.database();
              db.collection('tasks').where({}).remove();
              db.collection('clockin_records').where({}).remove();
            } catch (dbError) {
              console.warn('清空打卡记录数据库失败:', dbError);
            }
            
            this.setData({
              result: '打卡记录清空完成！',
              storageCount: wx.getStorageInfoSync().keys.length
            });
            
            wx.showToast({
              title: '打卡记录清空完成',
              icon: 'success',
              duration: 2000
            });
          } catch (error) {
            console.error('清空打卡记录失败:', error);
            this.setData({
              result: '清空打卡记录失败: ' + error.message
            });
            wx.showToast({
              title: '清空失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * 返回上一页
   */
  navigateBack: function() {
    wx.navigateBack();
  }
});

// pages/debug/cleanup.js
// 清理重复记录页面

const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    result: ''
  },

  /**
   * 清理重复记录
   */
  cleanupDuplicates: function() {
    try {
      // 获取本地存储中的所有排敏记录
      let allRecords = wx.getStorageSync('sensitivity_records') || [];
      console.log('清理前的记录数量:', allRecords.length);
      console.log('所有记录:', allRecords);

      // 对所有记录进行严格去重
      const uniqueRecordsMap = new Map();
      allRecords.forEach(record => {
        // 确保记录有必要字段
        const userId = record.userId || '';
        const babyId = record.babyId || '';
        const foodName = record.foodName || '';

        // 处理日期
        let recordDate = record.date;
        if (!recordDate) {
          recordDate = record.createTime || new Date().toISOString();
        }
        if (typeof recordDate !== 'string') {
          recordDate = new Date(recordDate).toISOString();
        }
        const dateKey = new Date(recordDate).toISOString().split('T')[0];

        // 创建复合键：用户ID-宝宝ID-食物ID-日期
        const foodId = record.foodId || foodName;
        const compositeKey = `${userId}-${babyId}-${foodId}-${dateKey}`;

        // 只保留最新的记录
        const existingRecord = uniqueRecordsMap.get(compositeKey);
        if (!existingRecord) {
          if (!record._id) {
            record._id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          record.date = recordDate;
          uniqueRecordsMap.set(compositeKey, record);
        } else {
          // 如果有重复，保留日期更新的记录
          const existingRecordDate = new Date(existingRecord.date).getTime();
          const currentRecordDate = new Date(record.date).getTime();
          if (currentRecordDate > existingRecordDate) {
            uniqueRecordsMap.set(compositeKey, record);
          }
        }
      });

      // 转换为数组
      const uniqueRecords = Array.from(uniqueRecordsMap.values());

      // 保存回本地存储
      wx.setStorageSync('sensitivity_records', uniqueRecords);
      console.log('清理后的记录数量:', uniqueRecords.length);
      console.log('清理后的记录:', uniqueRecords);

      this.setData({
        result: `清理完成！\n清理前: ${allRecords.length} 条记录\n清理后: ${uniqueRecords.length} 条记录\n删除了 ${allRecords.length - uniqueRecords.length} 条重复记录`
      });

      wx.showToast({
        title: '清理完成',
        icon: 'success'
      });
    } catch (error) {
      console.error('清理记录失败:', error);
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

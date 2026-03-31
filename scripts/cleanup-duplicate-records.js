// scripts/cleanup-duplicate-records.js
// 清理重复的排敏记录

const cleanDuplicateRecords = () => {
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
      
      // 创建复合键
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
    
    return uniqueRecords;
  } catch (error) {
    console.error('清理本地存储记录失败:', error);
    return [];
  }
};

module.exports = cleanDuplicateRecords;

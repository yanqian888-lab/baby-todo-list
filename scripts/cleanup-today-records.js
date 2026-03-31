// scripts/cleanup-today-records.js
// 清理当天所有排敏记录的脚本

const app = getApp();

// 清理当天记录的函数
function cleanupTodaySensitivityRecords() {
  try {
    console.log('开始清理当天所有排敏记录...');
    
    // 获取今天的日期字符串
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log('今天的日期:', todayStr);
    
    // 1. 清理本地存储中的当天记录
    const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
    console.log('清理前本地记录数量:', allLocalRecords.length);
    
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
      const isToday = recordDateStr === todayStr;
      
      if (isToday) {
        console.log(`删除本地记录: ${record.foodName || 'unknown'} - ${recordDateStr}`);
      }
      
      return !isToday;
    });
    
    // 保存清理后的本地记录
    wx.setStorageSync('sensitivity_records', filteredLocalRecords);
    console.log('清理后本地记录数量:', filteredLocalRecords.length);
    
    console.log('当天所有排敏记录清理完成！');
    return {
      success: true,
      message: `清理完成！共清理 ${allLocalRecords.length - filteredLocalRecords.length} 条当天记录`,
      beforeCount: allLocalRecords.length,
      afterCount: filteredLocalRecords.length
    };
  } catch (error) {
    console.error('清理当天记录失败:', error);
    return {
      success: false,
      message: '清理失败: ' + error.message
    };
  }
}

// 立即执行清理
cleanupTodaySensitivityRecords();

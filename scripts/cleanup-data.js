// scripts/cleanup-data.js
// 清理重复排敏记录的脚本

const app = getApp();

// 清理重复记录的函数
function cleanupDuplicateSensitivityRecords() {
  try {
    console.log('开始清理重复排敏记录...');
    
    // 1. 获取所有本地存储的记录
    const allLocalRecords = wx.getStorageSync('sensitivity_records') || [];
    console.log('清理前本地记录数量:', allLocalRecords.length);
    
    // 2. 严格去重，基于食物名称和日期
    const uniqueRecordsMap = new Map();
    
    allLocalRecords.forEach(record => {
      // 处理日期，确保格式一致
      let recordDate = record.date;
      if (!recordDate) {
        recordDate = new Date().toISOString();
      }
      if (typeof recordDate !== 'string') {
        recordDate = new Date(recordDate).toISOString();
      }
      const dateKey = new Date(recordDate).toISOString().split('T')[0];
      
      // 基于食物名称和日期的简单去重键（不考虑用户ID和宝宝ID，确保彻底清理）
      const simpleKey = `${record.foodName || 'unknown'}-${dateKey}`;
      
      console.log(`处理记录: ${record.foodName || 'unknown'} - ${dateKey}`);
      
      if (!uniqueRecordsMap.has(simpleKey)) {
        uniqueRecordsMap.set(simpleKey, record);
        console.log(`✓ 添加记录: ${simpleKey}`);
      } else {
        console.log(`✗ 跳过重复记录: ${simpleKey}`);
      }
    });
    
    // 转换为数组
    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    console.log('清理后记录数量:', uniqueRecords.length);
    
    // 3. 保存清理后的记录
    wx.setStorageSync('sensitivity_records', uniqueRecords);
    
    console.log('重复记录清理完成！');
    return {
      success: true,
      message: `清理完成！共清理 ${allLocalRecords.length - uniqueRecords.length} 条重复记录`,
      beforeCount: allLocalRecords.length,
      afterCount: uniqueRecords.length
    };
  } catch (error) {
    console.error('清理重复记录失败:', error);
    return {
      success: false,
      message: '清理失败: ' + error.message
    };
  }
}

// 导出函数，供其他地方调用
module.exports = cleanupDuplicateSensitivityRecords;

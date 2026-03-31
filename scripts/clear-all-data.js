// scripts/clear-all-data.js
// 清空小程序所有测试数据的脚本

/**
 * 清空小程序所有测试数据
 * 包括本地存储和云数据库中的测试记录
 */
function clearAllTestData() {
  try {
    console.log('开始清空所有测试数据...');
    
    // 1. 清空本地存储中的所有数据
    const localKeys = wx.getStorageInfoSync().keys;
    console.log('本地存储中的键:', localKeys);
    
    // 筛选需要清空的数据键
    const keysToClear = localKeys.filter(key => {
      // 清空与排敏相关的数据
      if (key.includes('sensitivity')) return true;
      // 清空宝宝信息
      if (key === 'babyInfo') return true;
      // 清空用户信息
      if (key === 'userInfo') return true;
      // 清空打卡相关数据
      if (key.includes('clockin') || key.includes('task')) return true;
      // 清空测试数据
      if (key.includes('test')) return true;
      
      return false;
    });
    
    console.log('准备清空的键:', keysToClear);
    
    // 清空选中的键
    keysToClear.forEach(key => {
      try {
        wx.removeStorageSync(key);
        console.log(`已清空本地存储: ${key}`);
      } catch (error) {
        console.error(`清空本地存储 ${key} 失败:`, error);
      }
    });
    
    // 2. 清空云数据库中的测试记录（如果有权限）
    try {
      const db = wx.cloud.database();
      
      // 清空排敏记录
      db.collection('sensitivity_records').where({}).remove();
      console.log('已清空云数据库中的排敏记录');
      
      // 清空宝宝信息
      db.collection('baby_info').where({}).remove();
      console.log('已清空云数据库中的宝宝信息');
      
      // 清空任务记录
      db.collection('tasks').where({}).remove();
      console.log('已清空云数据库中的任务记录');
      
      // 清空打卡记录
      db.collection('clockin_records').where({}).remove();
      console.log('已清空云数据库中的打卡记录');
    } catch (dbError) {
      console.warn('清空云数据库失败（可能是权限问题）:', dbError);
    }
    
    console.log('所有测试数据清空完成！');
    wx.showToast({
      title: '数据清空完成',
      icon: 'success',
      duration: 2000
    });
    
    return {
      success: true,
      message: '所有测试数据已清空',
      clearedKeys: keysToClear
    };
  } catch (error) {
    console.error('清空测试数据失败:', error);
    wx.showToast({
      title: '数据清空失败',
      icon: 'none',
      duration: 2000
    });
    
    return {
      success: false,
      message: '清空测试数据失败: ' + error.message
    };
  }
}

module.exports = clearAllTestData;

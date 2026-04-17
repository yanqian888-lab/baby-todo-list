/**
 * 清空本地存储数据工具
 * 用于开发和测试时重置应用状态
 */

/**
 * 清空所有本地存储数据
 */
function clearAllStorage() {
  try {
    // 列出所有需要清除的存储键
    const keysToRemove = [
      'userInfo',
      'token',
      'authInfo',
      'babyInfo',
      'sensitivity_records',
      'babyInfoPrompted',
      'mock_openid',
      'task_templates',
      'settings'
    ];
    
    // 清除每个键
    keysToRemove.forEach(key => {
      try {
        wx.removeStorageSync(key);
        console.log(`✅ 已清除: ${key}`);
      } catch (e) {
        console.warn(`⚠️ 清除失败: ${key}`, e);
      }
    });
    
    // 清除所有缓存数据
    wx.clearStorageSync();
    
    console.log('🧹 所有本地数据已清空');
    return true;
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    return false;
  }
}

/**
 * 仅清除宝宝相关信息（用于测试宝宝信息填写流程）
 */
function clearBabyInfo() {
  try {
    wx.removeStorageSync('babyInfo');
    wx.removeStorageSync('babyInfoPrompted');
    wx.removeStorageSync('sensitivity_records');
    console.log('🧹 宝宝相关信息已清空');
    return true;
  } catch (error) {
    console.error('❌ 清空宝宝信息失败:', error);
    return false;
  }
}

/**
 * 仅清除用户信息（用于测试登录流程）
 */
function clearUserInfo() {
  try {
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('token');
    wx.removeStorageSync('authInfo');
    console.log('🧹 用户信息已清空');
    return true;
  } catch (error) {
    console.error('❌ 清空用户信息失败:', error);
    return false;
  }
}

module.exports = {
  clearAllStorage,
  clearBabyInfo,
  clearUserInfo
};

/**
 * 通用辅助函数
 */

/**
 * 安全获取用户ID（兼容多种命名）
 * @param {Object} userInfo - 用户信息对象
 * @returns {string} 用户ID
 */
function getUserId(userInfo) {
  if (!userInfo) return '';
  return userInfo.openId || userInfo.openid || userInfo._id || '';
}

/**
 * 安全获取宝宝ID
 * @param {Object} babyInfo - 宝宝信息对象
 * @returns {string} 宝宝ID
 */
function getBabyId(babyInfo) {
  if (!babyInfo) return 'local-baby-id';
  return babyInfo._id || babyInfo.id || 'local-baby-id';
}

/**
 * 安全格式化日期
 * @param {any} date - 日期值
 * @returns {string} YYYY-MM-DD 格式或空字符串
 */
function safeDateFormat(date) {
  if (!date) return '';
  
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  // 使用本地时间获取年月日，避免时区问题
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取过敏状态文本
 * @param {number} status - 状态值 (-1, 0, 1, 2)
 * @returns {string} 状态文本
 */
function getAllergyStatusText(status) {
  const map = {
    '-1': '未记录',
    0: '不过敏',
    1: '轻微过敏',
    2: '重度过敏'
  };
  return map[status] || '未记录';
}

/**
 * 获取喜好状态文本
 * @param {number} status - 状态值 (-1, 0, 1, 2)
 * @returns {string} 状态文本
 */
function getLikeStatusText(status) {
  const map = {
    '-1': '未记录',
    0: '不喜欢',
    1: '一般',
    2: '喜欢'
  };
  return map[status] || '未记录';
}

/**
 * 安全获取对象属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值或默认值
 */
function get(obj, path, defaultValue) {
  if (!obj || !path) return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null || typeof result !== 'object') return defaultValue;
    result = result[key];
  }
  return result !== undefined ? result : defaultValue;
}

module.exports = {
  getUserId,
  getBabyId,
  safeDateFormat,
  getAllergyStatusText,
  getLikeStatusText,
  get
};

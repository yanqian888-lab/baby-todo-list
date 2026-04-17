/**
 * 日期工具函数库
 * 提供统一的日期处理方法
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    console.warn('Invalid date:', date);
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取当前日期的字符串表示（YYYY-MM-DD）
 * @returns {string} 当前日期
 */
function getTodayString() {
  return formatDate(new Date());
}

/**
 * 格式化时间为 HH:mm
 * @param {Date|string|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 格式化日期时间为完整字符串
 * @param {Date|string|number} date - 日期对象或时间戳
 * @returns {string} YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${formatDate(d)} ${formatTime(d)}:${d.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * 获取星期文本
 * @param {number} dayIndex - 星期索引 (0-6, 0=周日)
 * @returns {string} 星期文本
 */
function getWeekdayText(dayIndex) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  if (dayIndex < 0 || dayIndex > 6) return '';
  return weekdays[dayIndex];
}

/**
 * 获取问候语
 * @param {Date} [date] - 日期对象，默认为当前时间
 * @returns {string} 问候语
 */
function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) {
    return '早上好';
  } else if (hour >= 12 && hour < 14) {
    return '中午好';
  } else if (hour >= 14 && hour < 18) {
    return '下午好';
  } else {
    return '晚上好';
  }
}

/**
 * 检查两个日期是否为同一天
 * @param {Date|string|number} date1 
 * @param {Date|string|number} date2 
 * @returns {boolean}
 */
function isSameDay(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  return formatDate(d1) === formatDate(d2);
}

/**
 * 获取日期差异天数
 * @param {Date|string|number} date1 
 * @param {Date|string|number} date2 
 * @returns {number} 天数差异（正数表示date1在date2之后）
 */
function getDaysDiff(date1, date2) {
  const d1 = new Date(formatDate(date1));
  const d2 = new Date(formatDate(date2));
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  formatDate,
  getTodayString,
  formatTime,
  formatDateTime,
  getWeekdayText,
  getGreeting,
  isSameDay,
  getDaysDiff
};

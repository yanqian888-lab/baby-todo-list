/**
 * 任务相关工具函数库
 * 处理任务频率、日期计算等逻辑
 */

const dateUtils = require('./dateUtils');

// 星期数组（页面显示顺序：周一到周日）
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 处理选择的日期数据，标准化为数字数组
 * @param {Array|string|number|object} days - 各种格式的天数数据
 * @param {string} type - 处理类型，'week'表示处理星期几(0-6)，'month'表示处理月份日期(1-31)
 * @returns {Array<number>} 标准化后的数字数组
 */
function processSelectedDays(days, type = 'week') {
  // 安全检查
  if (days === undefined || days === null || days === '') {
    return [];
  }

  let dayArray = [];

  // 处理数组类型
  if (Array.isArray(days)) {
    dayArray = days;
  }
  // 处理字符串类型
  else if (typeof days === 'string' && days.trim()) {
    // 尝试解析JSON字符串
    if ((days.startsWith('[') && days.endsWith(']')) || (days.startsWith('{') && days.endsWith('}'))) {
      try {
        const parsed = JSON.parse(days);
        if (Array.isArray(parsed)) {
          dayArray = parsed;
        } else {
          dayArray = days.replace(/[^0-9,]/g, '').split(',').filter(day => day.trim() !== '');
        }
      } catch (e) {
        dayArray = days.replace(/[^0-9,]/g, '').split(',').filter(day => day.trim() !== '');
      }
    } else {
      // 普通字符串按逗号分割
      dayArray = days.replace(/[^0-9,]/g, '').split(',').filter(day => day.trim() !== '');
    }
  }
  // 处理数字类型
  else if (typeof days === 'number') {
    dayArray = [days];
  }
  // 处理对象类型
  else if (typeof days === 'object') {
    try {
      dayArray = Object.values(days).flat();
    } catch (e) {
      console.error('对象转换失败:', e);
      return [];
    }
  }

  // 根据类型设置不同的过滤范围
  const min = type === 'month' ? 1 : 0;
  const max = type === 'month' ? 31 : 6;

  // 转换为数字并过滤无效值
  const validDays = [];
  const seen = new Set();

  for (const day of dayArray) {
    const num = Number(day);
    if (!isNaN(num) && Number.isInteger(num) && num >= min && num <= max && !seen.has(num)) {
      validDays.push(num);
      seen.add(num);
    }
  }

  // 排序
  validDays.sort((a, b) => a - b);

  return validDays;
}

/**
 * 转换星期数字为中文文本
 * @param {Array|string|number|object} days - 星期数字数组、逗号分隔字符串等
 * @returns {string} 格式化后的星期文本，如"每周 周一、周三"
 */
function getWeekdayText(days) {
  const validDays = processSelectedDays(days, 'week');

  if (validDays.length === 0) {
    return '每周';
  }

  // 转换为中文星期文本
  const weekdayTexts = validDays.map(day => {
    // day 是 0-6，对应周日到周六
    // 但 WEEK_DAYS 数组是 周一到周日，需要映射
    const index = day === 0 ? 6 : day - 1;
    return WEEK_DAYS[index] || `未知(${day})`;
  });

  return `每周 ${weekdayTexts.join('、')}`;
}

/**
 * 转换月份日期数字为中文文本
 * @param {Array|string|number|object} days - 月份日期数组或字符串
 * @returns {string} 格式化后的日期文本，如"每月 1日、15日"
 */
function getMonthdayText(days) {
  const validDays = processSelectedDays(days, 'month');

  if (validDays.length === 0) {
    return '每月';
  }

  const dayTexts = validDays.map(day => `${day}日`);
  return `每月 ${dayTexts.join('、')}`;
}

/**
 * 检查任务今天是否需要执行
 * @param {Object} task - 任务对象
 * @param {Date} [today] - 指定日期，默认为今天
 * @returns {boolean} 是否需要执行
 */
function isTaskDueToday(task, today = new Date()) {
  if (!task || task.status === 'deleted') {
    return false;
  }

  const frequency = task.frequency || 'none';

  switch (frequency) {
    case 'daily':
      return true;

    case 'weekly': {
      const selectedDays = processSelectedDays(task.selectedDays, 'week');
      const todayDay = today.getDay(); // 0-6, 0=周日
      return selectedDays.includes(todayDay);
    }

    case 'monthly': {
      const selectedMonthDays = processSelectedDays(task.selectedMonthDays, 'month');
      const todayDate = today.getDate();
      return selectedMonthDays.includes(todayDate);
    }

    case 'none':
    default:
      // 一次性任务，检查是否已完成
      return task.status === 'pending';
  }
}

/**
 * 转换页面星期索引到JS标准（0=周日, 1=周一...6=周六）
 * @param {number} pageIndex - 页面索引（0=周一, 6=周日）
 * @returns {number} JS标准索引
 */
function pageIndexToJsIndex(pageIndex) {
  return pageIndex === 6 ? 0 : pageIndex + 1;
}

/**
 * 转换JS标准星期索引到页面索引
 * @param {number} jsIndex - JS标准索引（0=周日, 1=周一...6=周六）
 * @returns {number} 页面索引
 */
function jsIndexToPageIndex(jsIndex) {
  return jsIndex === 0 ? 6 : jsIndex - 1;
}

/**
 * 格式化任务显示数据
 * @param {Object} task - 原始任务对象
 * @returns {Object} 格式化后的任务对象
 */
function formatTaskForDisplay(task) {
  if (!task) return null;

  const processedDays = processSelectedDays(task.selectedDays, 'week');
  const processedMonthDays = processSelectedDays(task.selectedMonthDays, 'month');

  return {
    id: task._id || task.id,
    name: task.title || task.name || '未命名任务',
    subtitle: task.description || task.subtitle || '',
    time: task.reminderTime ? dateUtils.formatTime(task.reminderTime) : '',
    type: task.frequency || 'none',
    category: task.category,
    priority: task.priority,
    frequency: task.frequency || 'none',
    selectedDays: processedDays,
    selectedMonthDays: processedMonthDays,
    weekdayText: task.frequency === 'weekly' ? getWeekdayText(processedDays) : '',
    monthdayText: task.frequency === 'monthly' ? getMonthdayText(processedMonthDays) : '',
    status: task.status || 'pending'
  };
}

module.exports = {
  WEEK_DAYS,
  processSelectedDays,
  getWeekdayText,
  getMonthdayText,
  isTaskDueToday,
  pageIndexToJsIndex,
  jsIndexToPageIndex,
  formatTaskForDisplay
};

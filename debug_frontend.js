// 前端调试脚本，用于诊断已完成任务和连续打卡天数问题

// 模拟小程序环境
const mockApp = {
  globalData: {}
};

const mockPage = {
  data: {
    todayTasks: [],
    completedTasks: [],
    userStats: {
      streakDays: 0,
      totalDays: 0,
      lastCheckin: '',
      today: { checked: false, time: '' }
    },
    todayStats: {
      total: 0,
      completed: 0,
      percentage: 0
    }
  },
  
  setData: function(data) {
    console.log('setData:', data);
    Object.assign(this.data, data);
  },
  
  // 模拟云函数调用
  callCloudFunction: async function(name, data) {
    console.log(`调用云函数 ${name}，参数:`, JSON.stringify(data, null, 2));
    
    // 模拟getTasks云函数返回结果
    if (name === 'getTasks') {
      return {
        result: {
          success: true,
          tasks: [], // 这里模拟返回空数组
          total: 0,
          hasMore: false
        }
      };
    }
    
    // 模拟getUserStatistics云函数返回结果
    if (name === 'getUserStatistics') {
      return {
        result: {
          success: true,
          data: {
            streakDays: 0,
            totalDays: 0,
            lastCheckin: '',
            today: {
              checked: false,
              time: ''
            }
          }
        }
      };
    }
    
    return {
      result: {
        success: false,
        error: '未模拟的云函数'
      }
    };
  },
  
  // 格式化时间
  _formatTime: function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },
  
  // 格式化完成时间
  _formatCompletedTime: function(timeStr) {
    if (!timeStr) return '未知时间';
    return timeStr;
  },
  
  // 处理选中的日期
  _processSelectedDays: function(days, type = 'week') {
    if (!days) return [];
    try {
      const daysArray = JSON.parse(days);
      return daysArray.map(day => parseInt(day));
    } catch (error) {
      console.error('解析selectedDays失败:', error);
      return [];
    }
  },
  
  // 获取星期文本
  getWeekdayText: function(days) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days.map(day => weekdays[day]).join('、');
  },
  
  // 获取月日期文本
  getMonthdayText: function(days) {
    return days.join('、');
  },
  
  // 计算统计数据
  calculateStats: function() {
    console.log('=== 计算统计数据 ===');
    console.log('todayTasks.length:', this.data.todayTasks.length);
    console.log('completedTasks.length:', this.data.completedTasks.length);
    
    const total = this.data.todayTasks.length + this.data.completedTasks.length;
    const completed = this.data.completedTasks.length + this.data.todayTasks.filter(task => task.todayCheckins >= 1).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    console.log('计算结果 - total:', total, 'completed:', completed, 'percentage:', percentage);
    
    this.setData({
      todayStats: {
        total: total,
        completed: completed,
        percentage: percentage
      }
    });
  },
  
  // 获取已完成任务
  async getCompletedTasks(skipLoading = false) {
    console.log('\n=== 获取已完成任务 ===');
    
    try {
      // 模拟调用getTasks云函数
      const result = await this.callCloudFunction('getTasks', {
        status: 'completed'
      });
      
      console.log('getTasks返回结果:', JSON.stringify(result, null, 2));
      
      if (result.result.success) {
        console.log('云函数返回的tasks数量:', result.result.tasks.length);
        console.log('云函数返回的tasks:', JSON.stringify(result.result.tasks, null, 2));
        
        // 处理已完成任务数据
        const completedTasks = result.result.tasks.map(task => {
          // 处理selectedDays数据
          const processedDays = this._processSelectedDays(task.selectedDays);
          // 优先使用云函数处理后的processedMonthDays字段
          const monthDaysToUse = task.processedMonthDays || task.selectedMonthDays;
          // 处理月任务日期时传入type='month'参数，以支持1-31范围的日期
          const processedMonthDays = task.frequency === 'monthly' ? this._processSelectedDays(monthDaysToUse, 'month') : [];
          
          // 预先计算星期文本和月文本
          const weekdayText = task.frequency === 'weekly' ? this.getWeekdayText(processedDays) : '';
          const monthdayText = task.frequency === 'monthly' ? this.getMonthdayText(processedMonthDays) : '';
          
          // 获取可用于排序的原始时间戳
          let sortTime = 0;
          
          // 优先使用云函数返回的completedDate字段（数据库中的时间戳）
          if (task.completedDate) {
            sortTime = new Date(task.completedDate).getTime();
          } 
          // 对于没有completedDate的任务，尝试使用completedTime字段
          else if (task.completedTime) {
            // 创建一个日期对象
            const date = new Date();
            
            // 如果是昨天的任务，调整日期
            if (task.completedTime.includes('昨天')) {
              date.setDate(date.getDate() - 1);
            } else if (task.completedTime.includes('今天')) {
              // 今天的任务，保持当前日期
            } else {
              // 其他情况，尝试直接解析为日期
              const parsedDate = new Date(task.completedTime);
              if (!isNaN(parsedDate.getTime())) {
                sortTime = parsedDate.getTime();
              } else {
                // 提取时间部分
                const timeMatch = task.completedTime.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                  date.setHours(parseInt(timeMatch[1]));
                  date.setMinutes(parseInt(timeMatch[2]));
                  date.setSeconds(parseInt(timeMatch[3]));
                  sortTime = date.getTime();
                }
              }
            }
          }
          
          // 每日任务默认只能完成1次
          const cycleTimes = 1;
          const todayCheckins = 1; // 已完成任务肯定是完成了所有打卡次数
          
          return {
            id: task._id,
            name: task.title,
            subtitle: task.description || '已完成任务',
            time: task.reminderTime ? this._formatTime(task.reminderTime) : '',
            completedTime: task.completedTime ? this._formatCompletedTime(task.completedTime) : '未知时间',
            category: task.category,
            // 添加循环任务相关字段
            frequency: task.frequency || 'none',
            cycleTimes: 1,
            todayCheckins: todayCheckins,
            selectedDays: processedDays,
            selectedMonthDays: processedMonthDays,
            // 预先计算好的星期文本和月文本，供WXML直接使用
            weekdayText: weekdayText,
            monthdayText: monthdayText,
            // 用于排序的时间戳
            sortTime: sortTime
          };
        });
        
        console.log('处理后的completedTasks数量:', completedTasks.length);
        
        // 按照完成时间排序，由近到远排列
        completedTasks.sort((a, b) => {
          // 降序排列（最新的在前）
          return b.sortTime - a.sortTime;
        });
        
        this.setData({
          completedTasks: completedTasks
        });
        
        // 计算统计数据
        this.calculateStats();
      }
    } catch (error) {
      console.error('获取已完成任务失败:', error);
      // 出错时显示空数组
      this.setData({
        completedTasks: []
      });
      // 重新计算统计数据
      this.calculateStats();
    }
  },
  
  // 获取用户统计信息
  async getUserStatistics() {
    console.log('\n=== 获取用户统计信息 ===');
    
    try {
      // 模拟调用getUserStatistics云函数
      const result = await this.callCloudFunction('getUserStatistics', {});
      
      console.log('getUserStatistics返回结果:', JSON.stringify(result, null, 2));
      
      if (result.result.success) {
        this.setData({
          userStats: result.result.data
        });
      }
    } catch (error) {
      console.error('获取用户统计信息失败:', error);
    }
  },
  
  // 初始化数据
  async initData() {
    console.log('\n=== 初始化数据 ===');
    
    // 获取已完成任务
    await this.getCompletedTasks();
    
    // 获取用户统计信息
    await this.getUserStatistics();
    
    console.log('\n初始化完成后的数据:');
    console.log('todayTasks.length:', this.data.todayTasks.length);
    console.log('completedTasks.length:', this.data.completedTasks.length);
    console.log('userStats:', JSON.stringify(this.data.userStats, null, 2));
    console.log('todayStats:', JSON.stringify(this.data.todayStats, null, 2));
  }
};

// 运行调试脚本
async function runDebug() {
  console.log('开始运行前端调试脚本...');
  
  // 初始化数据
  await mockPage.initData();
  
  console.log('\n调试完成!');
}

// 执行调试
runDebug();
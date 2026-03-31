// 云函数：获取用户任务列表
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { status = 'pending', category, page = 1, size = 20, includeCompleted = false, action } = event
  
  // 测试功能：检查数据库中的数据
  if (action === 'test') {
    console.log('🔍 开始测试数据库数据...');
    
    // 测试1: 检查已完成任务
    const completedTasks = await db.collection('tasks').where({ status: 'completed' }).get();
    console.log(`✅ 已完成任务数量: ${completedTasks.data.length}`);
    
    // 测试2: 检查打卡记录
    const checkins = await db.collection('task_completions').get();
    console.log(`✅ 打卡记录数量: ${checkins.data.length}`);
    
    return {
      success: true,
      completedTasks: completedTasks.data,
      checkins: checkins.data
    };
  }
  
  try {
    console.log('🔍 getTasks云函数调用开始');
    console.log('🔍 当前用户openid:', openid);
    console.log('🔍 事件参数:', JSON.stringify(event, null, 2));
    
    // 构建查询条件
    const query = {
      _openid: openid, // 使用微信云开发自动添加的_openid字段
      isTemplate: false
    }
    console.log('🔍 查询条件:', JSON.stringify(query, null, 2));
    
    // 根据状态过滤
    if (status) {
      if (status === 'pending' && includeCompleted === true) {
        // 当需要同时获取待完成和已完成任务时，只排除已删除的任务
        query.status = _.neq('deleted');
      } else if (status === 'deleted') {
        // 已删除任务：只获取已删除的任务
        query.status = status;
      } else {
        // 其他状态：同时满足指定状态且未删除
        query.status = _.and(
          _.eq(status),
          _.neq('deleted')
        );
      }
    } else {
      // 默认情况下，排除已删除的任务
      query.status = _.neq('deleted');
    }
    
    // 根据分类过滤
    if (category) {
      query.category = category
    }
    
    // 计算分页偏移量
    const skip = (page - 1) * size
    
    // 获取任务总数
    console.log('🔍 开始查询任务总数...');
    const totalResult = await db.collection('tasks').where(query).count()
    console.log('🔍 查询到的原始任务总数:', totalResult.total);
    
    // 查询任务列表
    console.log('🔍 开始查询任务列表...');
    const tasksResult = await db.collection('tasks')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(size)
      .get()
    
    console.log('🔍 查询到的原始任务列表数量:', tasksResult.data.length);
    console.log('🔍 查询到的原始任务详情:', JSON.stringify(tasksResult.data, null, 2));
    
    let tasks = tasksResult.data;
    
    // 如果是已完成任务，直接返回所有已完成任务，不进行频率过滤
    if (status === 'completed') {
      console.log('直接返回已完成任务，不进行频率过滤:', tasks.length);
      return {
        success: true,
        total: totalResult.total,
        tasks: tasks,
        page,
        size
      };
    }
    
    // 处理循环任务的逻辑
    // 过滤出今天需要执行的任务
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayDayOfWeek = now.getDay(); // 0-6，0是周日
    const todayDateOfMonth = now.getDate(); // 1-31
    
    // 输出原始任务数据，用于调试
    console.log('📥 从数据库获取的原始任务数量:', tasks.length);
    tasks.forEach(task => {
      console.log(`📋 原始任务: ID=${task._id}, 标题=${task.title}, 状态=${task.status}, 频率=${task.frequency}, selectedDays=${JSON.stringify(task.selectedDays)}`);
    });
    
    // 计算任务下一次打卡日期并进行排序
    console.log('🔍 开始处理任务...');
    
    // 处理每个任务，计算下一次打卡日期
    const processedTasks = tasks.map(task => {
      // 为任务添加下一次打卡日期
      let nextCheckInDate = new Date();
      
      // 根据任务类型计算下一次打卡日期
      if (task.frequency === 'none' || !task.frequency) {
        // 非循环任务使用创建日期作为打卡日期
        nextCheckInDate = new Date(task.createTime || Date.now());
      } else if (task.frequency === 'daily') {
        // 每日任务使用今天日期
        nextCheckInDate = new Date(today);
      } else if (task.frequency === 'weekly' || task.frequency === 'monthly') {
        // 循环任务暂时使用今天日期，过滤逻辑会在后面处理
        nextCheckInDate = new Date(today);
      }
      
      return {
        ...task,
        nextCheckInDate
      };
    });
    
    // 过滤出今天需要执行的任务或已完成任务
    const filteredTasks = processedTasks.filter(task => {
      // 先检查任务状态是否符合要求
      console.log(`🔍 处理任务: ${task.title}, ID=${task._id}, 状态=${task.status}`);
      
      // 如果是已完成任务，不需要再过滤日期，直接返回true
      if (event.status === 'completed' || task.status === 'completed') {
        console.log(`✅ 已完成任务，直接返回true`);
        return true;
      }
      
      // 如果不是循环任务
      if (task.frequency === 'none' || !task.frequency) {
        console.log(`📅 非循环任务，创建日期: ${task.createTime}, 今天: ${today.toISOString()}`);
        // 移除日期过滤，所有非循环任务都应显示
        console.log(`✅ 非循环任务直接显示`);
        return true;
      }
      
      // 每日循环任务
      if (task.frequency === 'daily') {
        console.log(`✅ 每日循环任务，直接返回true`);
        return true;
      }
      
      // 每周循环任务
      if (task.frequency === 'weekly') {
        try {
          // 输出详细调试信息
          console.log(`📅 今日星期(0-6): ${todayDayOfWeek}`);
          
          // 确保selectedDays是数组，处理各种可能的数据情况
          let selectedDaysArray = [];
          
          // 增强的类型检查和转换逻辑
          if (Array.isArray(task.selectedDays)) {
            selectedDaysArray = task.selectedDays;
            console.log(`📊 selectedDays已是数组格式: ${JSON.stringify(selectedDaysArray)}`);
          } else if (typeof task.selectedDays === 'object' && task.selectedDays !== null) {
            // 处理对象格式的selectedDays，提取所有为true的键
            selectedDaysArray = Object.keys(task.selectedDays).filter(day => task.selectedDays[day] === true);
            console.log(`📋 对象格式selectedDays转换为数组: ${JSON.stringify(selectedDaysArray)}`);
          } else if (task.selectedDays !== undefined && task.selectedDays !== null) {
            // 处理单个值
            selectedDaysArray = [task.selectedDays];
            console.log(`📋 单个值selectedDays转换为数组: ${JSON.stringify(selectedDaysArray)}`);
          } else {
            console.log(`⚠️ 任务${task.title}没有selectedDays字段或为空`);
          }
          
          // 确保所有元素都是字符串或数字类型
          selectedDaysArray = selectedDaysArray.filter(day => day !== undefined && day !== null);
          console.log(`📋 过滤后的selectedDays数组: ${JSON.stringify(selectedDaysArray)}`);
          
          // 增强的比较逻辑
          const todayDayStr = String(todayDayOfWeek);
          
          console.log(`🔍 开始匹配检查，今日星期: ${todayDayOfWeek} (${todayDayStr})`);
          const matchFound = selectedDaysArray.some((day, index) => {
            // 确保day是有效字符串或数字
            const dayStr = String(day).trim();
            const dayNum = parseInt(dayStr);
            const isNumberValid = !isNaN(dayNum);
            
            console.log(`🔢 检查索引${index}: 原始值=${day}, 字符串=${dayStr}, 数字=${dayNum}, 是否有效数字=${isNumberValid}`);
            
            // 双重匹配逻辑
            const stringMatch = dayStr === todayDayStr;
            const numberMatch = isNumberValid && dayNum === todayDayOfWeek;
            const match = stringMatch || numberMatch;
            
            if (match) {
              console.log(`✅ 匹配成功: ${dayStr} (${typeof day}) 匹配 ${todayDayStr}`);
            } else {
              console.log(`❌ 匹配失败: ${dayStr} (${typeof day}) 不匹配 ${todayDayStr}`);
            }
            
            return match;
          });
          
          console.log(`🎯 任务${task.title}最终匹配结果: ${matchFound}`);
          return matchFound;
        } catch (err) {
          console.error('❌ 处理每周任务时出错:', err, `任务ID: ${task._id}`);
          return false;
        }
      }
      
      // 每月循环任务
      if (task.frequency === 'monthly') {
        try {
          // 处理selectedMonthDays，支持数组、JSON字符串、对象等多种格式
          let processedMonthDays = [];
          const monthDaysData = task.selectedMonthDays;
          
          console.log(`📅 处理月任务 ${task.title} 的selectedMonthDays数据:`, monthDaysData);
          
          // 数据类型规范化处理 - 增强版
          if (Array.isArray(monthDaysData)) {
            // 数组格式直接使用
            processedMonthDays = monthDaysData.map(day => {
              // 确保每个元素都被正确解析为数字
              const numDay = Number(day);
              return isNaN(numDay) ? 0 : numDay;
            });
          } else if (typeof monthDaysData === 'string') {
            // 清理字符串并尝试多种解析方式
            const trimmedStr = monthDaysData.trim();
            if (trimmedStr) {
              // 尝试解析JSON字符串
              try {
                const parsed = JSON.parse(trimmedStr);
                if (Array.isArray(parsed)) {
                  processedMonthDays = parsed.map(day => {
                    const numDay = Number(day);
                    return isNaN(numDay) ? 0 : numDay;
                  });
                } else if (typeof parsed === 'object') {
                  // 对象格式，取键名作为日期
                  processedMonthDays = Object.keys(parsed).map(day => {
                    const numDay = Number(day);
                    return isNaN(numDay) ? 0 : numDay;
                  });
                }
              } catch (e) {
                console.log(`📝 非JSON字符串，尝试其他解析方式:`, e.message);
                // 支持多种分隔符: 逗号、空格、分号、顿号等
                const normalizedStr = trimmedStr.replace(/[,，;；\s+]/g, ',');
                processedMonthDays = normalizedStr.split(',')
                  .filter(day => day.trim() !== '') // 过滤空字符串
                  .map(day => {
                    const numDay = Number(day.trim());
                    return isNaN(numDay) ? 0 : numDay;
                  });
              }
            }
          } else if (typeof monthDaysData === 'object' && monthDaysData !== null) {
            // 对象格式，处理多种对象结构
            // 1. 处理键值对形式 {"1": true, "2": false}
            processedMonthDays = Object.keys(monthDaysData)
              .filter(key => monthDaysData[key] === true || monthDaysData[key] === 1)
              .map(key => {
                const numDay = Number(key);
                return isNaN(numDay) ? 0 : numDay;
              });
              
            // 如果通过键值对方式没有获取到数据，尝试直接使用所有键
            if (processedMonthDays.length === 0) {
              processedMonthDays = Object.keys(monthDaysData).map(key => {
                const numDay = Number(key);
                return isNaN(numDay) ? 0 : numDay;
              });
            }
          } else if (typeof monthDaysData === 'number') {
            // 单一数字的情况
            processedMonthDays = [monthDaysData];
          }
          
          // 过滤有效日期（1-31之间）并去重
          processedMonthDays = [...new Set(processedMonthDays)].filter(day => day >= 1 && day <= 31);
          console.log(`📅 任务 ${task.title} 处理后的有效日期列表:`, processedMonthDays);
          
          // 保存处理后的日期数据，方便前端使用
          task.processedMonthDays = processedMonthDays;
          
          // 检查当前日期是否在有效日期列表中
          const matches = processedMonthDays.includes(todayDateOfMonth);
          console.log(`📅 每月循环任务，日期: ${todayDateOfMonth}, 匹配: ${matches}`);
          return matches;
        } catch (error) {
          console.error(`❌ 处理月任务 ${task.title} 的selectedMonthDays时出错:`, error);
          return false;
        }
      }
      
      console.log(`❌ 不匹配任何条件，返回false`);
      return false;
    });
    
    // 输出过滤前的任务列表信息，用于调试
    console.log('过滤后的任务数量:', filteredTasks.length);
    console.log('任务状态过滤参数:', {status, includeCompleted});
    filteredTasks.forEach(task => {
      console.log(`任务ID: ${task._id}, 标题: ${task.title}, 状态: ${task.status}, 频率: ${task.frequency}, selectedDays: ${JSON.stringify(task.selectedDays)}`);
    });
    
    // 增强的排序逻辑：优先按任务类型排序，然后按创建时间排序
    // 任务类型优先级：每日 > 每周 > 每月 > 非循环
    filteredTasks.sort((a, b) => {
      // 任务类型权重映射
      const frequencyWeights = {
        'daily': 4,
        'weekly': 3,
        'monthly': 2,
        'none': 1,
        null: 1 // 默认非循环任务
      };
      
      // 获取任务类型权重
      const weightA = frequencyWeights[a.frequency] || frequencyWeights.none;
      const weightB = frequencyWeights[b.frequency] || frequencyWeights.none;
      
      // 首先按任务类型权重降序排序（权重越高越优先）
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      
      // 同一类型内，按创建时间降序排序（新创建的排在前面）
      const createTimeA = new Date(a.createTime || Date.now()).getTime();
      const createTimeB = new Date(b.createTime || Date.now()).getTime();
      return createTimeB - createTimeA;
    });
    
    console.log('排序后的任务列表:', filteredTasks.map(task => `${task.title} (${task.nextCheckInDate})`));
    
    // 直接使用过滤后的任务，不再进行额外过滤
    // 因为在构建查询条件时已经考虑了status和includeCompleted的组合
    let finalTasks = filteredTasks;
    
    // 输出最终返回的任务数量
    console.log('最终返回的任务数量:', finalTasks.length);
    
    console.log('🔍 getTasks云函数调用结束，返回任务数量:', finalTasks.length);
    
    return {
      success: true,
      total: finalTasks.length, // 确保返回最终过滤后的任务总数，而不是原始任务总数
      tasks: finalTasks,
      page,
      size
    }
    
    
  } catch (error) {
    console.error('❌ 获取任务失败:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}
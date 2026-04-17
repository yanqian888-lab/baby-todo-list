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
    const { familyId } = event;
    const query = {
      isTemplate: false
    };
    
    // 优先按家庭查询，否则按个人_openid查询
    if (familyId) {
      query.familyId = familyId;
      console.log('👨‍👩‍👧‍👦 按家庭查询任务:', familyId);
    } else {
      query._openid = openid;
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
    // 首页场景需要返回所有任务（包括未来日期的循环任务），由前端判断显示在今日任务还是待完成
    const isHomeQuery = (status === 'pending' && includeCompleted === true);
    
    let filteredTasks = tasks;
    
    if (isHomeQuery) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // 输出原始任务数据，用于调试
      console.log('📥 从数据库获取的原始任务数量:', tasks.length);
      tasks.forEach(task => {
        console.log(`📋 原始任务: ID=${task._id}, 标题=${task.title}, 状态=${task.status}, 频率=${task.frequency}, dueDate=${task.dueDate || 'null'}, createTime=${task.createTime || 'null'}`);
      });
      
      // 为任务添加 nextCheckInDate，并预处理月任务日期供前端使用
      filteredTasks = tasks.map(task => {
        let nextCheckInDate = new Date();
        if (task.frequency === 'none' || !task.frequency) {
          nextCheckInDate = new Date(task.dueDate || task.createTime || Date.now());
        } else if (task.frequency === 'daily') {
          nextCheckInDate = new Date(today);
        } else {
          nextCheckInDate = new Date(today);
        }
        
        // 对月任务预处理 selectedMonthDays（与前端逻辑保持一致）
        if (task.frequency === 'monthly' && task.selectedMonthDays) {
          let processedMonthDays = [];
          const monthDaysData = task.selectedMonthDays;
          if (Array.isArray(monthDaysData)) {
            processedMonthDays = monthDaysData.map(day => isNaN(Number(day)) ? 0 : Number(day));
          } else if (typeof monthDaysData === 'string') {
            const trimmedStr = monthDaysData.trim();
            if (trimmedStr) {
              try {
                const parsed = JSON.parse(trimmedStr);
                if (Array.isArray(parsed)) {
                  processedMonthDays = parsed.map(day => isNaN(Number(day)) ? 0 : Number(day));
                } else if (typeof parsed === 'object') {
                  processedMonthDays = Object.keys(parsed).map(day => isNaN(Number(day)) ? 0 : Number(day));
                }
              } catch (e) {
                const normalizedStr = trimmedStr.replace(/[,，;；\s+]/g, ',');
                processedMonthDays = normalizedStr.split(',')
                  .filter(day => day.trim() !== '')
                  .map(day => isNaN(Number(day.trim())) ? 0 : Number(day.trim()));
              }
            }
          } else if (typeof monthDaysData === 'object' && monthDaysData !== null) {
            processedMonthDays = Object.keys(monthDaysData)
              .filter(key => monthDaysData[key] === true || monthDaysData[key] === 1)
              .map(key => isNaN(Number(key)) ? 0 : Number(key));
            if (processedMonthDays.length === 0) {
              processedMonthDays = Object.keys(monthDaysData).map(key => isNaN(Number(key)) ? 0 : Number(key));
            }
          } else if (typeof monthDaysData === 'number') {
            processedMonthDays = [monthDaysData];
          }
          task.processedMonthDays = [...new Set(processedMonthDays)].filter(day => day >= 1 && day <= 31);
        }
        
        return { ...task, nextCheckInDate };
      });
    }
    
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
      total: finalTasks.length, // 当前页过滤后的任务总数
      totalTasksCount: totalResult.total, // 用户创建过的任务总数（用于首页空状态判断）
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
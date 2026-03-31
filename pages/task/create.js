// pages/task/create.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    mode: 'create', // create或edit模式
    taskId: '',
    title: '',
    description: '',
    frequency: 'none', // none, daily, weekly, monthly
    category: 'care', // 任务分类：care, feeding, health, development
    categories: [
      { id: 'care', name: '日常护理', icon: '👶' },
      { id: 'feeding', name: '喂养', icon: '🍼' },
      { id: 'health', name: '健康', icon: '💊' },
      { id: 'development', name: '发育', icon: '📚' },
      { id: 'hygiene', name: '清洁', icon: '🧴' },
      { id: 'activity', name: '运动', icon: '🏃' },
      { id: 'study', name: '学习', icon: '📖' }
    ],
    templateGroups: [
      { id: 'pregnant', name: '孕妈妈', icon: '🤰' },
      { id: 'new_mom', name: '新手妈妈', icon: '👩‍🍼' },
      { id: 'baby', name: '宝宝', icon: '👶' }
    ],
    ageRanges: [
      { id: '0-1', name: '0~1月' },
      { id: '2-6', name: '2~6个月' },
      { id: '7-24', name: '7~24个月' }
    ],
    selectedGroup: 'pregnant', // 当前选中的模板组
    selectedAgeRange: '0-1', // 当前选中的年龄段
    groupedTemplates: {}, // 分组后的模板数据
    frequencies: [
      { id: 'none', name: '一次' },
      { id: 'daily', name: '每天' },
      { id: 'weekly', name: '每周' },
      { id: 'monthly', name: '每月' }
    ],
selectedDays: {}, // 用于每周模式，使用对象存储选中状态，键为星期索引字符串，值为布尔值
    computedSelectedDays: [], // 用于WXML绑定的计算数组，每个元素表示对应索引的星期是否选中
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    
    selectedMonthDays: {}, // 用于每月模式，使用对象存储选中状态，键为日期字符串，值为布尔值
    computedSelectedMonthDays: [], // 用于WXML绑定的计算数组，每个元素表示对应索引的日期是否选中
    monthDays: Array.from({length: 31}, (_, i) => String(i + 1)), // 1-31天

    showTemplates: true,
    templates: []
  },
  
  /**
   * 检查指定星期是否被选中
   * @param {string|number} dayIndex - 星期索引
   * @returns {boolean} 是否被选中
   */
  isDaySelected: function(dayIndex) {
    try {
      // 确保dayIndex转换为字符串类型
      const strDayIndex = String(dayIndex);
      // 检查selectedDays对象中该星期是否为true
      return this.data.selectedDays[strDayIndex] === true;
    } catch (error) {
      console.error('isDaySelected方法出错:', error);
      return false;
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 存储模板ID，将在模板加载后使用
    this.templateId = options.templateId;
    
    // 设置默认日期为今天
    const today = new Date();
    const date = today.getDate();
    this.setData({ 
      selectedDate: date.toString(),
      selectedDays: {}, // 初始不选择任何天数
      computedSelectedDays: [], // 初始不选择任何天数
      // 确保没有调试信息属性
      debugInfo: null,
      tempDebugText: null
    });
    
    // 检查是否是编辑模式
    if (options.mode && options.mode === 'edit' && options.id) {
      this.setData({
        mode: 'edit',
        taskId: options.id
      });
      this.loadTaskData();
    } else {
      // 加载任务模板数据（仅在创建模式下）
      this.loadTaskTemplates();
    }
    
    // 确保界面中没有调试信息
    this.clearDebugInfo();
  },
  
  /**
   * 加载任务模板
   * 优先使用模拟数据，确保模板能够正常显示
   */
  loadTaskTemplates: function() {
    try {
      // 直接调用setMockData设置模拟数据，确保模板立即显示
      this.setMockData();
      
      // 清除任何可能的调试信息
      this.clearDebugInfo();
      
      // 简洁的日志记录
      console.log('模板加载完成');
      
      // 注意：暂时注释掉云函数调用，专注于确保模拟数据正确显示
      /*
      // 尝试调用云函数获取模板数据
      const result = await wx.cloud.callFunction({
        name: 'getTaskTemplates',
        data: {}
      });
      
      console.log('云函数返回结果:', result);
      
      // 检查结果
      if (result.result && Array.isArray(result.result.templates)) {
        const templates = result.result.templates;
        console.log('获取到的模板数量:', templates.length);
        
        // 为每个模板添加图标
        const templatesWithIcons = templates.map(template => ({
          ...template,
          icon: template.icon || this.getTemplateIcon(template.category)
        }));
        
        // 对模板进行分组并更新数据
        // 这里可以根据实际需要更新数据
      }
      */
    } catch (error) {
      console.error('加载模板数据失败:', error);
      // 如果出错，仍然使用模拟数据
    }
  },
  
  /**
   * 设置模拟数据
   */
  setMockData: function() {
    console.log('设置模拟数据，确保字段名与WXML中使用的完全一致');
    
    // 精简模拟数据示例，确保字段匹配
    const mockPregnantTemplates = [
      {
        id: 'preg_001',
        title: '产前检查',
        description: '定期进行产前检查，确保母婴健康',
        icon: '🏥',
        category: 'health',
        group: 'pregnant',
        priority: 'high'
      },
      {
        id: 'preg_002',
        title: '补充叶酸',
        description: '每日补充叶酸，预防胎儿神经管畸形',
        icon: '💊',
        category: 'health',
        group: 'pregnant',
        priority: 'high'
      },
      {
        id: 'preg_003',
        title: '适当运动',
        description: '进行散步等适当运动，有助于顺产',
        icon: '🏃',
        category: 'activity',
        group: 'pregnant',
        priority: 'medium'
      }
    ];
    
    const mockNewMomTemplates = [
      {
        id: 'newmom_001',
        title: '哺乳准备',
        description: '学习正确的哺乳姿势和技巧',
        icon: '🍼',
        category: 'feeding',
        group: 'new_mom',
        priority: 'high'
      },
      {
        id: 'newmom_002',
        title: '产后恢复',
        description: '进行产后身体恢复训练',
        icon: '🏥',
        category: 'health',
        group: 'new_mom',
        priority: 'medium'
      }
    ];
    
    const mockBabyTemplates_0_1 = [
      {
        id: 'baby_001',
        title: '新生儿喂养',
        description: '按需喂养，确保宝宝营养充足',
        icon: '🍼',
        category: 'feeding',
        group: 'baby',
        ageRange: '0-1',
        priority: 'high'
      },
      {
        id: 'baby_002',
        title: '脐部护理',
        description: '清洁消毒脐部，防止感染',
        icon: '🧴',
        category: 'hygiene',
        group: 'baby',
        ageRange: '0-1',
        priority: 'high'
      }
    ];
    
    const mockBabyTemplates_2_6 = [
      {
        id: 'baby_003',
        title: '辅食添加',
        description: '开始添加米粉等辅食',
        icon: '🥣',
        category: 'feeding',
        group: 'baby',
        ageRange: '2-6',
        priority: 'medium'
      },
      {
        id: 'baby_004',
        title: '抬头训练',
        description: '帮助宝宝练习抬头，增强颈部力量',
        icon: '👶',
        category: 'development',
        group: 'baby',
        ageRange: '2-6',
        priority: 'medium'
      }
    ];
    
    const mockBabyTemplates_7_24 = [
      {
        id: 'baby_005',
        title: '自主进食训练',
        description: '培养宝宝自己吃饭的能力',
        icon: '🍽️',
        category: 'feeding',
        group: 'baby',
        ageRange: '7-24',
        priority: 'medium'
      },
      {
        id: 'baby_006',
        title: '语言启蒙',
        description: '多与宝宝交流，促进语言发育',
        icon: '🗣️',
        category: 'development',
        group: 'baby',
        ageRange: '7-24',
        priority: 'high'
      }
    ];
    
    // 直接设置预分组的模拟数据，确保与WXML中的变量名完全匹配
    this.setData({
      mockDataEnabled: true,
      // 直接使用与WXML中完全相同的变量名
      pregnantTemplates: mockPregnantTemplates,
      newMomTemplates: mockNewMomTemplates,
      babyTemplates_0_1: mockBabyTemplates_0_1,
      babyTemplates_2_6: mockBabyTemplates_2_6,
      babyTemplates_7_24: mockBabyTemplates_7_24,
      // 合并所有模板到templates数组
      templates: [...mockPregnantTemplates, ...mockNewMomTemplates, ...mockBabyTemplates_0_1, ...mockBabyTemplates_2_6, ...mockBabyTemplates_7_24]
    });
    
    console.log('模拟数据设置完成，确保变量名与WXML完全匹配:', {
      pregnantTemplatesCount: mockPregnantTemplates.length,
      newMomTemplatesCount: mockNewMomTemplates.length,
      babyTemplates_0_1Count: mockBabyTemplates_0_1.length,
      babyTemplates_2_6Count: mockBabyTemplates_2_6.length,
      babyTemplates_7_24Count: mockBabyTemplates_7_24.length,
      totalTemplatesCount: mockPregnantTemplates.length + mockNewMomTemplates.length + mockBabyTemplates_0_1.length + mockBabyTemplates_2_6.length + mockBabyTemplates_7_24.length
    });
  },
  
  /**
   * 根据分类获取模板图标
   */
  getTemplateIcon: function(category) {
    const categoryMap = {
      'care': '👶',
      'feeding': '🍼',
      'health': '💊',
      'development': '📚',
      'hygiene': '🧴',
      'activity': '🏃',
      'study': '📖'
    };
    
    return categoryMap[category] || '📝';
  },
  
  /**
   * 使用模拟数据（当云函数调用失败时）
   */
  useMockTemplateData: function() {
    console.log('使用模拟模板数据');
    
    // 直接调用setMockData来获取丰富且唯一的模拟数据
    this.setMockData();
    
    // 对所有模板进行分组
    const groupedMockTemplates = this.groupTemplates(this.data.templates);
    
    this.setData({
      groupedTemplates: groupedMockTemplates
    });
    
    console.log('模拟数据设置完成，每个分组都有唯一的数据');
  },
  
  /**
   * 对模板进行分组
   * @param {Array} templates - 模板数组
   * @returns {Object} 分组后的模板数据
   */
  /**
   * 将模板数据按分组和年龄段进行整理
   * @param {Array} templates - 原始模板数据数组
   * @returns {Object} 分组后的模板数据对象
   */
  groupTemplates: function(templates) {
    // 确保templates是数组
    const templateArray = Array.isArray(templates) ? templates : [];
    
    const grouped = {};
    
    // 初始化分组结构
    this.data.templateGroups.forEach(group => {
      if (group.id === 'baby') {
        grouped[group.id] = {};
        this.data.ageRanges.forEach(ageRange => {
          grouped[group.id][ageRange.id] = [];
        });
      } else {
        grouped[group.id] = [];
      }
    });
    
    // 分配模板到相应分组
    templateArray.forEach((template, index) => {
      // 确保template是对象
      if (!template || typeof template !== 'object') {
        return;
      }
      
      try {
        // 设置默认值，确保模板有必要的属性
        const safeTemplate = {
          id: template.id || template._id || `temp_${Date.now()}_${index}`,
          title: template.title || template.name || '未命名任务',
          description: template.description || template.subtitle || '',
          icon: template.icon || '📝',
          group: template.group,
          category: template.category || 'other',
          ageRange: template.ageRange || template.age_range,
          ...template
        };
        
        // 如果模板有group属性，按照group分配
        if (safeTemplate.group) {
          if (safeTemplate.group === 'baby' && safeTemplate.ageRange) {
            // 宝宝组按年龄段细分
            if (grouped['baby'][safeTemplate.ageRange]) {
              grouped['baby'][safeTemplate.ageRange].push(safeTemplate);
            } else {
              // 如果年龄段不匹配，默认放在0-1月
              grouped['baby']['0-1'].push(safeTemplate);
            }
          } else if (grouped[safeTemplate.group]) {
            // 其他组直接添加
            grouped[safeTemplate.group].push(safeTemplate);
          } else {
            // 对于未知分组，尝试根据类别推断
            this.inferGroupByCategory(grouped, safeTemplate);
          }
        } else {
          // 如果没有group属性，默认按category分配到合适的组
          this.inferGroupByCategory(grouped, safeTemplate);
        }
      } catch (error) {
        console.error(`处理模板时出错：`, error);
      }
    });
    
    // 确保每个分组都有数组结构，避免undefined
    Object.keys(grouped).forEach(key => {
      if (key === 'baby') {
        Object.keys(grouped.baby).forEach(ageKey => {
          if (!Array.isArray(grouped.baby[ageKey])) {
            grouped.baby[ageKey] = [];
          }
        });
      } else if (!Array.isArray(grouped[key])) {
        grouped[key] = [];
      }
    });
    
    return grouped;
  },
  
  /**
   * 根据category推断分组
   * @param {Object} grouped - 分组对象
   * @param {Object} template - 模板对象
   */
  inferGroupByCategory: function(grouped, template) {
    if (template.category === 'health' || template.category === 'hygiene') {
      grouped.pregnant.push(template);
    } else if (template.category === 'feeding' || template.category === 'care') {
      grouped.new_mom.push(template);
    } else {
      // 其他任务默认放在baby组的0-1月
      grouped.baby['0-1'].push(template);
    }
  },
  
  /**
   * 切换模板分组
   */
  switchTemplateGroup: function(e) {
    const group = e.currentTarget.dataset.group;
    this.setData({
      selectedGroup: group
    });
    
    // 如果切换到宝宝组，默认选择第一个年龄段
    if (group === 'baby') {
      this.setData({
        selectedAgeRange: '0-1'
      });
    }
    
    // 清除可能的调试信息
    this.clearDebugInfo();
  },
  
  /**
   * 清除可能的调试信息
   */
  clearDebugInfo: function() {
    // 确保数据中没有可能导致调试信息显示的属性
    const dataToUpdate = {};
    // 检查并清除任何可能导致调试信息的临时数据
    if (this.data.debugInfo) {
      dataToUpdate.debugInfo = null;
    }
    if (this.data.tempDebugText) {
      dataToUpdate.tempDebugText = null;
    }
    if (Object.keys(dataToUpdate).length > 0) {
      this.setData(dataToUpdate);
    }
  },
  
  /**
   * 切换年龄段（仅适用于宝宝组）
   */
  switchAgeRange: function(e) {
    const ageRange = e.currentTarget.dataset.age;
    this.setData({
      selectedAgeRange: ageRange
    });
  },
  
  /**
   * 从模板加载任务数据
   */
  loadTemplateData: function(templateId) {
    // 查找模板
    const template = this.data.templates.find(t => t._id === templateId || t.id === templateId);
    if (template) {
      // 使用正确的字段名（与表单字段匹配）
      this.setData({
        title: template.title || template.name || '',
        description: template.description || template.subtitle || '',
        category: template.category || 'care',
      });
    }
  },
  
  /**
   * 显示/隐藏模板列表
   */
  toggleTemplates: function() {
    this.setData({
      showTemplates: !this.data.showTemplates
    });
  },
  
  /**
   * 选择模板
   */
  selectTemplate: function(e) {
    const templateId = e.currentTarget.dataset.id;
    this.loadTemplateData(templateId);
    this.setData({ showTemplates: false });
  },
  
  /**
   * 切换任务分类
   */
  onCategoryChange: function(e) {
    const category = e.currentTarget.dataset.id;
    this.setData({ category });
  },
  
  /**
   * 设置任务优先级
   */


  /**
   * 加载任务数据（编辑模式下）
   */
  loadTaskData: async function () {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('tasks').doc(this.data.taskId).get();
      
      const task = res.data;
      
      this.setData({
        title: task.title,
        description: task.description || '',
        category: task.category,
        priority: task.priority || 0,
        frequency: task.frequency || 'none'
      });
      
      // 根据任务频率设置相关数据
      if (task.frequency === 'weekly') {
        // 每周模式：设置选中的天数
        const selectedDays = {};
        if (task.selectedDays && Array.isArray(task.selectedDays)) {
          task.selectedDays.forEach(day => {
            selectedDays[String(day)] = true;
          });
        }
        
        // 生成计算后的选中天数数组
        const computedSelectedDays = [];
        for (let i = 0; i < 7; i++) {
          computedSelectedDays.push(selectedDays[String(i)] === true);
        }
        
        this.setData({
          selectedDays,
          computedSelectedDays
        });
      } else if (task.frequency === 'monthly') {
        // 每月模式：设置选中的日期（支持多选）
        const selectedMonthDays = {};
        if (task.selectedMonthDays && Array.isArray(task.selectedMonthDays)) {
          task.selectedMonthDays.forEach(day => {
            selectedMonthDays[String(day)] = true;
          });
        } else if (task.selectedDate) {
          // 兼容旧数据格式
          selectedMonthDays[task.selectedDate.toString()] = true;
        }
        
        // 生成计算后的选中日期数组
        const computedSelectedMonthDays = [];
        for (let i = 0; i < this.data.monthDays.length; i++) {
          computedSelectedMonthDays.push(selectedMonthDays[this.data.monthDays[i]] === true);
        }
        
        this.setData({
          selectedMonthDays,
          computedSelectedMonthDays
        });
      } else if (task.frequency === 'daily') {
        // 每天模式：无需设置循环次数（默认1次）
      }
    } catch (error) {
      console.error('加载任务数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 输入任务名称
   */
  onTitleInput: function (e) {
    this.setData({
      title: e.detail.value
    });
  },

  onDescriptionInput: function (e) {
    this.setData({
      description: e.detail.value
    });
  },

  /**
   * 选择时间
   */


  /**
   * 选择频率/循环选项
   */
  /**
   * 处理循环频率变更
   * @param {Object} e - 事件对象
   */
  onFrequencyChange: function(e) {
    // 获取选中的频率类型
    const frequency = e.currentTarget.dataset.id;
    
    console.log('频率切换:', frequency);
    
    // 创建新的数据对象
    const newData = {};
    
    // 始终更新频率
    newData.frequency = frequency;
    
    // 根据不同频率类型设置相应的属性
    if (frequency === 'weekly') {
      // 切换到每周模式，确保默认选中周一（索引为0）
      const selectedDays = { '0': true };
      newData.selectedDays = selectedDays;
      
      // 生成计算后的选中天数数组，用于WXML绑定
      const computedSelectedDays = [];
      for (let i = 0; i < this.data.weekDays.length; i++) {
        computedSelectedDays.push(selectedDays[String(i)] === true);
      }
      newData.computedSelectedDays = computedSelectedDays;
      
      console.log('切换到每周模式，默认选中周一');
      console.log('初始computedSelectedDays:', computedSelectedDays);
    } else if (frequency === 'monthly') {
      // 每月模式：使用当前日期，并清空星期选择，初始化每月日期选择
      const today = new Date();
      const currentDay = today.getDate().toString();
      newData.selectedDate = currentDay;
      newData.selectedDays = {};
      newData.computedSelectedDays = [];
      
      // 初始化每月日期选择，默认选中当天
      newData.selectedMonthDays = { [currentDay]: true };
      
      // 生成计算后的选中日期数组，用于WXML绑定
      const computedSelectedMonthDays = [];
      for (let i = 0; i < this.data.monthDays.length; i++) {
        computedSelectedMonthDays.push(newData.selectedMonthDays[this.data.monthDays[i]] === true);
      }
      newData.computedSelectedMonthDays = computedSelectedMonthDays;
      console.log('切换到每月模式，默认选中当前日期:', currentDay);
    } else {
      // 其他模式时清空选中的天数
      newData.selectedDays = {};
      newData.computedSelectedDays = [];
      newData.selectedMonthDays = {};
      newData.computedSelectedMonthDays = [];
      console.log(`切换到${frequency}频率，重置相关选择数据`);
    }
    
    // 使用setData更新数据，并在回调中验证
    this.setData(newData, () => {
      // 验证数据更新是否成功
      console.log('更新后的数据状态:', {
        frequency: this.data.frequency,
        selectedDays: this.data.selectedDays,
        computedSelectedDays: this.data.computedSelectedDays,
        selectedDate: this.data.selectedDate,
        selectedMonthDays: this.data.selectedMonthDays,
        computedSelectedMonthDays: this.data.computedSelectedMonthDays
      });
    });
  },
  
  /**
   * 选择星期几（每周循环模式）
   */
  /**
   * 处理星期选择
   * 使用对象存储选中状态，键为星期索引字符串，值为布尔值
   */
  onWeekdaySelect: function(e) {
    // 获取数据索引并强制转换为字符串类型，确保类型一致性
    const dayIndexStr = String(e.currentTarget.dataset.index);
    
    console.log('===== 星期选择事件开始 =====');
    console.log('原始data-index值:', dayIndexStr, '(类型:', typeof dayIndexStr, ')');
    console.log('当前selectedDays状态:', JSON.stringify(this.data.selectedDays));
    
    // 创建selectedDays的副本
    const newSelectedDays = { ...this.data.selectedDays };
    
    // 切换选中状态
    newSelectedDays[dayIndexStr] = !newSelectedDays[dayIndexStr];
    console.log(`切换星期${dayIndexStr} (${this.data.weekDays[parseInt(dayIndexStr)]})的选中状态为: ${newSelectedDays[dayIndexStr]}`);
    
    // 生成计算后的选中天数数组，用于WXML绑定
    const computedSelectedDays = [];
    for (let i = 0; i < this.data.weekDays.length; i++) {
      computedSelectedDays.push(newSelectedDays[String(i)] === true);
    }
    console.log('计算后的选中天数数组:', computedSelectedDays);
    
    // 使用setData更新数据，确保UI正确响应
    const updateData = {
      selectedDays: newSelectedDays,
      computedSelectedDays: computedSelectedDays
    };
    console.log('准备更新的数据:', updateData);
    
    this.setData(updateData, () => {
      // setData回调，确保数据已更新后再进行验证
      console.log('更新后的selectedDays:', JSON.stringify(this.data.selectedDays));
      console.log('更新后的computedSelectedDays:', JSON.stringify(this.data.computedSelectedDays));
      console.log('===== 星期选择事件结束 =====');
    });
  },
  
  /**
   * 选择每月日期（每月循环模式）- 支持多选
   */
  onMonthdaySelect: function(e) {
    const day = e.currentTarget.dataset.day;
    console.log('选择每月日期:', day);
    
    // 创建selectedMonthDays对象副本
    const newSelectedMonthDays = { ...this.data.selectedMonthDays };
    
    // 切换选中状态
    newSelectedMonthDays[day] = !newSelectedMonthDays[day];
    console.log(`切换日期${day}的选中状态为: ${newSelectedMonthDays[day]}`);
    
    // 生成计算后的选中日期数组，用于WXML绑定
    const computedSelectedMonthDays = [];
    for (let i = 0; i < this.data.monthDays.length; i++) {
      computedSelectedMonthDays.push(newSelectedMonthDays[this.data.monthDays[i]] === true);
    }
    console.log('计算后的选中日期数组:', computedSelectedMonthDays);
    
    // 使用setData更新数据，确保UI正确响应
    this.setData({
      selectedMonthDays: newSelectedMonthDays,
      computedSelectedMonthDays: computedSelectedMonthDays
    });
  },
  


  /**
   * 返回上一页
   */
  /**
   * 返回上一页
   */


  /**
   * 选择星期几（每周模式）
   */
  // 删除不需要的日期选择相关函数

  /**
   * 切换图标
   */
  // 图标功能暂时不需要

  /**
   * 保存任务
   */
  saveTask: async function () {
    // 验证输入
    if (!this.data.title.trim()) {
      wx.showToast({
        title: '请输入任务标题',
        icon: 'none'
      });
      return;
    }
    
    // 循环选项验证
    const { frequency, selectedDays, selectedMonthDays } = this.data;
    if (frequency === 'weekly' && Object.keys(selectedDays).filter(key => selectedDays[key]).length === 0) {
      wx.showToast({
        title: '每周循环请选择周几',
        icon: 'none'
      });
      return;
    }
    
    if (frequency === 'monthly' && Object.keys(selectedMonthDays).filter(key => selectedMonthDays[key]).length === 0) {
      wx.showToast({
        title: '每月循环请选择日期',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ loading: true })
    
    try {
      if (this.data.mode === 'create') {
        // 准备任务数据，处理周任务的星期索引转换
        // 注意：页面上周一为索引0，但JavaScript标准中周日为0，需要进行转换
        let saveSelectedDays = [];
        if (this.data.frequency === 'weekly') {
          // 获取选中的星期索引并转换为JavaScript标准（0=周日，1=周一...6=周六）
          const selectedIndices = Object.keys(this.data.selectedDays).filter(key => this.data.selectedDays[key]);
          saveSelectedDays = selectedIndices.map(dayIndex => {
            // 页面上：0=周一, 1=周二...6=周日
            // JavaScript: 0=周日, 1=周一...6=周六
            // 转换规则：页面索引+1 = JS索引，特殊处理周日（页面索引6 -> JS索引0）
            const pageIndex = parseInt(dayIndex);
            return pageIndex === 6 ? 0 : pageIndex + 1;
          });
          console.log('📅 周任务索引转换 - 页面索引:', selectedIndices, '转换后JS索引:', saveSelectedDays);
        }
        
        // 创建新任务
        const result = await wx.cloud.callFunction({
          name: 'createTask',
          data: {
            title: this.data.title,
            description: this.data.description,
            category: this.data.category,
        
            // 循环相关设置
            frequency: this.data.frequency,
            selectedDays: saveSelectedDays,
            selectedMonthDays: this.data.frequency === 'monthly' ? Object.keys(this.data.selectedMonthDays).filter(key => this.data.selectedMonthDays[key]).map(day => parseInt(day)) : []
          }
        });
        
        if (result.result.success) {
          wx.showToast({
            title: '创建成功',
            icon: 'success',
            duration: 1500,
            success: () => {
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
        } else {
          throw new Error(result.result.error || '创建失败');
        }
      } else {
        // 准备任务数据，处理周任务的星期索引转换
        let saveSelectedDays = [];
        if (this.data.frequency === 'weekly') {
          // 获取选中的星期索引并转换为JavaScript标准
          const selectedIndices = Object.keys(this.data.selectedDays).filter(key => this.data.selectedDays[key]);
          saveSelectedDays = selectedIndices.map(dayIndex => {
            const pageIndex = parseInt(dayIndex);
            return pageIndex === 6 ? 0 : pageIndex + 1;
          });
          console.log('📅 更新周任务索引转换 - 页面索引:', selectedIndices, '转换后JS索引:', saveSelectedDays);
        }
        
        // 更新任务
        const db = wx.cloud.database();
        await db.collection('tasks').doc(this.data.taskId).update({
          data: {
            title: this.data.title,
            description: this.data.description,
            category: this.data.category,
            priority: this.data.priority,
            updateTime: new Date(),
            // 循环相关设置
            frequency: this.data.frequency,
            selectedDays: saveSelectedDays,
            selectedMonthDays: this.data.frequency === 'monthly' ? Object.keys(this.data.selectedMonthDays).filter(key => this.data.selectedMonthDays[key]).map(day => parseInt(day)) : []
          }
        });
        
        wx.showToast({
          title: '更新成功',
          icon: 'success',
          duration: 1500,
          success: () => {
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        });
      }
    } catch (error) {
      console.error('保存任务失败:', error);
      wx.showToast({
        title: '保存失败: ' + error.message,
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 处理删除任务按钮点击事件
   * 显示确认对话框
   */
  handleDeleteTask: function() {
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该任务吗？删除后将无法恢复。',
      success (res) {
        if (res.confirm) {
          console.log('用户确认删除');
          that.deleteTask();
        } else if (res.cancel) {
          console.log('用户取消删除');
        }
      }
    });
  },

  /**
   * 删除任务函数 - 软删除实现
   * 将任务状态更新为deleted而非物理删除，避免权限问题
   * 根据数据存储方案，tasks集合支持deleted状态
   * 
   * 注意：如需使用该功能，请确保已部署deleteTask云函数
   * 部署方法：
   * 1. 通过微信开发者工具的云开发控制台部署（推荐）
   * 2. 或使用命令行工具，但需要适当的权限
   * 3. 云函数文件路径：cloudfunctions/deleteTask/index.js
   */
  deleteTask: async function() {
    const taskId = this.data.taskId;
    console.log('开始执行删除任务操作（软删除）', { taskId });
    
    // 任务ID验证
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      wx.showToast({
        title: '任务ID无效',
        icon: 'none',
        duration: 3000
      });
      console.warn('删除任务失败：任务ID为空');
      return;
    }

    // 显示加载状态
    wx.showLoading({
      title: '删除中...',
    });

    try {
      // 使用云函数进行删除操作，利用云函数中的权限验证和错误处理
      console.log('调用deleteTask云函数执行软删除');
      const result = await wx.cloud.callFunction({
        name: 'deleteTask',
        data: {
          taskId: taskId
        }
      });
      
      wx.hideLoading();
      console.log('云函数执行结果:', JSON.stringify(result));
      
      // 处理云函数返回结果
      if (result.result && result.result.success) {
        console.log('任务软删除成功');
        wx.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 3000
        });
        
        // 删除成功后返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        // 云函数执行失败或返回错误
        console.error('云函数执行返回失败', result);
        const errorMsg = result.result && result.result.error ? 
          result.result.error : '删除失败，请稍后重试';
          
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 4000
        });
      }
    } catch (error) {
      // 捕获云函数调用失败的情况
      console.error('调用云函数失败:', error);
      wx.hideLoading();
      
      let errorMsg = '系统异常，请稍后重试';
      if (error.errMsg) {
        if (error.errMsg.includes('FunctionName parameter could not be found')) {
          // 专门处理云函数未找到错误
          errorMsg = '云函数未部署，请通过云开发控制台部署deleteTask函数';
        } else if (error.errMsg.includes('cloud.callFunction:fail')) {
          errorMsg = '网络异常，无法连接服务器';
        }
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 4000
      });
    }
    
    console.log('删除任务操作结束');
  },

  /**
   * 绑定返回（兼容旧方法）
   */
  bindBack: function () {
    this.navigateBack();
  }
});
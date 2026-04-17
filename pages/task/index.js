// 任务管理页面
const app = getApp()
const taskUtils = require('../../utils/taskUtils');
const familyService = require('../../services/familyService');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    tasks: [],
    currentTab: 'all', // all, completed
    currentCategory: 'all',
    categories: [
      { id: 'all', name: '全部' },
      { id: 'feeding', name: '喂养' },
      { id: 'sleep', name: '睡眠' },
      { id: 'hygiene', name: '清洁' },
      { id: 'health', name: '健康' },
      { id: 'play', name: '玩耍' },
      { id: 'study', name: '学习' }
    ],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    refreshing: false,
    families: [],
    currentFamilyId: null,
    currentFamilyName: '我的家庭'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 如果有tab参数，设置当前标签
    if (options && options.tab) {
      this.setData({
        currentTab: options.tab
      });
    }
    this.loadFamilyInfo().then(() => {
      this.loadTasks();
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 每次显示页面时刷新家庭信息和任务列表
    this.loadFamilyInfo().then(() => {
      if (this.data.hasLoaded) {
        this.refreshTasks();
      } else {
        this.setData({ hasLoaded: true });
      }
    });
  },

  /**
   * 获取当前家庭ID
   */
  getCurrentFamilyId: function() {
    // 优先使用已加载的家庭ID
    if (this.data.currentFamilyId) {
      return this.data.currentFamilyId;
    }
    
    // 其次从本地存储获取
    const familyId = wx.getStorageSync('currentFamilyId');
    if (familyId) {
      return familyId;
    }
    
    return null;
  },

  /**
   * 加载家庭信息并设置当前家庭
   */
  loadFamilyInfo: async function() {
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const currentOpenId = currentUserInfo.openId || currentUserInfo._id || currentUserInfo.openid || currentUserInfo.openID || '';

    try {
      const result = await familyService.getMyFamilies();
      const familiesRaw = result.families || [];
      const createdFamilies = [];
      const joinedFamilies = [];
      const families = [];

      familiesRaw.forEach(family => {
        const rawBabyNickname = family.babyInfo?.nickname || family.babyNickname || '宝宝';
        const sanitizedBabyNickname = /^(微信用户|家庭成员)/.test(rawBabyNickname) ? '宝宝' : rawBabyNickname;
        const sanitizedFamilyName = family.familyName && !/^(微信用户|家庭成员)/.test(family.familyName) ? family.familyName : '';
        const familyData = {
          ...family,
          babyNickname: sanitizedBabyNickname,
          creatorOpenId: family.creatorOpenId || family.creator || family.ownerOpenId || '',
          name: sanitizedFamilyName || `${sanitizedBabyNickname}的家`,
          displayName: sanitizedFamilyName || `${sanitizedBabyNickname}的家`
        };

        families.push(familyData);
        if (familyData.creatorOpenId && familyData.creatorOpenId === currentOpenId) {
          createdFamilies.push(familyData);
        } else {
          joinedFamilies.push(familyData);
        }
      });

      // 自己创建的家庭排在前面
      families.sort((a, b) => {
        const aOwner = a.creatorOpenId === currentOpenId ? 1 : 0;
        const bOwner = b.creatorOpenId === currentOpenId ? 1 : 0;
        return bOwner - aOwner;
      });

      let currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
      let currentFamily = families.find(f => f._id === currentFamilyId);
      if (!currentFamily) {
        // 默认优先展示用户创建的家庭
        if (createdFamilies.length > 0) {
          currentFamily = createdFamilies[0];
        } else if (joinedFamilies.length > 0) {
          currentFamily = joinedFamilies[0];
        }
      }

      if (currentFamily) {
        currentFamilyId = currentFamily._id;
        wx.setStorageSync('currentFamilyId', currentFamilyId);
        const currentFamilyName = currentFamily.displayName || currentFamily.name || `${currentFamily.babyNickname || '宝宝'}的家`;
        this.setData({
          families,
          currentFamilyId,
          currentFamilyName
        });
      } else {
        wx.removeStorageSync('currentFamilyId');
        const userInfo = wx.getStorageSync('userInfo') || {};
        if (userInfo.currentFamilyId) {
          delete userInfo.currentFamilyId;
          wx.setStorageSync('userInfo', userInfo);
        }
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentFamilyId = null;
        }
        this.setData({
          families,
          currentFamilyId: null,
          currentFamilyName: '我的家庭',
          tasks: []
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 切换家庭 tab
   */
  switchFamilyTab: async function(e) {
    const familyId = e.currentTarget.dataset.tabId;
    if (!familyId || familyId === this.data.currentFamilyId || this.data.switchingTab) {
      return;
    }

    const family = this.data.families.find(f => f._id === familyId);
    if (!family) return;

    this.setData({ switchingTab: true });

    try {
      wx.showLoading({ title: '切换中...' });
      await familyService.switchFamily(familyId);
      this.setData({
        currentFamilyId: familyId,
        currentFamilyName: family.displayName || family.name || `${family.babyNickname || '宝宝'}的家`
      });
    } catch (error) {
      wx.hideLoading();
      console.error('切换家庭失败:', error);
      wx.showToast({ title: '切换家庭失败', icon: 'none' });
      this.setData({ switchingTab: false });
      return;
    }

    try {
      await this.refreshTasks();
    } catch (error) {
      console.error('加载任务失败:', error);
      wx.showToast({ title: '家庭已切换，任务加载失败，请下拉刷新', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ switchingTab: false });
    }
  },

  /**
   * 加载任务列表
   */
  loadTasks: async function (isRefresh = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const { currentTab, currentCategory, page, pageSize } = this.data
      const status = currentTab === 'all' ? '' : currentTab
      const category = currentCategory === 'all' ? '' : currentCategory
      
      // 获取当前家庭ID
      const familyId = this.getCurrentFamilyId()
      
      // 调用云函数获取任务列表
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status: '', // 获取所有任务，前端自己排序和过滤
          category,
          familyId, // 传递家庭ID进行过滤
          page: isRefresh ? 1 : page,
          size: 100 // 获取更多任务用于排序
        }
      })
      
      if (result.result.success) {
        let tasks = result.result.tasks || []
        
        // 处理任务标签和状态
        tasks = this._processTaskLabels(tasks)
        
        // 按照规则排序
        tasks = this._sortTasks(tasks)
        
        // 如果是特定标签，过滤任务
        if (currentTab !== 'all') {
          tasks = tasks.filter(task => {
            if (currentTab === 'pending') {
              return task.displayStatus === '未完成'
            } else if (currentTab === 'completed') {
              return task.displayStatus === '已完成'
            }
            return true
          })
        }
        
        this.setData({
          tasks,
          hasMore: false, // 一次性加载所有
          page: 1,
          refreshing: false
        })
      }
    } catch (error) {
      console.error('加载任务失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false, refreshing: false })
    }
  },

  /**
   * 处理任务标签
   * 单次任务：显示已完成/未完成
   * 循环任务：进行中的均为未完成，已删除的进入已完成列表
   */
  _processTaskLabels: function (tasks) {
    return tasks.map(task => {
      const isRecurring = task.frequency && task.frequency !== 'none' && task.frequency !== 'once'
      const isDeleted = task.isDeleted || task.status === 'deleted'
      const isCompleted = task.status === 'completed'
      
      let displayStatus = ''
      const frequency = task.frequency || 'none'
      let frequencyText = '单次'

      if (frequency === 'daily') {
        frequencyText = '每日'
      } else if (frequency === 'weekly') {
        frequencyText = taskUtils.getWeekdayText(task.selectedDays)
      } else if (frequency === 'monthly') {
        frequencyText = taskUtils.getMonthdayText(task.selectedMonthDays)
      }

      let taskType = frequencyText
      
      if (isRecurring) {
        // 循环任务
        if (isDeleted) {
          displayStatus = '已完成'
        } else {
          displayStatus = '未完成'
        }
      } else {
        // 单次任务
        displayStatus = isCompleted ? '已完成' : '未完成'
      }
      
      return {
        ...task,
        displayStatus,
        taskType,
        isRecurring,
        displayDueDate: this._formatTaskDueDate(task.dueDate),
        categoryName: this._getCategoryName(task.category),
        sortTime: task.createdAt ? new Date(task.createdAt).getTime() : 0
      }
    })
  },

  _getCategoryName: function (categoryId) {
    if (!categoryId) return ''
    const category = this.data.categories.find(item => item.id === categoryId)
    return category ? category.name : ''
  },

  _formatTaskDueDate: function (value) {
    if (!value) return ''
    const dateObj = this._parseToDateObject(value)
    if (!dateObj) return ''
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  _parseToDateObject: function (value) {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === 'number') return new Date(value)
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? null : parsed
    }
    if (typeof value === 'object') {
      if (value._seconds !== undefined || value._nanoseconds !== undefined) {
        return new Date((value._seconds || 0) * 1000 + Math.round((value._nanoseconds || 0) / 1000000))
      }
      if (value.seconds !== undefined) {
        return new Date((value.seconds || 0) * 1000 + Math.round((value.nanoseconds || 0) / 1000000))
      }
      if (value.$date) {
        return this._parseToDateObject(value.$date)
      }
      if (typeof value.toDate === 'function') {
        return value.toDate()
      }
    }
    return null
  },

  /**
   * 排序任务
   * 1. 未完成任务 > 已完成任务
   * 2. 循环任务 > 单次任务
   * 3. 按照时间由近及远
   */
  _sortTasks: function (tasks) {
    return tasks.sort((a, b) => {
      // 第一级排序：未完成 > 已完成
      const aIsPending = a.displayStatus === '未完成'
      const bIsPending = b.displayStatus === '未完成'
      
      if (aIsPending && !bIsPending) return -1
      if (!aIsPending && bIsPending) return 1
      
      // 第二级排序：循环任务 > 单次任务
      if (a.isRecurring && !b.isRecurring) return -1
      if (!a.isRecurring && b.isRecurring) return 1
      
      // 第三级排序：时间由近及远（倒序）
      const aTime = a.sortTime || 0
      const bTime = b.sortTime || 0
      return bTime - aTime
    })
  },

  /**
   * 刷新任务列表
   */
  refreshTasks: function () {
    this.setData({ 
      tasks: [], 
      page: 1, 
      hasMore: true,
      refreshing: true 
    })
    this.loadTasks(true)
  },

  /**
   * 切换任务状态标签
   */
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== this.data.currentTab) {
      this.setData({ 
        currentTab: tab,
        tasks: [],
        page: 1,
        hasMore: true
      })
      this.loadTasks()
    }
  },

  /**
   * 切换任务分类
   */
  switchCategory: function (e) {
    const category = e.currentTarget.dataset.category
    if (category !== this.data.currentCategory) {
      this.setData({ 
        currentCategory: category,
        tasks: [],
        page: 1,
        hasMore: true
      })
      this.loadTasks()
    }
  },

  /**
   * 跳转到创建任务页面
   */
  goToCreateTask: function () {
    wx.navigateTo({
      url: '/pages/task/create'
    })
  },

  /**
   * 跳转到任务模板页面
   */
  goToTaskTemplates: function () {
    wx.navigateTo({
      url: '/pages/template/index'
    })
  },

  /**
   * 跳转到任务详情页
   */
  goToTaskDetail: function (e) {
    const taskId = e.currentTarget.dataset.id;

    // 我的-数据区-全部任务：点击统一进入详情页，不直接切换打卡状态
    wx.navigateTo({
      url: `/pages/task/detail?id=${taskId}`
    });
  },

  /**
   * 更新任务状态
   */
  toggleTaskStatus: async function (e) {
    // 阻止冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    const taskId = e.currentTarget.dataset.id;
    const task = this.data.tasks.find(t => t._id === taskId);
    
    if (!task) return;
    
    // 单次已完成任务在已完成页仅展示，不可操作
    if (this.data.currentTab === 'completed' && !task.isRecurring) {
      wx.showToast({
        title: '单次已完成任务仅展示，不可操作',
        icon: 'none'
      });
      return;
    }

    // 循环任务不允许通过checkbox切换，需要进入详情页
    if (task.isRecurring) {
      wx.showToast({
        title: '循环任务请进入详情查看',
        icon: 'none'
      });
      return;
    }
    
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    
    try {
      // 先乐观更新UI
      const tasks = this.data.tasks.map(t => {
        if (t._id === taskId) {
          return { ...t, status: newStatus, displayStatus: newStatus === 'completed' ? '已完成' : '未完成' };
        }
        return t;
      });
      this.setData({ tasks });
      
      // 调用云函数更新任务状态
      const result = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: { taskId, status: newStatus }
      });
      
      if (!result.result || !result.result.success) {
        // 如果更新失败，恢复原状态
        this.refreshTasks();
        throw new Error(result.result ? result.result.error : '网络异常');
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
      this.refreshTasks();
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 处理下拉刷新
   */
  onPullDownRefresh: function () {
    this.refreshTasks()
  },

  /**
   * 处理上拉加载更多
   */
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadTasks()
    }
  }
})
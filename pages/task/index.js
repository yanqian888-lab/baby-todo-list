// 任务管理页面
const app = getApp()
Page({
  /**
   * 页面的初始数据
   */
  data: {
    tasks: [],
    currentTab: 'pending', // pending, completed, all
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
    refreshing: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    this.loadTasks()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时刷新任务列表
    if (this.data.hasLoaded) {
      this.refreshTasks()
    } else {
      this.setData({ hasLoaded: true })
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
      
      // 调用云函数获取任务列表
      const result = await wx.cloud.callFunction({
        name: 'getTasks',
        data: {
          status,
          category,
          page: isRefresh ? 1 : page,
          pageSize
        }
      })
      
      if (result.result.success) {
        const newTasks = result.result.tasks
        const tasks = isRefresh ? newTasks : [...this.data.tasks, ...newTasks]
        
        this.setData({
          tasks,
          hasMore: newTasks.length === pageSize,
          page: isRefresh ? 2 : page + 1,
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
      this.setData({ loading: false })
    }
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
   * 更新任务状态
   */
  toggleTaskStatus: async function (e) {
    const taskId = e.currentTarget.dataset.id
    const task = this.data.tasks.find(t => t._id === taskId)
    const newStatus = task.status === 'pending' ? 'completed' : 'pending'
    
    try {
      // 先乐观更新UI
      const tasks = this.data.tasks.map(t => {
        if (t._id === taskId) {
          return { ...t, status: newStatus }
        }
        return t
      })
      this.setData({ tasks })
      
      // 调用云函数更新任务状态
      const result = await wx.cloud.callFunction({
        name: 'updateTaskStatus',
        data: { taskId, status: newStatus }
      })
      
      if (!result.result.success) {
        // 如果更新失败，恢复原状态
        this.refreshTasks()
        throw new Error(result.result.error)
      }
    } catch (error) {
      console.error('更新任务状态失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
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
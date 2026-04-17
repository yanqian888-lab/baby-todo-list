// pages/template/index.js
const app = getApp()
Page({
  /**
   * 页面的初始数据
   */
  data: {
    templates: [],
    categories: [
      { id: 'all', name: '全部' },
      { id: 'feeding', name: '喂养' },
      { id: 'sleep', name: '睡眠' },
      { id: 'hygiene', name: '清洁' },
      { id: 'health', name: '健康' },
      { id: 'play', name: '玩耍' },
      { id: 'study', name: '学习' },
      { id: 'care', name: '护理' }
    ],
    currentCategory: 'all',
    loading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.loadTemplates()
  },

  onShow: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
  },

  /**
   * 加载任务模板列表
   */
  loadTemplates: async function () {
    this.setData({ loading: true })
    
    try {
      const { currentCategory } = this.data
      const category = currentCategory === 'all' ? '' : currentCategory
      
      const result = await wx.cloud.callFunction({
        name: 'getTaskTemplates',
        data: { category }
      })
      
      if (result.result.success) {
        this.setData({
          templates: result.result.templates
        })
      }
    } catch (error) {
      console.error('加载任务模板失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 切换任务分类
   */
  switchCategory: function (e) {
    const category = e.currentTarget.dataset.category
    if (category !== this.data.currentCategory) {
      this.setData({ 
        currentCategory: category
      })
      this.loadTemplates()
    }
  },

  /**
   * 使用模板创建任务
   */
  useTemplate: function(e) {
    try {
      const templateId = e.currentTarget.dataset.id;
      console.log('选择的模板ID:', templateId);
      
      // 查找对应的模板数据，用于日志记录
      const template = this.data.templates.find(t => t._id === templateId || t.id === templateId);
      console.log('模板数据:', template);
      
      // 跳转到创建任务页面，并传递模板ID作为参数
      wx.navigateTo({
        url: `/pages/task/create?templateId=${templateId}`
      });
    } catch (error) {
      console.error('使用模板创建任务失败:', error);
      wx.showToast({
        title: '操作失败: ' + error.message,
        icon: 'none'
      });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadTemplates().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
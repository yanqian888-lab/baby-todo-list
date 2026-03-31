// pages/suggest/list.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    categories: [
      { id: 'all', name: '全部' },
      { id: 'nutrition', name: '营养喂养' },
      { id: 'health', name: '健康护理' },
      { id: 'education', name: '早教启蒙' },
      { id: 'rest', name: '睡眠休息' }
    ],
    currentCategory: 'all',
    suggestions: [],
    loading: false,
    pageNum: 1,
    pageSize: 10,
    hasMore: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadSuggestions();
  },

  /**
   * 加载建议事项列表
   */
  loadSuggestions: function () {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    // 模拟数据，实际应从云数据库获取
    setTimeout(() => {
      const mockSuggestions = [
        {
          id: '1',
          title: '定时喂奶提醒',
          description: '新生儿需要每2-3小时喂一次奶，建立规律的喂养习惯',
          category: 'nutrition',
          icon: '🍼',
          frequency: 'daily',
          recommended: true
        },
        {
          id: '2',
          title: '婴儿抚触按摩',
          description: '每日10-15分钟的抚触可以促进宝宝血液循环和安全感',
          category: 'health',
          icon: '👐',
          frequency: 'daily',
          recommended: true
        },
        {
          id: '3',
          title: '黑白卡片视觉训练',
          description: '使用黑白卡片进行视觉刺激，促进宝宝视觉发育',
          category: 'education',
          icon: '🎨',
          frequency: 'daily',
          recommended: false
        },
        {
          id: '4',
          title: '培养规律睡眠',
          description: '建立固定的睡前仪式，帮助宝宝养成良好的睡眠习惯',
          category: 'rest',
          icon: '🌙',
          frequency: 'daily',
          recommended: true
        },
        {
          id: '5',
          title: '补充维生素D',
          description: '新生儿出生后需补充维生素D，促进钙吸收',
          category: 'health',
          icon: '💊',
          frequency: 'daily',
          recommended: false
        }
      ];
      
      // 过滤当前分类的数据
      const filtered = this.data.currentCategory === 'all' 
        ? mockSuggestions 
        : mockSuggestions.filter(item => item.category === this.data.currentCategory);
      
      this.setData({
        suggestions: filtered,
        loading: false,
        hasMore: false // 模拟没有更多数据
      });
    }, 500);
  },

  /**
   * 切换分类
   */
  switchCategory: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId === this.data.currentCategory) return;
    
    this.setData({
      currentCategory: categoryId,
      suggestions: [],
      pageNum: 1,
      hasMore: true
    });
    
    this.loadSuggestions();
  },

  /**
   * 添加到我的任务
   */
  addToTasks: function (e) {
    const suggestion = e.currentTarget.dataset.item;
    
    wx.showModal({
      title: '添加任务',
      content: `确定要添加「${suggestion.title}」到您的任务列表吗？`,
      success: (res) => {
        if (res.confirm) {
          // 这里应该调用API将任务添加到用户的任务列表
          wx.showToast({
            title: '添加成功',
            icon: 'success',
            duration: 2000,
            success: () => {
              // 可以在这里刷新首页数据或延迟返回
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
        }
      }
    });
  },

  /**
   * 查看详情
   */
  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    // 这里可以跳转到详情页或弹出详情面板
    console.log('查看详情:', id);
  }
});
// pages/profile/help.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    faqs: [
      {
        id: 1,
        question: '如何添加宝宝信息？',
        answer: '在"我的"页面点击"宝宝信息"，即可进入宝宝信息编辑页面，填写相关信息后保存即可。',
        expanded: false
      },
      {
        id: 2,
        question: '如何添加排敏记录？',
        answer: '在"排敏"页面点击"添加今日排敏"，选择食物并填写相关信息后保存即可。',
        expanded: false
      },
      {
        id: 3,
        question: '如何查看排敏进度？',
        answer: '在"我的"页面的"排敏进度"卡片中，可以查看已完成的食物种类和总进度。',
        expanded: false
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    // 页面加载逻辑
  },
  
  /**
   * 展开/折叠FAQ
   */
  toggleFaq: function (e) {
    const id = e.currentTarget.dataset.id;
    const faqs = this.data.faqs.map(faq => {
      if (faq.id === id) {
        return { ...faq, expanded: !faq.expanded };
      }
      return faq;
    });
    this.setData({ faqs });
  }
});
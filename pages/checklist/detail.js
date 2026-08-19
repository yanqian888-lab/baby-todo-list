// pages/checklist/detail.js
// 宝贝清单详情页（备忘录勾选式）
Page({
  /**
   * 页面的初始数据
   */
  data: {
    listId: '',
    familyId: '',
    list: null,
    items: [],
    isCreator: false,
    loading: true,
    // 底部输入栏
    newItemText: '',
    adding: false,
    // 编辑条目弹窗
    showEditModal: false,
    editingItem: null,
    editingText: '',
    saving: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const listId = options.id || '';
    const familyId = wx.getStorageSync('currentFamilyId') || '';
    this.setData({ listId, familyId });
    this.loadList();
  },

  /**
   * 加载清单数据（从 getLists 中按 id 查找）
   */
  loadList: async function () {
    const { familyId, listId } = this.data;
    if (!familyId || !listId) {
      this.setData({ loading: false });
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'checklistManager',
        data: { action: 'getLists', familyId }
      });
      const result = res.result || {};
      if (!result.success) {
        throw new Error(result.error || '获取清单失败');
      }

      const list = (result.data.lists || []).find(item => item._id === listId);
      if (!list) {
        this.setData({ loading: false });
        wx.showToast({ title: '清单不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      this.setData({
        list,
        items: list.items || [],
        isCreator: !!result.data.isCreator,
        loading: false
      });
      wx.setNavigationBarTitle({ title: list.name || '清单' });
    } catch (error) {
      console.error('加载清单详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  /**
   * 调用云函数的通用封装
   */
  _call: async function (data) {
    const res = await wx.cloud.callFunction({
      name: 'checklistManager',
      data
    });
    const result = res.result || {};
    if (!result.success) {
      throw new Error(result.error || '操作失败');
    }
    return result.data;
  },

  /**
   * 勾选/取消勾选条目（乐观更新，失败回滚）
   */
  toggleItem: async function (e) {
    const itemId = e.currentTarget.dataset.id;
    const items = this.data.items;
    const index = items.findIndex(item => item.id === itemId);
    if (index < 0) return;

    const oldChecked = !!items[index].checked;
    const newChecked = !oldChecked;

    // 乐观更新 UI
    this.setData({ [`items[${index}].checked`]: newChecked });

    try {
      await this._call({
        action: 'toggleItem',
        listId: this.data.listId,
        itemId,
        checked: newChecked
      });
    } catch (error) {
      console.error('勾选条目失败:', error);
      // 失败回滚
      this.setData({ [`items[${index}].checked`]: oldChecked });
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  /**
   * 打开条目编辑弹窗（点击条目文字）
   */
  openEditModal: function (e) {
    const itemId = e.currentTarget.dataset.id;
    const item = this.data.items.find(it => it.id === itemId);
    if (!item) return;
    this.setData({
      showEditModal: true,
      editingItem: item,
      editingText: item.text,
      saving: false
    });
  },

  /**
   * 关闭条目编辑弹窗
   */
  closeEditModal: function () {
    this.setData({ showEditModal: false, editingItem: null, editingText: '' });
  },

  /**
   * 编辑内容输入
   */
  onEditInput: function (e) {
    this.setData({ editingText: e.detail.value });
  },

  /**
   * 保存条目编辑
   */
  saveEditItem: async function () {
    if (this.data.saving) return;
    const item = this.data.editingItem;
    if (!item) return;

    const text = (this.data.editingText || '').trim();
    if (!text) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }
    if (text === item.text) {
      this.closeEditModal();
      return;
    }

    this.setData({ saving: true });
    try {
      wx.showLoading({ title: '保存中...' });
      await this._call({
        action: 'renameItem',
        listId: this.data.listId,
        itemId: item.id,
        text
      });
      wx.hideLoading();
      this.closeEditModal();
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.loadList();
    } catch (error) {
      wx.hideLoading();
      console.error('保存条目失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  /**
   * 删除条目（弹窗内或行内 × 共用）
   */
  deleteItem: async function (e) {
    const itemId = (e && e.currentTarget && e.currentTarget.dataset.id) || (this.data.editingItem && this.data.editingItem.id);
    if (!itemId) return;

    try {
      wx.showLoading({ title: '删除中...' });
      await this._call({
        action: 'deleteItem',
        listId: this.data.listId,
        itemId
      });
      wx.hideLoading();
      if (this.data.showEditModal) {
        this.closeEditModal();
      }
      wx.showToast({ title: '已删除', icon: 'success' });
      await this.loadList();
    } catch (error) {
      wx.hideLoading();
      console.error('删除条目失败:', error);
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  },

  /**
   * 新条目内容输入
   */
  onNewItemInput: function (e) {
    this.setData({ newItemText: e.detail.value });
  },

  /**
   * 添加条目（即点即存）
   */
  addItem: async function () {
    if (this.data.adding) return;

    const text = (this.data.newItemText || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入条目内容', icon: 'none' });
      return;
    }

    this.setData({ adding: true });
    try {
      await this._call({
        action: 'addItem',
        listId: this.data.listId,
        text
      });
      this.setData({ newItemText: '', adding: false });
      await this.loadList();
    } catch (error) {
      console.error('添加条目失败:', error);
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
      this.setData({ adding: false });
    }
  },

  /**
   * 开启下一轮（清空已勾选条目）
   */
  startNextRound: function () {
    wx.showModal({
      title: '开启下一轮',
      content: '你是否确认结束本轮记录，开启下一轮？',
      confirmColor: '#8B7355',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '处理中...' });
          await this._call({
            action: 'clearChecked',
            listId: this.data.listId
          });
          wx.hideLoading();
          wx.showToast({ title: '已开启新一轮', icon: 'success' });
          await this.loadList();
        } catch (error) {
          wx.hideLoading();
          console.error('开启下一轮失败:', error);
          wx.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
      }
    });
  },

  /**
   * 删除清单（仅家庭创建者可见入口）
   */
  deleteList: function () {
    wx.showModal({
      title: '删除清单',
      content: '确定要删除这个清单吗？删除后无法恢复。',
      confirmColor: '#D9534F',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          await this._call({
            action: 'deleteList',
            listId: this.data.listId
          });
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        } catch (error) {
          wx.hideLoading();
          console.error('删除清单失败:', error);
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});

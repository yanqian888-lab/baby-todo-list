// pages/checklist/index.js
// 宝贝清单列表页（tab 页，卡片手风琴展开，无需跳转详情页）
const app = getApp();
const familyService = require('../../services/familyService');

// 预制模板选项
const PRESET_OPTIONS = [
  { presetId: '', name: '空白清单' },
  { presetId: 'shopping', name: '家庭购物清单' },
  { presetId: 'outing', name: '出门清单' },
  { presetId: 'travel', name: '旅行清单' },
  { presetId: 'hospital', name: '待产包' }
];

Page({
  /**
   * 页面的初始数据
   */
  data: {
    families: [],
    currentFamilyId: null,
    switchingTab: false,
    lists: [],
    isCreator: false,
    loading: true,
    // 当前展开的清单 id（手风琴，同时只展开一个）
    expandedListId: '',
    // 展开卡片底部的新条目输入
    newItemText: '',
    adding: false,
    // 新建清单弹窗
    showCreateModal: false,
    newListName: '',
    selectedPresetId: '',
    presetOptions: PRESET_OPTIONS,
    creating: false,
    // 编辑条目弹窗
    showEditModal: false,
    editingListId: '',
    editingItem: null,
    editingText: '',
    saving: false
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
    this.setData({ hasLoaded: true });
    this.loadFamilyInfo().then(() => {
      this.loadLists();
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
    if (this.data.hasLoaded) {
      this.loadFamilyInfo().then(() => {
        this.loadLists();
      });
    } else {
      this.setData({ hasLoaded: true });
    }
  },

  /**
   * 加载家庭信息并设置当前家庭（与排敏页保持一致的数据源）
   */
  loadFamilyInfo: async function () {
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

      // 优先保留用户当前已选择的家庭
      let currentFamilyId = this.data.currentFamilyId;
      let currentFamily = families.find(f => f._id === currentFamilyId);

      if (!currentFamily) {
        currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
        currentFamily = families.find(f => f._id === currentFamilyId);
      }

      if (!currentFamily) {
        // 首次进入或没有已选家庭时，默认优先展示用户创建的家庭
        if (createdFamilies.length > 0) {
          currentFamily = createdFamilies[0];
        } else if (joinedFamilies.length > 0) {
          currentFamily = joinedFamilies[0];
        }
      }

      if (currentFamily) {
        currentFamilyId = currentFamily._id;
        wx.setStorageSync('currentFamilyId', currentFamilyId);
        this.setData({ families, currentFamilyId });
      } else {
        this.setData({ families, currentFamilyId: null });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 切换家庭 tab
   */
  switchFamilyTab: async function (e) {
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
      // 切换家庭后收起展开项并重新加载清单
      this.setData({ currentFamilyId: familyId, expandedListId: '', newItemText: '' });
      await this.loadLists();
    } catch (error) {
      console.error('切换家庭失败:', error);
      wx.showToast({ title: '切换家庭失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ switchingTab: false });
    }
  },

  /**
   * 加载清单列表（补充进度和预览字段）
   */
  loadLists: async function () {
    const familyId = this.data.currentFamilyId;
    if (!familyId) {
      this.setData({ lists: [], loading: false });
      return;
    }

    try {
      this.setData({ loading: true });
      const res = await wx.cloud.callFunction({
        name: 'checklistManager',
        data: { action: 'getLists', familyId }
      });
      const result = res.result || {};
      if (!result.success) {
        throw new Error(result.error || '获取清单失败');
      }

      const lists = (result.data.lists || []).map(list => this._decorateList(list));

      // 展开的清单可能已被删除，兜底收起
      let expandedListId = this.data.expandedListId;
      if (expandedListId && !lists.find(l => l._id === expandedListId)) {
        expandedListId = '';
      }

      this.setData({
        lists,
        isCreator: !!result.data.isCreator,
        expandedListId,
        loading: false
      });
    } catch (error) {
      console.error('加载清单列表失败:', error);
      this.setData({ loading: false, lists: [] });
      wx.showToast({ title: '加载清单失败', icon: 'none' });
    }
  },

  /**
   * 给清单补充进度等展示字段
   */
  _decorateList: function (list) {
    const items = list.items || [];
    const checkedCount = items.filter(item => item.checked).length;
    return {
      ...list,
      totalCount: items.length,
      checkedCount
    };
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
   * 点击卡片头部，展开/收起（手风琴，同时只展开一个）
   */
  toggleExpand: function (e) {
    const listId = e.currentTarget.dataset.id;
    const expanded = this.data.expandedListId === listId;
    this.setData({
      expandedListId: expanded ? '' : listId,
      newItemText: ''
    });
  },

  /**
   * 勾选/取消勾选条目（乐观更新，失败回滚）
   */
  toggleItem: async function (e) {
    const { listId, itemId } = e.currentTarget.dataset;
    const lists = this.data.lists;
    const listIndex = lists.findIndex(l => l._id === listId);
    if (listIndex < 0) return;
    const itemIndex = lists[listIndex].items.findIndex(item => item.id === itemId);
    if (itemIndex < 0) return;

    const oldChecked = !!lists[listIndex].items[itemIndex].checked;
    const newChecked = !oldChecked;
    const oldCount = lists[listIndex].checkedCount;

    // 乐观更新 UI（勾选状态 + 进度计数）
    const checkedCount = oldCount + (newChecked ? 1 : -1);
    this.setData({
      [`lists[${listIndex}].items[${itemIndex}].checked`]: newChecked,
      [`lists[${listIndex}].checkedCount`]: checkedCount
    });

    try {
      await this._call({ action: 'toggleItem', listId, itemId, checked: newChecked });
    } catch (error) {
      console.error('勾选条目失败:', error);
      // 失败回滚
      this.setData({
        [`lists[${listIndex}].items[${itemIndex}].checked`]: oldChecked,
        [`lists[${listIndex}].checkedCount`]: oldCount
      });
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  /**
   * 打开条目编辑弹窗（点击条目文字）
   */
  openEditModal: function (e) {
    const { listId, itemId } = e.currentTarget.dataset;
    const list = this.data.lists.find(l => l._id === listId);
    if (!list) return;
    const item = (list.items || []).find(it => it.id === itemId);
    if (!item) return;
    this.setData({
      showEditModal: true,
      editingListId: listId,
      editingItem: item,
      editingText: item.text,
      saving: false
    });
  },

  /**
   * 关闭条目编辑弹窗
   */
  closeEditModal: function () {
    this.setData({ showEditModal: false, editingListId: '', editingItem: null, editingText: '' });
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
    const listId = this.data.editingListId;
    if (!item || !listId) return;

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
      await this._call({ action: 'renameItem', listId, itemId: item.id, text });
      wx.hideLoading();
      this.closeEditModal();
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.loadLists();
    } catch (error) {
      wx.hideLoading();
      console.error('保存条目失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  /**
   * 删除条目（行内 × 与编辑弹窗内共用）
   */
  deleteItem: async function (e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const listId = dataset.listId || this.data.editingListId;
    const itemId = dataset.itemId || (this.data.editingItem && this.data.editingItem.id);
    if (!listId || !itemId) return;

    try {
      wx.showLoading({ title: '删除中...' });
      await this._call({ action: 'deleteItem', listId, itemId });
      wx.hideLoading();
      if (this.data.showEditModal) {
        this.closeEditModal();
      }
      wx.showToast({ title: '已删除', icon: 'success' });
      await this.loadLists();
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
  addItem: async function (e) {
    if (this.data.adding) return;

    const listId = e.currentTarget.dataset.listId || this.data.expandedListId;
    const text = (this.data.newItemText || '').trim();
    if (!listId) return;
    if (!text) {
      wx.showToast({ title: '请输入条目内容', icon: 'none' });
      return;
    }

    this.setData({ adding: true });
    try {
      await this._call({ action: 'addItem', listId, text });
      this.setData({ newItemText: '', adding: false });
      await this.loadLists();
    } catch (error) {
      console.error('添加条目失败:', error);
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
      this.setData({ adding: false });
    }
  },

  /**
   * 开启下一轮（清空已勾选条目）
   */
  startNextRound: function (e) {
    const listId = e.currentTarget.dataset.listId;
    if (!listId) return;

    wx.showModal({
      title: '开启下一轮',
      content: '你是否确认结束本轮记录，开启下一轮？',
      confirmColor: '#8B7355',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '处理中...' });
          await this._call({ action: 'clearChecked', listId });
          wx.hideLoading();
          wx.showToast({ title: '已开启新一轮', icon: 'success' });
          await this.loadLists();
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
  deleteList: function (e) {
    const listId = e.currentTarget.dataset.listId;
    if (!listId) return;

    wx.showModal({
      title: '删除清单',
      content: '确定要删除这个清单吗？删除后无法恢复。',
      confirmColor: '#D9534F',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '删除中...' });
          await this._call({ action: 'deleteList', listId });
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadLists();
        } catch (error) {
          wx.hideLoading();
          console.error('删除清单失败:', error);
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 打开新建清单弹窗
   */
  openCreateModal: function () {
    this.setData({
      showCreateModal: true,
      newListName: '',
      selectedPresetId: '',
      creating: false
    });
  },

  /**
   * 关闭新建清单弹窗
   */
  closeCreateModal: function () {
    this.setData({ showCreateModal: false });
  },

  /**
   * 清单名称输入
   */
  onNameInput: function (e) {
    this.setData({ newListName: e.detail.value });
  },

  /**
   * 选择预制模板
   */
  selectPreset: function (e) {
    const presetId = e.currentTarget.dataset.presetId;
    this.setData({ selectedPresetId: presetId });
  },

  /**
   * 创建清单（创建成功后自动展开该清单卡片）
   */
  submitCreate: async function () {
    if (this.data.creating) return;

    const name = (this.data.newListName || '').trim();
    const presetId = this.data.selectedPresetId;

    // 未填名称时，选了模板则用模板名，否则提示
    let finalName = name;
    if (!finalName && presetId) {
      const preset = PRESET_OPTIONS.find(p => p.presetId === presetId);
      finalName = preset ? preset.name : '';
    }
    if (!finalName) {
      wx.showToast({ title: '请输入清单名称', icon: 'none' });
      return;
    }

    const familyId = this.data.currentFamilyId;
    if (!familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' });
      return;
    }

    this.setData({ creating: true });
    try {
      wx.showLoading({ title: '创建中...' });
      const data = { action: 'createList', familyId, name: finalName };
      if (presetId) {
        data.presetId = presetId;
      }
      const res = await wx.cloud.callFunction({
        name: 'checklistManager',
        data
      });
      const result = res.result || {};
      if (!result.success) {
        throw new Error(result.error || '创建失败');
      }

      wx.hideLoading();
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreateModal: false, creating: false });
      await this.loadLists();

      // 创建成功后自动展开新清单卡片（优先用返回值里的 id，兜底按名称匹配最后一个）
      const d = result.data || {};
      let newListId = (d.list && d.list._id) || d._id || d.listId || '';
      if (!newListId) {
        const matched = this.data.lists.filter(l => l.name === finalName);
        if (matched.length > 0) {
          newListId = matched[matched.length - 1]._id;
        }
      }
      if (newListId) {
        this.setData({ expandedListId: newListId, newItemText: '' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('创建清单失败:', error);
      wx.showToast({ title: '创建失败，请重试', icon: 'none' });
      this.setData({ creating: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadLists().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});

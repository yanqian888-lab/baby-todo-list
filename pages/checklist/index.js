// pages/checklist/index.js
// 宝贝清单列表页（tab 页，卡片手风琴展开，无需跳转详情页）
const app = getApp();
const familyService = require('../../services/familyService');

// 预制模板选项
const PRESET_OPTIONS = [
  { presetId: '', name: '空白清单' },
  { presetId: 'shopping', name: '家庭购物清单' },
  { presetId: 'hospital', name: '孕妈待产包' },
  { presetId: 'home', name: '新生儿居家清单' },
  { presetId: 'outing', name: '日常出门随身包' },
  { presetId: 'travel', name: '短途过夜旅行清单' },
  { presetId: 'weaning', name: '辅食必备工具' }
];

// 默认清单数据（未登录或新用户首次进入时展示）
const DEFAULT_LISTS = [
  {
    _id: 'default-shopping',
    name: '家庭购物清单',
    items: [
      { id: 'd1', text: '纸尿裤（NB/S码）', checked: false },
      { id: 'd2', text: '婴儿湿巾', checked: false },
      { id: 'd3', text: '配方奶粉', checked: false },
      { id: 'd4', text: '宝宝护臀膏', checked: false },
      { id: 'd5', text: '婴儿洗衣液', checked: true }
    ]
  },
  {
    _id: 'default-outing',
    name: '日常出门随身包',
    items: [
      { id: 'd6', text: '纸尿裤 ×3', checked: false },
      { id: 'd7', text: '便携湿巾', checked: false },
      { id: 'd8', text: '奶瓶+奶粉盒', checked: false },
      { id: 'd9', text: '换洗衣物一套', checked: false },
      { id: 'd10', text: '安抚奶嘴/玩具', checked: false }
    ]
  },
  {
    _id: 'default-weaning',
    name: '辅食必备工具',
    items: [
      { id: 'd11', text: '硅胶软勺', checked: false },
      { id: 'd12', text: '辅食研磨碗', checked: false },
      { id: 'd13', text: '防水围嘴', checked: false },
      { id: 'd14', text: '辅食储存盒', checked: true }
    ]
  }
];

/**
 * 获取装饰后的默认清单（补充 totalCount / checkedCount 字段）
 * @returns {Array} 装饰后的默认清单数组
 */
function getDefaultLists() {
  return DEFAULT_LISTS.map(list => {
    const items = list.items || [];
    const checkedCount = items.filter(item => item.checked).length;
    return {
      ...list,
      totalCount: items.length,
      checkedCount
    };
  });
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    families: [],
    currentFamilyId: null,
    switchingTab: false,
    isLoggedIn: false,
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
    saving: false,
    // 宝宝信息表单（未创建/加入家庭时展示）
    showBabyInfoForm: false,
    babyInfoForm: {
      nickname: '',
      birthday: '',
      gender: 'boy'
    },
    showJoinFamilyModal: false,
    inviteCode: '',
    startDate: '2020-01-01',
    pickerEndDate: new Date().toISOString().split('T')[0]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    const userService = require('../../services/userService');
    if (!userService.checkLoginStatus()) {
      this.setData({ isLoggedIn: false, loading: false, lists: getDefaultLists() });
      return;
    }
    this.setData({ hasLoaded: true, isLoggedIn: true });
    this._initializing = true;
    this.loadFamilyInfo()
      .then(() => this.checkBabyInfoComplete())
      .finally(() => {
        this._initializing = false;
        this._lastLoadTime = Date.now();
      });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    const userService = require('../../services/userService');
    const wasLoggedIn = this.data.isLoggedIn;
    const isLoggedIn = userService.checkLoginStatus();
    this.setData({ isLoggedIn });
    if (!isLoggedIn) {
      this.setData({ loading: false, lists: getDefaultLists() });
      return;
    }
    // 如果之前未登录，现在已登录（刚从登录页返回），执行完整初始化
    if (!wasLoggedIn) {
      this.setData({ hasLoaded: true });
      this._initializing = true;
      this.loadFamilyInfo()
        .then(() => this.checkBabyInfoComplete())
        .finally(() => {
          this._initializing = false;
          this._lastLoadTime = Date.now();
        });
      return;
    }
    if (this._initializing) {
      return;
    }
    if (this.data.hasLoaded) {
      // 数据新鲜度检查：30 秒内不重复加载
      const now = Date.now();
      if (this._lastLoadTime && now - this._lastLoadTime < 30000) {
        return;
      }
      this._lastLoadTime = now;
      this.loadFamilyInfo().then(() => {
        this.checkBabyInfoComplete();
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

      // 优先使用 storage 中用户当前选择的家庭（与首页保持一致）
      let currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId || null;
      let currentFamily = families.find(f => f._id === currentFamilyId);

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
        wx.removeStorageSync('currentFamilyId');
        this.setData({ families, currentFamilyId: null });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  /**
   * 检查宝宝信息是否完整：无家庭时显示宝宝信息表单，有家庭时加载清单
   */
  checkBabyInfoComplete: function() {
    const families = this.data.families || [];

    if (families.length > 0) {
      this.setData({ showBabyInfoForm: false, loading: false });
      this.loadLists();
      return;
    }

    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const babyInfo = userInfo.babyInfo || wx.getStorageSync('babyInfo') || {};
    const isComplete = babyInfo.nickname && babyInfo.birthday;

    if (!isComplete) {
      this.setData({
        showBabyInfoForm: true,
        loading: false,
        lists: [],
        babyInfoForm: {
          nickname: babyInfo.nickname || '',
          birthday: babyInfo.birthday || '',
          gender: babyInfo.gender || 'boy'
        }
      });
    } else {
      this.setData({ showBabyInfoForm: false, loading: false });
      this.loadLists();
    }
  },

  /**
   * 宝宝昵称输入
   */
  onNicknameInput: function(e) {
    this.setData({ 'babyInfoForm.nickname': e.detail.value });
  },

  /**
   * 宝宝生日选择
   */
  onBirthdayChange: function(e) {
    this.setData({ 'babyInfoForm.birthday': e.detail.value });
  },

  /**
   * 宝宝性别选择
   */
  onGenderChange: function(e) {
    this.setData({ 'babyInfoForm.gender': e.currentTarget.dataset.gender });
  },

  /**
   * 保存宝宝信息并自动创建家庭
   */
  saveBabyInfo: async function() {
    const { babyInfoForm } = this.data;
    if (!babyInfoForm.nickname || !babyInfoForm.nickname.trim()) {
      wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
      return;
    }
    if (!babyInfoForm.birthday) {
      wx.showToast({ title: '请选择宝宝生日', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const userId = userInfo.openId || userInfo.openid || userInfo.openID || '';
      if (!userId) {
        wx.hideLoading();
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      const babyData = {
        userId,
        nickname: babyInfoForm.nickname.trim(),
        birthday: babyInfoForm.birthday,
        gender: babyInfoForm.gender,
        safeFoodsList: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 保存到 babyManager
      try {
        const saveRes = await wx.cloud.callFunction({
          name: 'babyManager',
          data: { action: 'saveBabyInfo', babyInfo: babyData }
        });
        if (saveRes.result && saveRes.result.success && saveRes.result.babyId) {
          babyData._id = saveRes.result.babyId;
        }
      } catch (bmErr) {
        console.warn('babyManager 保存失败，回退本地:', bmErr);
      }

      wx.setStorageSync('babyInfo', babyData);
      app.globalData.userInfo = app.globalData.userInfo || {};
      app.globalData.userInfo.babyInfo = babyData;
      app.globalData.userInfo.babyName = babyData.nickname;
      const storedUserInfo = wx.getStorageSync('userInfo') || {};
      storedUserInfo.babyInfo = babyData;
      storedUserInfo.babyName = babyData.nickname;
      wx.setStorageSync('userInfo', storedUserInfo);

      // 自动创建家庭
      const familyResult = await familyService.getMyFamilies();
      const hasFamily = familyResult.hasFamily || (familyResult.families && familyResult.families.length > 0);
      if (!hasFamily) {
        await familyService.createFamily(
          `${babyData.nickname}的家`,
          { nickname: babyData.nickname, gender: babyData.gender, birthday: babyData.birthday }
        );
      }

      // 刷新家庭信息并加载清单
      await this.loadFamilyInfo();
      this.setData({ showBabyInfoForm: false });
      this.loadLists();
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.error('保存宝宝信息失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /**
   * 显示加入家庭弹窗
   */
  showJoinFamilyModal: function() {
    this.setData({ showJoinFamilyModal: true, inviteCode: '' });
  },

  /**
   * 隐藏加入家庭弹窗
   */
  hideJoinFamilyModal: function() {
    this.setData({ showJoinFamilyModal: false, inviteCode: '' });
  },

  /**
   * 邀请码输入
   */
  onInviteCodeChange: function(e) {
    this.setData({ inviteCode: e.detail.value.trim().toUpperCase() });
  },

  /**
   * 通过邀请码加入家庭
   */
  joinFamilyByInviteCode: async function() {
    const code = this.data.inviteCode;
    if (!code || code.length !== 6 || !/^[A-Z0-9]{6}$/i.test(code)) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '加入中...' });
      const result = await wx.cloud.callFunction({
        name: 'familyManager',
        data: { action: 'joinFamily', inviteCode: code }
      });

      if (result.result && result.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' });
        this.hideJoinFamilyModal();
        const familyId = result.result.familyId;
        if (familyId) {
          wx.setStorageSync('currentFamilyId', familyId);
          if (app && app.globalData) {
            app.globalData.currentFamilyId = familyId;
          }
        }
        familyService.clearCache();
        await this.loadFamilyInfo();
        this.setData({ showBabyInfoForm: false });
        this.loadLists();
      } else {
        wx.showToast({ title: result.result?.error || '加入失败', icon: 'none' });
      }
    } catch (error) {
      console.error('加入家庭失败:', error);
      wx.showToast({ title: '加入失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
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

      const cloudLists = (result.data.lists || []).map(list => this._decorateList(list));

      // 云端无清单时展示空状态
      const lists = cloudLists;

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
   * 判断是否为默认清单（非云端真实数据）
   * @param {string} listId - 清单ID
   * @returns {boolean} 是否为默认清单
   */
  _isDefaultList: function (listId) {
    return listId && typeof listId === 'string' && listId.indexOf('default-') === 0;
  },

  /**
   * 将默认清单持久化为云端真实清单，返回新清单列表
   * @returns {Promise<Array>} 创建后的清单列表
   */
  _persistDefaultLists: async function () {
    const familyId = this.data.currentFamilyId;
    if (!familyId) return null;

    for (const preset of DEFAULT_LISTS) {
      const presetId = preset._id.replace('default-', '');
      try {
        await wx.cloud.callFunction({
          name: 'checklistManager',
          data: { action: 'createList', familyId, name: preset.name, presetId }
        });
      } catch (e) {
        console.error('创建默认清单失败:', preset.name, e);
      }
    }
    // 重新加载云端清单
    await this.loadLists();
    return this.data.lists;
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
    if (!require('../../services/userService').requireLogin()) return;
    const { listId, itemId } = e.currentTarget.dataset;
    // 默认清单需先持久化到云端再操作
    if (this._isDefaultList(listId)) {
      wx.showLoading({ title: '创建中...' });
      await this._persistDefaultLists();
      wx.hideLoading();
      wx.showToast({ title: '已创建你的清单', icon: 'success' });
      return;
    }
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
    if (!require('../../services/userService').requireLogin()) return;
    const { listId, itemId } = e.currentTarget.dataset;
    if (this._isDefaultList(listId)) {
      wx.showToast({ title: '请先创建自己的清单', icon: 'none' });
      return;
    }
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
    if (!require('../../services/userService').requireLogin()) return;
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const listId = dataset.listId || this.data.editingListId;
    if (this._isDefaultList(listId)) {
      wx.showToast({ title: '请先创建自己的清单', icon: 'none' });
      return;
    }
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
    if (!require('../../services/userService').requireLogin()) return;
    if (this.data.adding) return;

    const listId = e.currentTarget.dataset.listId || this.data.expandedListId;
    // 默认清单需先持久化到云端再操作
    if (this._isDefaultList(listId)) {
      wx.showLoading({ title: '创建中...' });
      await this._persistDefaultLists();
      wx.hideLoading();
      wx.showToast({ title: '已创建你的清单', icon: 'success' });
      return;
    }
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
    if (!require('../../services/userService').requireLogin()) return;
    const listId = e.currentTarget.dataset.listId;
    if (this._isDefaultList(listId)) {
      wx.showToast({ title: '请先创建自己的清单', icon: 'none' });
      return;
    }
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
    if (!require('../../services/userService').requireLogin()) return;
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
    if (!require('../../services/userService').requireLogin()) return;
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
    if (!require('../../services/userService').requireLogin()) return;
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
  },

  /**
   * 跳转登录页
   */
  goToLogin: function() {
    require('../../services/userService').requireLogin();
  }
});

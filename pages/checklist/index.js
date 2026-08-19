// pages/checklist/index.js
// 宝贝清单列表页（tab 页）
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
    // 新建清单弹窗
    showCreateModal: false,
    newListName: '',
    selectedPresetId: '',
    presetOptions: PRESET_OPTIONS,
    creating: false
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
      this.setData({ currentFamilyId: familyId });
      // 切换家庭后重新加载清单
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
   * 加载清单列表
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

      // 补充进度和预览字段
      const lists = (result.data.lists || []).map(list => {
        const items = list.items || [];
        const checkedCount = items.filter(item => item.checked).length;
        const previewTexts = items
          .filter(item => !item.checked)
          .slice(0, 3)
          .map(item => item.text);
        return {
          ...list,
          totalCount: items.length,
          checkedCount,
          previewTexts
        };
      });

      this.setData({
        lists,
        isCreator: !!result.data.isCreator,
        loading: false
      });
    } catch (error) {
      console.error('加载清单列表失败:', error);
      this.setData({ loading: false, lists: [] });
      wx.showToast({ title: '加载清单失败', icon: 'none' });
    }
  },

  /**
   * 进入清单详情页
   */
  goDetail: function (e) {
    const listId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/checklist/detail?id=${listId}`
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
   * 创建清单
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

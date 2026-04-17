// pages/ai-master/index.js
// 注意：由于腾讯云 AI+ Agent 自动部署存在已知 Bug，此处改用自建 aiChat 云函数调用混元大模型

const familyService = require('../../services/familyService');

function generateId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    agentInfo: {
      name: '宝妈陪伴师',
      avatar: '',
      introduction: '温柔、安全、不评判、24小时在线，只站在妈妈这边',
      welcomeMessage: '你好呀~ 我是你的专属带娃伙伴萌小暖～\n无论是育儿方法还是情绪问题，我都能给您最贴心的陪伴和科学实用的建议哦~'
    },
    userInfo: {
      avatarUrl: ''
    },
    babyInfo: null,
    messages: [],
    inputValue: '',
    hasInput: false,
    loading: false,
    scrollToMessage: '',
    quickQuestions: [
      '宝宝该做什么早教了？',
      '宝宝夜醒频繁怎么办？',
      '宝宝厌奶怎么办？'
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */


  onLoad: function (options) {
    this.loadUserInfo();
    this.loadBabyInfo();
  },

  onShow: function () {
    this.loadBabyInfo();
  },

  /**
   * 加载宝宝信息
   */
  loadBabyInfo: async function () {
    try {
      const result = await familyService.getMyFamilies();
      const families = result.families || [];
      const currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId;
      const currentFamily = families.find(f => f._id === currentFamilyId) || families[0];
      
      if (currentFamily && currentFamily.babyInfo) {
        const babyInfo = currentFamily.babyInfo;
        const ageInMonths = this.calculateAgeInMonths(babyInfo.birthday);
        this.setData({
          babyInfo: {
            nickname: babyInfo.nickname || '宝宝',
            gender: babyInfo.gender || 'unknown',
            birthday: babyInfo.birthday || '',
            ageInMonths: ageInMonths
          }
        });
      }
    } catch (err) {
      console.error('加载宝宝信息失败:', err);
    }
  },

  /**
   * 根据生日计算月龄
   */
  calculateAgeInMonths: function (birthday) {
    if (!birthday) return null;
    const birth = new Date(birthday);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const days = now.getDate() - birth.getDate();
    let totalMonths = years * 12 + months;
    if (days < 0) {
      totalMonths -= 1;
    }
    return totalMonths >= 0 ? totalMonths : 0;
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: function () {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      'userInfo.avatarUrl': userInfo.avatarUrl || ''
    });
  },

  /**
   * 输入框内容变化
   */
  onInput: function (e) {
    const value = e.detail.value || '';
    this.setData({ inputValue: value, hasInput: !!(value && value.trim()) });
  },

  /**
   * 发送快捷问题
   */
  sendQuickQuestion: function (e) {
    const question = e.currentTarget.dataset.question;
    this.setData({ inputValue: question, hasInput: true });
    this.sendTextMessage();
  },

  /**
   * 发送文本消息
   */
  sendTextMessage: async function () {
    const { inputValue, loading } = this.data;
    let text = inputValue.trim();
    if (!text || loading) return;

    // 如果知道月龄且问题里没提，自动拼到问题前（双重保险）
    if (this.data.babyInfo && this.data.babyInfo.ageInMonths !== null && this.data.babyInfo.ageInMonths !== undefined) {
      if (!text.match(/\d+[\s-]*(?:个月|月龄|月)/)) {
        text = `我家宝宝现在${this.data.babyInfo.ageInMonths}个月，${text}`;
      }
    }

    // 添加用户消息（显示原文，不传拼接后的，避免用户看到奇怪的前缀）
    const userMsgId = generateId();
    const displayText = inputValue.trim();
    const messages = this.data.messages.concat([
      { id: userMsgId, role: 'user', type: 'text', content: displayText }
    ]);
    this.setData({ messages, inputValue: '', hasInput: false, loading: true });
    this.scrollToBottom();

    // 构建历史记录
    const history = this.buildHistory(messages.slice(0, -1));

    // 调用 AI（传拼接后的 text）
    await this.callAI({ msg: text, history, babyInfo: this.data.babyInfo });
  },

  /**
   * 选择图片
   */
  chooseImage: async function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        await this.sendImageMessage(tempFilePath);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          return;
        }
        console.error('选择图片失败:', err);
      }
    });
  },

  /**
   * 发送图片消息
   */
  sendImageMessage: async function (tempFilePath) {
    const { loading } = this.data;
    if (loading) return;

    this.setData({ loading: true });

    // 添加用户图片消息（先显示本地图片）
    const userMsgId = generateId();
    const messages = this.data.messages.concat([
      { id: userMsgId, role: 'user', type: 'image', content: tempFilePath }
    ]);
    this.setData({ messages });
    this.scrollToBottom();

    try {
      // 上传图片到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ai-master/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.jpg`,
        filePath: tempFilePath
      });

      const fileID = uploadRes.fileID;

      // 更新消息中的 fileID 和显示内容
      const msgIndex = messages.findIndex(m => m.id === userMsgId);
      if (msgIndex !== -1) {
        messages[msgIndex].fileID = fileID;
        messages[msgIndex].content = fileID;
      }
      this.setData({ messages: [...messages] });

      // 构建历史记录
      const history = this.buildHistory(messages.slice(0, -1));

      // 调用 AI，传入图片
      await this.callAI({ msg: '请帮我看看这张图片', history, fileID, babyInfo: this.data.babyInfo });
    } catch (err) {
      console.error('图片上传或发送失败:', err);
      wx.showToast({ title: '图片发送失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 构建历史记录
   */
  buildHistory: function (messages) {
    return messages
      .filter(m => m.type === 'text' || !m.type)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'bot',
        content: m.content
      }));
  },

  /**
   * 调用 AI（通过 aiChat 云函数）
   */
  callAI: async function ({ msg, history = [], fileID = '', babyInfo = null }) {
    console.log('[ai-master] callAI msg:', msg, 'babyInfo:', JSON.stringify(babyInfo));
    const botMsgId = generateId();

    // 添加 AI 占位消息（加载中）
    const messages = this.data.messages.concat([
      { id: botMsgId, role: 'bot', type: 'text', content: '', typing: true }
    ]);
    this.setData({ messages, loading: true });
    this.scrollToBottom();

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'aiChat',
        data: {
          msg,
          history,
          fileID,
          babyInfo
        }
      });
      console.log('[ai-master] callAI result code:', result.code);

      if (result.code !== 0) {
        throw new Error(result.error || 'AI 调用失败');
      }

      const fullText = result.content || '';

      // 停止 loading 动画，开始打字机效果
      this.setData({ loading: false });
      this.typeWriter(botMsgId, fullText);

    } catch (err) {
      console.error('AI 调用失败:', err);
      this.updateBotMessage(botMsgId, '抱歉，我暂时无法回答，请稍后再试~', false);
      wx.showToast({ title: '请求失败，请重试', icon: 'none' });
      this.setData({ loading: false });
      this.scrollToBottom();
    }
  },

  /**
   * 打字机效果
   */
  typeWriter: function (msgId, content) {
    let displayed = '';
    const step = 2; // 每次显示 2 个字符
    const interval = 30; // 每 30ms 一次

    const timer = setInterval(() => {
      if (displayed.length >= content.length) {
        clearInterval(timer);
        this.updateBotMessage(msgId, content, false);
        return;
      }
      displayed = content.slice(0, displayed.length + step);
      this.updateBotMessage(msgId, displayed, true);
    }, interval);
  },

  /**
   * 更新 AI 消息内容
   */
  updateBotMessage: function (msgId, content, typing) {
    const messages = this.data.messages.map(m => {
      if (m.id === msgId) {
        return { ...m, content, typing };
      }
      return m;
    });
    this.setData({ messages });
    if (!typing) {
      this.scrollToBottom();
    }
  },

  /**
   * 滚动到底部
   */
  scrollToBottom: function () {
    const messages = this.data.messages;
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      this.setData({ scrollToMessage: `msg-${lastMsg.id}` });
    } else {
      this.setData({ scrollToMessage: 'msg-footer' });
    }
  },

  /**
   * 预览图片
   */
  previewImage: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  /**
   * 分享
   */
  onShareAppMessage: function () {
    return {
      title: 'AI育儿大师 - 您的专属育儿陪伴专家',
      path: '/pages/ai-master/index'
    };
  }
});

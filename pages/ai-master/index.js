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
      // 方法1: 从家庭数据中获取
      const result = await familyService.getMyFamilies();
      const families = result.families || [];
      const currentFamilyId = wx.getStorageSync('currentFamilyId') || result.currentFamilyId;
      const currentFamily = families.find(f => f._id === currentFamilyId) || families[0];
      
      if (currentFamily && currentFamily.babyInfo && currentFamily.babyInfo.nickname) {
        const babyInfo = currentFamily.babyInfo;
        const ageInMonths = this.calculateAgeInMonths(babyInfo.birthday);
        console.log('[ai-master] 从家庭数据获取宝宝信息:', babyInfo.nickname, ageInMonths + '个月');
        this.setData({
          babyInfo: {
            nickname: babyInfo.nickname || '宝宝',
            gender: babyInfo.gender || 'unknown',
            birthday: babyInfo.birthday || '',
            ageInMonths: ageInMonths
          }
        });
        return;
      }
      
      // 方法2: 从本地存储的 userInfo 中获取
      const userInfo = wx.getStorageSync('userInfo') || {};
      if (userInfo.babyInfo && userInfo.babyInfo.nickname) {
        const babyInfo = userInfo.babyInfo;
        const ageInMonths = this.calculateAgeInMonths(babyInfo.birthday);
        console.log('[ai-master] 从本地存储获取宝宝信息:', babyInfo.nickname, ageInMonths + '个月');
        this.setData({
          babyInfo: {
            nickname: babyInfo.nickname || '宝宝',
            gender: babyInfo.gender || 'unknown',
            birthday: babyInfo.birthday || '',
            ageInMonths: ageInMonths
          }
        });
        return;
      }
      
      // 方法3: 从全局 app.globalData 中获取
      const app = getApp();
      if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.babyInfo) {
        const babyInfo = app.globalData.userInfo.babyInfo;
        if (babyInfo.nickname) {
          const ageInMonths = this.calculateAgeInMonths(babyInfo.birthday);
          console.log('[ai-master] 从全局数据获取宝宝信息:', babyInfo.nickname, ageInMonths + '个月');
          this.setData({
            babyInfo: {
              nickname: babyInfo.nickname || '宝宝',
              gender: babyInfo.gender || 'unknown',
              birthday: babyInfo.birthday || '',
              ageInMonths: ageInMonths
            }
          });
          return;
        }
      }
      
      console.log('[ai-master] 未找到宝宝信息，将使用默认值');
    } catch (err) {
      console.error('[ai-master] 加载宝宝信息失败:', err);
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
    const { inputValue, loading, babyInfo } = this.data;
    let text = inputValue.trim();
    if (!text || loading) return;

    console.log('[ai-master] sendTextMessage babyInfo:', JSON.stringify(babyInfo));
    
    // 如果知道月龄且问题里没提，自动拼到问题前（双重保险）
    if (babyInfo && babyInfo.ageInMonths !== null && babyInfo.ageInMonths !== undefined) {
      if (!text.match(/\d+[\s-]*(?:个月|月龄|月)/)) {
        text = `我家宝宝现在${babyInfo.ageInMonths}个月，${text}`;
        console.log('[ai-master] 已添加月龄信息到消息:', text);
      }
    } else {
      console.warn('[ai-master] babyInfo.ageInMonths 为空，无法添加月龄信息');
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
  callAI: async function ({ msg, history = [], babyInfo = null }) {
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
          babyInfo
        }
      });
      console.log('[ai-master] callAI result code:', result.code);

      if (result.code !== 0) {
        throw new Error(result.error || 'AI 调用失败');
      }

      const fullText = result.content || '';

      // 空内容兜底，避免渲染空白 AI 消息
      if (!fullText) {
        this.updateBotMessage(botMsgId, '未获取到回复，请稍后重试~', false);
        this.setData({ loading: false });
        this.scrollToBottom();
        return;
      }

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

    // 清理上一次未完成的打字机定时器
    if (this.typeWriterTimer) {
      clearInterval(this.typeWriterTimer);
      this.typeWriterTimer = null;
    }

    const timer = setInterval(() => {
      if (displayed.length >= content.length) {
        clearInterval(timer);
        this.typeWriterTimer = null;
        this.updateBotMessage(msgId, content, false);
        return;
      }
      displayed = content.slice(0, displayed.length + step);
      this.updateBotMessage(msgId, displayed, true);
    }, interval);
    this.typeWriterTimer = timer;
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    if (this.typeWriterTimer) {
      clearInterval(this.typeWriterTimer);
      this.typeWriterTimer = null;
    }
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
   * 分享
   */
  onShareAppMessage: function () {
    return {
      title: 'AI育儿大师 - 您的专属育儿陪伴专家',
      path: '/pages/ai-master/index'
    };
  }
});

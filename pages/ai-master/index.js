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
    this._babyInfoReady = this.loadBabyInfo();
    this.loadMessages();
  },

  onShow: function () {
    this._babyInfoReady = this.loadBabyInfo();
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
      let currentFamily = families.find(f => f._id === currentFamilyId);
      if (!currentFamily && families.length > 0) {
        // 兜底时与其他页面保持一致：优先用户自己创建的家庭
        const userInfo = wx.getStorageSync('userInfo') || {};
        const currentOpenId = userInfo.openId || userInfo._id || userInfo.openid || userInfo.openID || '';
        currentFamily = families.find(f => (f.creatorOpenId || f.creator || f.ownerOpenId) === currentOpenId) || families[0];
      }
      
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
    const { inputValue, loading } = this.data;
    let text = inputValue.trim();
    if (!text || loading) return;

    // 等待宝宝信息加载完成（页面打开后立即点快捷问题时 babyInfo 可能还没就绪）
    try {
      await this._babyInfoReady;
    } catch (e) { /* 加载失败不阻断发送 */ }
    const babyInfo = this.data.babyInfo;

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
    this.saveMessages(); // 用户消息持久化

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
   * 调用 AI
   * 优先使用 aiChatStream HTTP 云函数走 SSE 真流式（基础库 3.15.1+）；
   * 不支持或调用失败时回退到 aiChat 普通云函数（非流式 + 打字机效果）
   */
  callAI: async function ({ msg, history = [], babyInfo = null }) {
    console.log('[ai-master] callAI msg:', msg, 'babyInfo:', JSON.stringify(babyInfo));
    const botMsgId = generateId();

    // 基础库 3.15.1+ 才支持 wx.cloud.callHTTPFunction
    const supportStream = !!(wx.cloud && typeof wx.cloud.callHTTPFunction === 'function');

    // 添加 AI 占位消息（加载中）
    // 流式路径先显示「正在思考...」占位：模型会先输出思考过程（服务端已丢弃），正文到达后替换占位
    const messages = this.data.messages.concat([
      { id: botMsgId, role: 'bot', type: 'text', content: supportStream ? '正在思考...' : '', typing: true }
    ]);
    this.setData({ messages, loading: true });
    this.scrollToBottom();

    if (supportStream) {
      const ok = await this.callAIStream(botMsgId, { msg, history, babyInfo });
      if (ok) return;
      // 流式调用失败（如函数未部署、网络异常），回退到非流式路径
      console.warn('[ai-master] 流式调用失败，回退到 aiChat 云函数');
    }

    await this.callAINonStream(botMsgId, { msg, history, babyInfo });
  },

  /**
   * 流式调用 AI（SSE，通过 aiChatStream HTTP 云函数）
   * @returns {Promise<boolean>} true=流式路径已处理完毕；false=需要回退到非流式
   */
  callAIStream: function (botMsgId, { msg, history, babyInfo }) {
    return new Promise((resolve) => {
      let sseBuffer = '';          // SSE 帧文本缓冲（chunk 可能截断在半行）
      let byteRemainder = new Uint8Array(0); // UTF-8 多字节字符可能跨 chunk 截断，保留未解码字节
      let botContent = '';         // 已收到的正文内容
      let done = false;            // 是否已收到 [DONE]
      let finished = false;        // 是否已走完整束流程（防重复 resolve）

      // 把 chunk 的 ArrayBuffer 解码成字符串（官方文档的 decodeURIComponent(escape(...)) 方式，
      // 额外处理多字节 UTF-8 字符跨 chunk 截断的情况，避免丢字/乱码）
      const decodeChunk = (arrayBuffer) => {
        const cur = new Uint8Array(arrayBuffer);
        const bytes = new Uint8Array(byteRemainder.length + cur.length);
        bytes.set(byteRemainder);
        bytes.set(cur, byteRemainder.length);
        // 最多回退 3 个字节（一个 UTF-8 中文字符 3 字节），尝试完整解码
        for (let end = bytes.length; end >= Math.max(bytes.length - 3, 0); end--) {
          try {
            let binary = '';
            const STEP = 0x8000; // 分段拼接，避免 apply 参数过多导致栈溢出
            for (let i = 0; i < end; i += STEP) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + STEP, end)));
            }
            const text = decodeURIComponent(escape(binary));
            byteRemainder = bytes.subarray(end);
            return text;
          } catch (e) { /* 末尾是半截多字节字符，回退一字节重试 */ }
        }
        // 极端异常：丢弃本次字节，避免死循环
        byteRemainder = new Uint8Array(0);
        return '';
      };

      // 流结束（收到 [DONE] 或连接正常关闭）：定稿消息并持久化
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this._unloaded) { resolve(true); return; }
        if (!botContent) {
          this.updateBotMessage(botMsgId, '未获取到回复，请稍后重试~', false);
        } else {
          this.updateBotMessage(botMsgId, botContent, false);
        }
        this.setData({ loading: false });
        this.scrollToBottom();
        resolve(true);
      };

      // 服务端错误帧：显示兜底文案，不再回退（服务端已给出明确错误）
      const handleErrorFrame = (errText) => {
        if (finished) return;
        finished = true;
        if (this._unloaded) { resolve(true); return; }
        this.updateBotMessage(botMsgId, errText || '抱歉，我暂时无法回答，请稍后再试~', false);
        this.setData({ loading: false });
        this.scrollToBottom();
        resolve(true);
      };

      // 解析缓冲区中完整的 SSE 帧（以 \n\n 分隔），半截帧留在缓冲区
      const parseFrames = () => {
        const frames = sseBuffer.split('\n\n');
        sseBuffer = frames.pop(); // 最后一段可能不完整，留到下个 chunk
        for (const frame of frames) {
          const lines = frame.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === '[DONE]') {
              finish();
              return true;
            }
            let obj;
            try {
              obj = JSON.parse(payload);
            } catch (e) {
              console.warn('[ai-master] SSE 帧 JSON 解析失败，跳过:', payload.slice(0, 50));
              continue;
            }
            if (obj.error) {
              handleErrorFrame(obj.error);
              return true;
            }
            // 逐块正文 {"delta":"..."}；快速回复路径一次性 {"content":"..."}
            const piece = obj.delta !== undefined ? obj.delta : (obj.content || '');
            if (!piece) continue;
            botContent += piece;
            this.appendBotMessage(botMsgId, botContent);
          }
        }
        return false;
      };

      wx.cloud.callHTTPFunction({
        name: 'aiChatStream',
        path: '/chat',
        method: 'POST',
        data: { msg, history, babyInfo },
        enableChunked: true,
        onChunkedReceived: (res) => {
          if (finished) return;
          try {
            sseBuffer += decodeChunk(res.data);
            parseFrames();
          } catch (e) {
            console.error('[ai-master] SSE 解析异常:', e);
          }
        },
        success: () => {
          // HTTP 连接正常结束：处理缓冲区残余（理论上 [DONE] 已先到）
          if (!finished) {
            try { parseFrames(); } catch (e) { /* 忽略残余解析失败 */ }
            finish();
          }
        },
        fail: (err) => {
          console.warn('[ai-master] callHTTPFunction 调用失败:', err);
          resolve(false); // 交回 callAI 回退到非流式路径
        }
      });
    });
  },

  /**
   * 非流式调用 AI（通过 aiChat 云函数，旧路径兜底）
   */
  callAINonStream: async function (botMsgId, { msg, history = [], babyInfo = null }) {
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
   * 流式场景下增量更新 AI 消息内容（只更新单条消息的 content，避免整组 setData 开销）
   */
  appendBotMessage: function (msgId, content) {
    if (this._unloaded) return;
    const idx = this.data.messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    const update = {};
    update[`messages[${idx}].content`] = content;
    this.setData(update);
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
      // 上一条消息未打完，先一次性补全，避免半截内容被持久化
      if (this._typingMsgId) {
        this.updateBotMessage(this._typingMsgId, this._typingFullText, false);
      }
    }

    // 记录当前正在打字的消息，供下一段打字开始时补全
    this._typingMsgId = msgId;
    this._typingFullText = content;

    const timer = setInterval(() => {
      if (displayed.length >= content.length) {
        clearInterval(timer);
        this.typeWriterTimer = null;
        this._typingMsgId = null;
        this._typingFullText = null;
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
    // 标记页面已卸载：流式回调到达时不再 setData（记录已在下方持久化）
    this._unloaded = true;
    if (this.typeWriterTimer) {
      clearInterval(this.typeWriterTimer);
      this.typeWriterTimer = null;
      // 打字中途退出，保存当前已显示的内容
      this.saveMessages();
    }
  },

  /**
   * 从本地存储恢复聊天记录
   */
  loadMessages: function () {
    try {
      const saved = wx.getStorageSync('ai_chat_history');
      if (Array.isArray(saved) && saved.length > 0) {
        this.setData({ messages: saved });
        // 等待渲染完成后滚到底部
        setTimeout(() => this.scrollToBottom(), 100);
      }
    } catch (e) {
      console.warn('[ai-master] 恢复聊天记录失败:', e);
    }
  },

  /**
   * 保存聊天记录到本地存储（最多保留最近 100 条，去掉打字中状态）
   */
  saveMessages: function () {
    try {
      const messages = this.data.messages
        .map(m => ({ ...m, typing: false }))
        .slice(-100);
      wx.setStorageSync('ai_chat_history', messages);
    } catch (e) {
      console.warn('[ai-master] 保存聊天记录失败:', e);
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
      this.saveMessages(); // 消息定稿后持久化
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

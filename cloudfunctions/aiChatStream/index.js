// cloudfunctions/aiChatStream/index.js
// AI 育儿问答流式输出（SSE）HTTP 云函数
// 与 aiChat 云函数共享同一套提示词/知识库/限流逻辑（代码独立复制，避免跨目录依赖）
// 客户端通过 wx.cloud.callHTTPFunction({ name: 'aiChatStream', path: '/chat', enableChunked: true }) 调用

const http = require('http');
const fs = require('fs');
const path = require('path');
const cloud = require('wx-server-sdk');
const OpenAI = require('openai');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/** TokenHub API 配置 */
const TOKENHUB_BASE_URL = 'https://tokenhub.tencentmaas.com/v1';
const MODEL_NAME = 'hy3';

/** 错误兜底文案（统一脱敏，原始错误仅记录日志） */
const ERROR_MESSAGE = 'AI 服务暂时不可用，请稍后再试';

/**
 * 获取 TokenHub API Key
 * 仅从云函数环境变量读取，未配置时返回空字符串（调用方需拦截并提示）
 * 环境变量配置方式：云开发控制台 → 云函数 → aiChatStream → 配置 → 环境变量
 * @returns {string} API Key
 */
function getApiKey() {
  return process.env.TOKENHUB_API_KEY || '';
}

/** 初始化 OpenAI 客户端（指向 TokenHub），显式设置超时时间 25000ms */
const openai = new OpenAI({
  apiKey: getApiKey(),
  baseURL: TOKENHUB_BASE_URL,
  timeout: 25000,
});

/** 系统提示词（人设） */
const SYSTEM_PROMPT = `#角色：
你是一个专为低龄宝妈设计的深夜陪伴AI机器人，名字叫「宝妈陪伴师」，提供两大核心服务：树洞倾诉（共情接住情绪，不劝和不说教，也包括家庭关系/婆媳/夫妻等实际困扰）、带娃问题求助（给科学步骤，提就医边界）

#核心定位：
温柔、安全、不评判、24小时在线，只站在妈妈这边。

## 技能：
你必须严格识别用户当前意图，只进入以下两种模式之一，绝对不混淆：
--------------------
##意图1：树洞倾诉模式
触发条件：用户吐槽、抱怨、发泄、委屈、骂婆婆/老公、说崩溃、说累、说不公平、家庭矛盾、夫妻关系、婆媳关系
行为规则：
1. 只共情、只站队、只接住情绪
2. 不劝和、不讲道理、不说"为了孩子忍一忍"
3. 不评判任何人，不教育用户
4. 回复暖、有力量，不啰嗦，不长篇大论
5. 可以适当引导用户说出故事倾诉
6. 多鼓励用户，给用户正面的情绪，当用户对自己评价过低时，多夸奖用户，帮助用户找回自信和好心情
7. 不要随便举例子，引用资料时只需写明出处的书籍名称和章节，不要说内部实现相关的内容
8. 不要随意发散用户未说过的故事内容，要围绕用户的发言输出
9. 当用户有不良情绪时，可以适度的陪用户一起吐槽，吐槽过后再给实际可行的建议或解决方案，不要太官方，生活化一点的语言更好
10. 家庭关系、婆媳关系、夫妻关系本身就是宝妈情绪的重要来源，属于你的服务范围，你可以结合情绪支持和实际建议一同回答
禁止：
- 正能量鸡汤、讲道理、劝宽容、反问
- 禁止劝：忍一忍、别生气、为了孩子
- 禁止讲道理：婆婆也是为你好
- 禁止指责、评判
- 禁止正能量鸡汤
- 禁止给用户看任何图片

--------------------
##意图2：带娃老师模式
触发条件：用户问宝宝哭闹、睡眠、胀气、辅食、发育、喂奶、护理等问题
行为规则：
1. 所有回复基于权威育儿资料，当资料内容有冲突时，需要依据卫健委、中国营养学会、WHO、中华医学会儿科指南的内容为准！回复用户时"一定"要"引用"建议的依据出处文档名称。如果无法获取答案，再自行回答
2. 根据用户的咨询问题查找相关资料片段，如果片段不足以支撑回答，请结合已知的知识一同回答，必要时请参照网络信息。
3. 先通过小程序的记录判断关键信息：月龄、症状、场景。若未知用户孩子的月龄，需要咨询用户："可以告诉我宝宝的月龄吗？我可以更精准的帮你找到解决方案"
4. 给1/2/3步骤化方案，简单可执行，"一定"要"引用"建议的依据出处文档名称，写出文档的名称，比如：依据《美国儿科学会育儿百科》第3章。若无引用的依据，则需要说清楚
5. 不制造焦虑，不做医疗诊断，严重情况提醒就医
6. 若用户提出的问题无法从现有资料获取，可从网络寻找解决方案
禁止：
- 玄学偏方、长篇大论、吓唬人
- 禁止甩长文、大道理
- 禁止玄学、偏方、迷信
- 禁止吓唬、制造焦虑
- 禁止代替医生做诊断
- 禁止给用户发送任何图片

## 工作流：
1. 根据用户发送的信息，判断用户当前意图是哪个：【意图1：树洞倾诉模式】、【意图2：带娃老师模式】
2. 若用户发送「用户吐槽、抱怨、发泄、委屈、骂婆婆/老公、说崩溃、说累、说不公平、家庭矛盾、夫妻/婆媳关系」类内容，触发模式【意图1：树洞倾诉模式】
3. 若用户发送「宝宝哭闹、睡眠、胀气、辅食、发育、喂奶、护理等」问题，触发模式【意图2：带娃老师模式】，若未知用户孩子的月龄，需要咨询用户："可以告诉我宝宝的月龄吗？我可以更精准的帮你找到解决方案"

## 限制：
- 若用户触发模式【意图2：带娃老师模式】，若用户的问题在现有资料范围内，回答内容严格遵循资料内容，绝不可自由发散，不可胡编乱造，不可无依据的回答问题，未知问题可引导用户说出更精准的问题。回答问题时请给出依据出处，写出文档名称，比如：依据《美国儿科学会育儿百科》第3章，如果没有依据来源，不要强行胡编乱造。
- 绝对保护隐私，让妈妈感到安全
- 深夜语气放轻、放缓、温暖稳定
- 不做社交、不推内容、不营销
- 你的服务范围：接住情绪陪伴安慰、解答带娃难题、以及帮助宝妈处理与育儿相关的家庭关系困扰（如婆媳、夫妻相处等）
- 严禁直接给出医疗诊断、治疗方案
- 若用户提出一些好物推荐的需求，可从网络寻找解决方案
- 严禁给用户发送任何图片
- 【重要】绝对不要向用户提及「知识库」「资料片段」「内部检索」等内部实现相关的任何术语。当参考资料中找不到匹配内容时，你仍然要用自己的知识回答，不要说"找不到资料""没有相关文档"之类的话。只有当你确实完全答不上来时，才可以说"我暂时没有这方面的详细资料，建议咨询专业医生"。
`;

// ================== 知识库 ==================
let knowledgeBase = null;
const kbPath = path.join(__dirname, 'knowledge_base.json');
if (fs.existsSync(kbPath)) {
  try {
    knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    console.log('[aiChatStream] 知识库加载成功，片段数:', knowledgeBase.chunks.length);
  } catch (err) {
    console.error('[aiChatStream] 知识库加载失败:', err);
  }
} else {
  console.log('[aiChatStream] 未找到知识库文件，将使用纯大模型模式');
}

/**
 * 简单分词函数（用于知识库检索）
 * @param {string} text - 输入文本
 * @returns {string[]} 分词结果
 */
function tokenize(text) {
  const words = [];
  const chars = text.replace(/[^一-龥a-zA-Z0-9]/g, '');
  for (let i = 0; i < chars.length - 1; i++) {
    words.push(chars.slice(i, i + 2));
    if (i < chars.length - 2) words.push(chars.slice(i, i + 3));
  }
  return words;
}

/**
 * 从消息和历史对话中提取宝宝月龄
 * @param {string} msg - 当前用户消息
 * @param {Array} history - 历史对话
 * @returns {number|null} 月龄
 */
function extractMonthFromMessages(msg, history) {
  const allTexts = [msg, ...history.map(h => h.content)].join(' ');
  const monthMatch = allTexts.match(/(\d+)[\s-]*(?:个月|月龄|月)/);
  return monthMatch ? parseInt(monthMatch[1], 10) : null;
}

/**
 * 从知识库中检索相关片段
 * @param {string} query - 查询文本
 * @param {number} topK - 返回条数
 * @param {number|null} userMonth - 用户月龄
 * @returns {string[]} 相关知识片段
 */
function searchKnowledgeBase(query, topK = 3, userMonth = null) {
  if (!knowledgeBase || !knowledgeBase.chunks || knowledgeBase.chunks.length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(queryLower);
  const queryWords = queryLower.split(/[^一-龥a-zA-Z0-9]+/).filter(w => w.length > 0);

  const topicKeywords = {
    '辅食': 3, '米粉': 3, '菜泥': 3, '果泥': 3, '肉泥': 3, '蛋黄': 3, '粥': 2, '面条': 2,
    '睡眠': 3, '睡觉': 3, '哄睡': 3, '夜醒': 3, '入睡': 3,
    '早教': 3, '游戏': 2, '训练': 2, '发育': 2, '敏感期': 3, '认知': 2, '运动': 2,
    '护理': 3, '洗澡': 2, '抚触': 2, '尿布': 2, '黄疸': 2, '皮肤': 2,
    '健康': 3, '生病': 2, '发烧': 3, '感冒': 3, '咳嗽': 3, '腹泻': 3, '便秘': 3, '呕吐': 3, '过敏': 3,
    '喂养': 3, '喂奶': 3, '母乳': 3, '配方奶': 3, '奶量': 2, '厌奶': 3, '呛奶': 3,
    '生长发育': 3, '体重': 2, '身高': 2, '头围': 2, '大运动': 3, '精细动作': 3, '语言': 2, '社交': 2
  };

  const monthMatch = query.match(/(\d+)[\s-]*(?:个月|月龄|月)/);
  const queryMonth = monthMatch ? parseInt(monthMatch[1], 10) : userMonth;

  const scores = knowledgeBase.chunks.map(chunk => {
    let score = 0;
    const textLower = chunk.text.toLowerCase();
    const chunkTokens = tokenize(textLower);

    if (textLower.includes(queryLower)) {
      score += 10;
    }

    queryWords.forEach(word => {
      if (word.length >= 2 && textLower.includes(word)) {
        score += 2;
        if (topicKeywords[word]) {
          score += topicKeywords[word];
        }
      }
    });

    const tokenSet = new Set(chunkTokens);
    let tokenHits = 0;
    queryTokens.forEach(t => {
      if (tokenSet.has(t)) tokenHits++;
    });
    score += (tokenHits / queryTokens.length) * 3;

    if (queryMonth !== null) {
      const monthRegex = /(\d+)(?:\s*[-~]\s*(\d+))?\s*(?:个月|月龄|月)/g;
      let m;
      let hasExactMonth = false;
      while ((m = monthRegex.exec(textLower)) !== null) {
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : start;
        const realEnd = !isNaN(end) ? end : start;
        for (let num = start; num <= realEnd; num++) {
          if (num === queryMonth) {
            score += 20;
            hasExactMonth = true;
          } else if (Math.abs(num - queryMonth) <= 1) {
            score += 8;
          } else {
            score -= 10;
          }
        }
      }
      if (chunk.tags && chunk.tags.includes(`${queryMonth}月龄`)) {
        score += 15;
        hasExactMonth = true;
      }
      chunk._hasExactMonth = hasExactMonth;
    }

    if (chunk.tags) {
      chunk.tags.forEach(tag => {
        if (queryLower.includes(tag.toLowerCase())) {
          score += 3;
        }
      });
    }

    return { text: chunk.text, score, _hasExactMonth: chunk._hasExactMonth };
  });

  scores.sort((a, b) => b.score - a.score);

  const threshold = 2;
  let results = scores.filter(r => r.score >= threshold);

  if (queryMonth !== null) {
    const exactMatches = results.filter(r => r._hasExactMonth);
    if (exactMatches.length > 0) {
      results = exactMatches;
    }
  }

  return results.slice(0, topK).map(r => r.text);
}

/** 每个用户每天最大调用次数 */
const DAILY_LIMIT = 30;

/**
 * 按 openid 检查并累加当日调用次数（基于 ai_chat_quota 集合）
 * 计数失败时降级放行并记录日志，不阻断正常调用
 * @param {string} openid - 用户 openid
 * @returns {Promise<{allowed: boolean, used: number}>} 是否允许调用及已用次数
 */
async function checkDailyQuota(openid) {
  const db = cloud.database();
  const _ = db.command;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const docId = `${openid}_${dateStr}`;
  const quotaCol = db.collection('ai_chat_quota');

  try {
    const res = await quotaCol.doc(docId).get().catch(() => null);
    const used = (res && res.data && res.data.count) || 0;
    if (used >= DAILY_LIMIT) {
      return { allowed: false, used };
    }
    if (res && res.data) {
      await quotaCol.doc(docId).update({ data: { count: _.inc(1), updateTime: db.serverDate() } });
    } else {
      await quotaCol.doc(docId).set({ data: { openid, date: dateStr, count: 1, updateTime: db.serverDate() } });
    }
    return { allowed: true, used: used + 1 };
  } catch (err) {
    // 计数失败不应阻断正常调用，降级放行
    console.error('[aiChatStream] 调用频率计数失败，降级放行:', err);
    return { allowed: true, used: 0 };
  }
}

// ================== SSE 工具 ==================

/**
 * 设置 SSE 响应头
 * @param {http.ServerResponse} res - 响应对象
 */
function setSSEHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
}

/**
 * 写一帧 SSE 数据
 * @param {http.ServerResponse} res - 响应对象
 * @param {Object|string} payload - 对象会被 JSON 序列化（避免正文换行破坏 SSE 帧），字符串原样输出（如 [DONE]）
 */
function writeSSE(res, payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.write(`data: ${data}\n\n`);
}

/**
 * 快速回复路径：不走大模型，一次性返回完整内容后结束
 * @param {http.ServerResponse} res - 响应对象
 * @param {string} content - 回复内容
 */
function replyOnce(res, content) {
  writeSSE(res, { content });
  writeSSE(res, '[DONE]');
  res.end();
}

/**
 * 读取请求体 JSON
 * @param {http.IncomingMessage} req - 请求对象
 * @returns {Promise<Object>} 解析后的 body
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ================== 主处理 ==================

/**
 * 处理 POST /chat 请求
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
async function handleChat(req, res) {
  // 鉴权：仅接受小程序侧调用（微信侧会注入 x-wx-openid 头），挡住公网直接访问
  const openid = req.headers['x-wx-openid'];
  if (!openid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 401, error: '未授权的访问' }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 400, error: '请求参数错误' }));
    return;
  }

  const { msg, history = [], babyInfo } = body;
  if (!msg || typeof msg !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 400, error: '缺少 msg 参数' }));
    return;
  }

  // 客户端断开标记：中断模型流式输出，避免无效消耗
  let clientClosed = false;
  let activeStream = null;
  req.on('close', () => {
    clientClosed = true;
    if (activeStream && activeStream.controller) {
      activeStream.controller.abort();
    }
  });

  // 之后的回复都走 SSE
  setSSEHeaders(res);

  try {
    // API Key 未配置时返回错误帧
    if (!process.env.TOKENHUB_API_KEY) {
      console.error('[aiChatStream] TOKENHUB_API_KEY 未配置');
      writeSSE(res, { error: ERROR_MESSAGE });
      res.end();
      return;
    }

    // 组装 system prompt
    let systemContent = SYSTEM_PROMPT;

    // 从 babyInfo 或对话历史中获取月龄
    let userMonth = (babyInfo && babyInfo.ageInMonths !== null && babyInfo.ageInMonths !== undefined)
      ? babyInfo.ageInMonths
      : null;
    let ageText = '未知月龄';

    if (babyInfo && babyInfo.nickname) {
      ageText = userMonth !== null ? `${userMonth}个月` : '未知月龄';
      const genderText = babyInfo.gender === 'boy' ? '男宝' : babyInfo.gender === 'girl' ? '女宝' : '宝宝';
      systemContent = `【用户宝宝背景】宝宝昵称：${babyInfo.nickname}，性别：${genderText}，月龄：${ageText}。\n\n${SYSTEM_PROMPT}`;
    }

    // 如果 babyInfo 没有月龄，尝试从历史对话中提取
    if (userMonth === null) {
      const implicitMonth = extractMonthFromMessages(msg, history);
      if (implicitMonth !== null) {
        userMonth = implicitMonth;
        ageText = `${userMonth}个月`;
        systemContent += `\n\n用户宝宝在对话中提到月龄是${ageText}。`;
      }
    }

    // 强约束：根据月龄精准回答
    if (ageText !== '未知月龄') {
      systemContent += `\n\n用户宝宝当前月龄是${ageText}。你只回答${ageText}的内容。禁止提到其他月龄。如果参考资料里涉及其他月龄，直接忽略不用。`;
    } else {
      // 如果消息明显是情绪倾诉，不拦截，让大模型走树洞模式
      const emotionKeywords = ['婆婆', '老公', '讨厌', '烦', '崩溃', '委屈', '累', '不公平', '骂', '生气', '郁闷'];
      const isEmotional = emotionKeywords.some(k => msg.includes(k));

      const monthRelatedKeywords = ['早教', '辅食', '睡眠', '发育', '喂奶', '奶粉', '奶量', '疫苗', '玩具', '游戏', '训练', '绘本', '翻身', '爬行', '走路', '说话'];
      if (!isEmotional && monthRelatedKeywords.some(k => msg.includes(k))) {
        // 月龄未知拦截：快速回复，不走大模型
        replyOnce(res, '您好呀～为了能给宝宝更精准的建议，可以告诉我宝宝现在几个月大了吗？这样我可以根据宝宝的月龄来推荐适合的内容哦～');
        return;
      }
      systemContent += `\n\n你目前不知道用户宝宝的具体月龄。如果用户的问题与月龄强相关，你必须先问月龄再回答。`;
    }

    // 简单问候快速回复，不调用大模型
    const simpleGreetings = ['你好', '您好', '嗨', '在吗', '哈喽', 'hello', 'hi'];
    if (simpleGreetings.includes(msg.trim())) {
      replyOnce(res, '你好呀，很高兴能和你聊天😊 今天有什么想和我分享的吗？或者有什么困扰你的问题需要我帮忙解答的吗？');
      return;
    }

    // 按 openid 限制每个用户每天的调用次数（放在快速回复之后，只在真正调用大模型前扣额度）
    const quota = await checkDailyQuota(openid);
    if (!quota.allowed) {
      replyOnce(res, '今天的聊天次数已经达到上限啦（每天最多30次），早点休息，明天再来找我聊吧～');
      return;
    }

    console.log('[aiChatStream] babyInfo:', JSON.stringify(babyInfo), 'userMonth:', userMonth);

    // 检索知识库（传入 userMonth 优先匹配对应月龄内容）
    let relevantChunks = searchKnowledgeBase(msg, 2, userMonth);
    console.log('[aiChatStream] raw relevantChunks count:', relevantChunks.length);

    // 硬过滤：若已知用户月龄，只保留文本里明确出现该月龄的片段；否则清空，避免大模型被带偏
    if (userMonth !== null && relevantChunks.length > 0) {
      const monthRegex = new RegExp(`${userMonth}[\\s-]*(?:个月|月龄|月)`);
      relevantChunks = relevantChunks.filter(text => monthRegex.test(text));
      console.log('[aiChatStream] filtered relevantChunks count:', relevantChunks.length);
      if (relevantChunks.length === 0) {
        systemContent += `\n\n当前没有找到针对${userMonth}个月的详细资料，请基于你的通用育儿知识回答，不要提及其他月龄的内容。`;
      }
    }

    if (relevantChunks.length > 0) {
      const kbContext = relevantChunks.map((t, i) => `【参考资料${i + 1}】\n${t}`).join('\n\n');
      systemContent += `\n\n以下是与用户问题相关的参考资料，请优先依据这些资料回答，并给出出处文档名称。如果资料中没有答案，请明确说明。\n\n${kbContext}`;
      systemContent += `\n\n【铁律】上面的参考资料中已经包含了${userMonth !== null ? userMonth + '个月' : '当前问题'}的具体内容，你必须严格依据这些资料回答，绝对禁止自行编造与资料矛盾的内容。如果资料内容和你的通用知识冲突，以资料为准。`;
    } else if (userMonth !== null) {
      systemContent += `\n\n当前没有找到针对${userMonth}个月的详细资料，请你直接基于权威育儿资料回答，不要编造。`;
    }

    // 构造 OpenAI 兼容的消息格式
    const messages = [
      { role: "system", content: systemContent }
    ];

    // 只保留最近 3 轮对话，减少大模型处理时间
    const recentHistory = history.slice(-6);
    recentHistory.forEach(h => {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      });
    });

    // 如果系统知道月龄但用户问题里没提，自动补充到问题前
    let finalMsg = msg;
    if (userMonth !== null && !msg.match(/\d+[\s-]*(?:个月|月龄|月)/)) {
      finalMsg = `我家宝宝现在${userMonth}个月。${msg}`;
    }

    messages.push({ role: "user", content: finalMsg });

    // 调用 TokenHub API（流式）
    console.log('[aiChatStream] calling TokenHub with model:', MODEL_NAME);
    const stream = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7
    });
    activeStream = stream;

    for await (const chunk of stream) {
      if (clientClosed) break;
      const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      // 只推送正文 delta.content；delta.reasoning_content 是模型思考过程，丢弃不展示
      if (delta && delta.content) {
        writeSSE(res, { delta: delta.content });
      }
    }

    if (!clientClosed) {
      writeSSE(res, '[DONE]');
      res.end();
    }
    console.log('[aiChatStream] stream finished');

  } catch (err) {
    console.error('[aiChatStream] 云函数错误:', err);
    if (clientClosed) return;
    // 流中途出错：补一帧错误信息再结束（客户端据此显示兜底文案）
    let errMsg = ERROR_MESSAGE;
    if (err && (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT')) {
      errMsg = 'AI 响应超时，请稍后再试';
    }
    try {
      writeSSE(res, { error: errMsg });
      res.end();
    } catch (e) { /* 响应已关闭时忽略 */ }
  }
}

/** HTTP 服务入口：POST /chat */
const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (req.method === 'POST' && url === '/chat') {
    handleChat(req, res).catch(err => {
      console.error('[aiChatStream] 未捕获异常:', err);
      try {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 500, error: ERROR_MESSAGE }));
        } else {
          res.end();
        }
      } catch (e) { /* 响应已关闭时忽略 */ }
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code: 404, error: 'not found' }));
});

server.listen(9000);
console.log('[aiChatStream] HTTP server listening on port 9000');

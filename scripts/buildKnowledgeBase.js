/**
 * 知识库构建脚本
 * 用法：
 * 1. 把 PDF/Word 文档放到 scripts/docs/ 目录下
 * 2. cd scripts && npm install
 * 3. node buildKnowledgeBase.js
 *
 * 说明：
 * - 自动跳过纯图片（PDF/Word 中的图片不会提取）
 * - 把文本智能切分为 300-500 字的片段
 * - 用本地轻量模型 Xenova/all-MiniLM-L6-v2 生成向量（零 API 费用）
 * - 输出到 cloudfunctions/aiChat/knowledge_base.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const WordExtractor = require('word-extractor');
const glob = require('glob');
const crypto = require('crypto');

// ================== 配置区 ==================
const CONFIG = {
  // 文档来源目录（已移出项目目录，避免影响小程序代码包大小）
  docsDir: path.join(__dirname, '../../baby-todo-list-docs'),
  // 输出文件路径
  outputPath: path.join(__dirname, '../cloudfunctions/aiChat/knowledge_base.json'),
  // 标签目录：用于快速分类检索
  tagsCachePath: path.join(__dirname, '../cloudfunctions/aiChat/tag_index.json'),
  // 每个文本片段的目标字数
  chunkSize: 400,
  // 相邻片段重叠字数（保证语义连贯）
  chunkOverlap: 50,
  // 单片段最小字数（太短的跳过）
  minChunkLength: 80,
};
// ===========================================

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 递归扫描文档
 */
function scanDocs(docsDir) {
  if (!fs.existsSync(docsDir)) {
    console.warn(`⚠️ 文档目录不存在: ${docsDir}，请先创建并把 PDF/Word 文档放进去。`);
    return [];
  }
  const patterns = ['**/*.pdf', '**/*.docx', '**/*.doc'];
  let files = [];
  patterns.forEach(p => {
    files = files.concat(glob.sync(p, { cwd: docsDir, absolute: true }));
  });
  // 去重
  return [...new Set(files)];
}

/**
 * 提取 PDF 纯文本（自动跳过图片）
 */
async function extractPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

/**
 * 提取 Word 纯文本（自动跳过图片）
 */
async function extractWord(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.doc') {
    // 优先用 macOS textutil 提取老版本 .doc，效果远好于 word-extractor
    try {
      const text = execSync(`textutil -convert txt -stdout "${filePath}"`, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
      });
      return text || '';
    } catch (err) {
      console.warn(`⚠️ textutil 解析失败，fallback 到 word-extractor: ${path.basename(filePath)}`);
      const extractor = new WordExtractor();
      const doc = await extractor.extract(filePath);
      return doc.getBody() || '';
    }
  }
  // .docx
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * 清洗文本：去掉多余的空行、页眉页脚常见的重复内容
 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 去掉连续 3 个以上的换行
    .replace(/\n{3,}/g, '\n\n')
    // 去掉全是数字/页码的行（简单过滤）
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      // 过滤纯数字（页码）
      if (/^\d+$/.test(line)) return false;
      // 过滤过短的无效行（如 "-"、"*"）
      if (line.length < 3) return false;
      return true;
    })
    .join('\n');
}

/**
 * 智能切分文本
 */
function splitText(text, chunkSize = 400, overlap = 50, minLength = 80) {
  // 先按自然段落拆分
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim().replace(/\s+/g, ' '))
    .filter(p => p.length >= 10);

  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 1 <= chunkSize) {
      currentChunk += (currentChunk ? '\n' : '') + para;
    } else {
      // 保存当前 chunk
      if (currentChunk.length >= minLength) {
        chunks.push(currentChunk);
      }

      // 保留尾部作为下一段的重叠
      let overlapText = '';
      if (currentChunk.length > overlap) {
        overlapText = currentChunk.slice(-overlap);
      } else if (currentChunk.length > 0) {
        overlapText = currentChunk;
      }

      currentChunk = overlapText + (overlapText ? '\n' : '') + para;

      // 如果单段就超过 chunkSize，需要强制切分
      while (currentChunk.length > chunkSize) {
        chunks.push(currentChunk.slice(0, chunkSize));
        currentChunk = currentChunk.slice(chunkSize - overlap);
      }
    }
  }

  if (currentChunk.length >= minLength) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 基于文本内容自动提取标签
 */
function extractTags(text) {
  const tags = [];
  const lowered = text.toLowerCase();
  
  // 月龄标签：支持范围如 "11-12个月"、"5~6个月"
  const monthRegex = /(\d+)(?:\s*[-~]\s*(\d+))?\s*(?:个月|月龄|月)/g;
  let m;
  while ((m = monthRegex.exec(text)) !== null) {
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    if (!isNaN(start)) {
      const realEnd = !isNaN(end) ? end : start;
      for (let num = start; num <= realEnd; num++) {
        tags.push(`${num}月龄`);
        // 增加年龄段标签
        if (num <= 3) tags.push('0-3月龄');
        else if (num <= 6) tags.push('4-6月龄');
        else if (num <= 12) tags.push('7-12月龄');
        else if (num <= 24) tags.push('13-24月龄');
        else tags.push('24月龄以上');
      }
    }
  }
  
  // 主题标签
  const topicMap = {
    '辅食': ['辅食', '米粉', '菜泥', '果泥', '肉泥', '蛋黄', '烂粥', '面条'],
    '睡眠': ['睡眠', '睡觉', '哄睡', '夜醒', '入睡', ' bedtime', ' nap'],
    '早教': ['早教', '游戏', '训练', '发展', '发育', '敏感期', '认知', '运动'],
    '护理': ['护理', '洗澡', '抚触', '换尿布', '脐带', '黄疸', '皮肤'],
    '健康': ['健康', '生病', '发烧', '感冒', '咳嗽', '腹泻', '便秘', '呕吐', '过敏'],
    '喂养': ['喂养', '喂奶', '母乳', '配方奶', '奶量', '厌奶', '呛奶'],
    '生长发育': ['生长发育', '体重', '身高', '头围', '大运动', '精细动作', '语言', '社交']
  };
  
  Object.entries(topicMap).forEach(([tag, keywords]) => {
    if (keywords.some(k => lowered.includes(k.toLowerCase()))) {
      tags.push(tag);
    }
  });
  
  return [...new Set(tags)];
}

/**
 * 为每个片段生成语义指纹（用于快速去重和相似度过滤）
 */
function generateFingerprint(text) {
  // 取文本前50个字符的简化哈希
  const sample = text.slice(0, 50).replace(/\s/g, '');
  return crypto.createHash('md5').update(sample).digest('hex').slice(0, 16);
}

/**
 * 主流程
 */
async function main() {
  console.log('🚀 开始构建知识库...\n');

  // 1. 扫描文档
  const files = scanDocs(CONFIG.docsDir);
  console.log(`📄 找到 ${files.length} 个文档:`);
  files.forEach(f => console.log('   - ' + path.basename(f)));

  if (files.length === 0) {
    console.error('\n❌ 没有可处理的文档，请先把 PDF/Word 放入 scripts/docs/ 目录');
    process.exit(1);
  }

  // 2. 提取文本
  console.log('\n📖 正在提取文本（图片会自动跳过）...');
  let allText = '';
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let text = '';
    try {
      if (ext === '.pdf') {
        text = await extractPDF(file);
      } else if (ext === '.docx' || ext === '.doc') {
        text = await extractWord(file);
      }
      text = cleanText(text);
      console.log(`   ✅ ${path.basename(file)} -> ${text.length} 字符`);
      allText += '\n\n' + text;
    } catch (err) {
      console.error(`   ❌ ${path.basename(file)} 解析失败:`, err.message);
    }
  }

  console.log(`\n📝 清洗后总文本长度: ${allText.length} 字符`);

  // 3. 切分
  console.log('\n✂️  正在切分文本...');
  const chunks = splitText(allText, CONFIG.chunkSize, CONFIG.chunkOverlap, CONFIG.minChunkLength);
  console.log(`   生成 ${chunks.length} 个文本片段`);

  if (chunks.length === 0) {
    console.error('❌ 没有有效的文本片段，请检查文档内容');
    process.exit(1);
  }

  // 4. 生成标签和指纹
  console.log('\n🏷️  正在为片段提取标签...');
  const chunkObjects = [];
  const fingerprints = new Set();
  
  chunks.forEach((text, i) => {
    const fp = generateFingerprint(text);
    if (fingerprints.has(fp)) return; // 去重
    fingerprints.add(fp);
    
    chunkObjects.push({
      id: i,
      text,
      tags: extractTags(text),
      length: text.length
    });
  });
  
  console.log(`   去重后有效片段: ${chunkObjects.length}`);

  // 5. 输出 JSON
  console.log('\n💾 正在保存知识库文件...');
  ensureDir(path.dirname(CONFIG.outputPath));

  const knowledgeBase = {
    meta: {
      buildTime: new Date().toISOString(),
      docCount: files.length,
      chunkCount: chunkObjects.length,
      chunkSize: CONFIG.chunkSize,
      chunkOverlap: CONFIG.chunkOverlap,
      retrievalType: 'keyword-bm25'
    },
    chunks: chunkObjects
  };

  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(knowledgeBase));

  // 6. 输出标签索引（方便快速检索）
  const tagIndex = {};
  chunkObjects.forEach(chunk => {
    chunk.tags.forEach(tag => {
      if (!tagIndex[tag]) tagIndex[tag] = [];
      tagIndex[tag].push(chunk.id);
    });
  });
  fs.writeFileSync(CONFIG.tagsCachePath, JSON.stringify(tagIndex));

  const fileSizeMB = (fs.statSync(CONFIG.outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ 知识库构建完成！`);
  console.log(`   输出路径: ${CONFIG.outputPath}`);
  console.log(`   文件大小: ${fileSizeMB} MB`);
  console.log(`   有效片段: ${chunkObjects.length}`);
  console.log(`   标签种类: ${Object.keys(tagIndex).length}`);
  console.log(`\n下一步: 右键 cloudfunctions/aiChat -> "上传并部署：云端安装依赖"`);
}

main().catch(err => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});

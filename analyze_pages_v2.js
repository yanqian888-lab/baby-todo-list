const fs = require('fs');
const path = require('path');

const PAGES_DIR = '/Users/yanqian/Desktop/练习项目/baby-todo-list/pages';
const issues = [];

function addIssue(file, line, type, desc, suggestion) {
  issues.push({ file, line: line || 'N/A', type, desc, suggestion });
}

function getPageFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      for (const f of fs.readdirSync(sub)) {
        if (f.endsWith('.js')) {
          const base = path.join(sub, f.replace('.js', ''));
          result.push({
            js: base + '.js',
            wxml: base + '.wxml',
            dir: sub,
            name: f.replace('.js', '')
          });
        }
      }
    }
  }
  return result;
}

const pages = getPageFiles(PAGES_DIR);

for (const page of pages) {
  if (!fs.existsSync(page.js)) continue;
  const jsContent = fs.readFileSync(page.js, 'utf-8');
  const jsLines = jsContent.split('\n');
  
  // Extract all identifiers that look like method definitions in the Page object
  // We'll use a more robust approach: find Page({...}) or Component({...})
  const methodNames = new Set();
  const dataFields = new Set();
  
  // Match Page/Component literal object contents
  const pageMatch = jsContent.match(/Page\s*\(\s*\{([\s\S]*)\}\s*\)/);
  const compMatch = jsContent.match(/Component\s*\(\s*\{([\s\S]*)\}\s*\)/);
  const objContent = pageMatch ? pageMatch[1] : (compMatch ? compMatch[1] : jsContent);
  
  // Find all key definitions
  // key: function, key() {, key: async function, key: (args) =>
  const keyPattern = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::\s*function|:\s*async\s*function|\(|:\s*\(|:\s*async\s*\()/gm;
  let km;
  while ((km = keyPattern.exec(objContent)) !== null) {
    methodNames.add(km[1]);
  }
  
  // Also find methods defined with `async methodName(` in JS
  const asyncMethodPattern = /\basync\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((km = asyncMethodPattern.exec(jsContent)) !== null) {
    methodNames.add(km[1]);
  }
  
  // Standard lifecycle methods
  ['onLoad','onShow','onReady','onHide','onUnload','onPullDownRefresh','onReachBottom','onShareAppMessage','onPageScroll','onResize','onTabItemTap'].forEach(m => methodNames.add(m));
  
  // Find data fields from data: { ... }
  const dataMatch = jsContent.match(/data\s*:\s*\{([\s\S]*?)\n\s*\},?\s*\n/);
  if (dataMatch) {
    const dataContent = dataMatch[1];
    const fieldPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g;
    let fm;
    while ((fm = fieldPattern.exec(dataContent)) !== null) {
      dataFields.add(fm[1]);
    }
  }
  
  // Also find fields set via this.setData({ fieldName: ... })
  const setDataPattern = /setData\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  let sm;
  while ((sm = setDataPattern.exec(jsContent)) !== null) {
    const setContent = sm[1];
    const fieldPattern2 = /['"]?([a-zA-Z_$][a-zA-Z0-9_$]*)['"]?\s*:/g;
    let fm2;
    while ((fm2 = fieldPattern2.exec(setContent)) !== null) {
      dataFields.add(fm2[1]);
    }
  }
  
  // Check WXML
  if (fs.existsSync(page.wxml)) {
    const wxmlContent = fs.readFileSync(page.wxml, 'utf-8');
    const wxmlLines = wxmlContent.split('\n');
    
    // Track wx:for scope variables per line
    const forVarsPerLine = [];
    let currentForVars = new Set();
    for (let i = 0; i < wxmlLines.length; i++) {
      const line = wxmlLines[i];
      // wx:for opens
      const forMatch = line.match(/wx:for\s*=\s*["']([^"']+)["']/);
      if (forMatch && !line.includes('wx:for-end')) {
        const wxForItem = line.match(/wx:for-item\s*=\s*["']([^"']+)["']/);
        const wxForIndex = line.match(/wx:for-index\s*=\s*["']([^"']+)["']/);
        const itemVar = wxForItem ? wxForItem[1] : 'item';
        const indexVar = wxForIndex ? wxForIndex[1] : 'index';
        // push a new scope
        // simplistic: we don't track close tags, just inherit parent + new
        const newScope = new Set(currentForVars);
        newScope.add(itemVar);
        newScope.add(indexVar);
        newScope.add('member'); // common alias
        currentForVars = newScope;
      }
      forVarsPerLine.push(new Set(currentForVars));
    }
    
    const bindingRegex = /\b(bind|catch)\w*\s*=\s*["']([^"']+)["']/g;
    const curlyRegex = /\{\{([^}]+)\}\}/g;
    
    for (let i = 0; i < wxmlLines.length; i++) {
      const line = wxmlLines[i];
      let m;
      while ((m = bindingRegex.exec(line)) !== null) {
        const handler = m[2].trim();
        if (handler.startsWith('{{') && handler.endsWith('}}')) {
          const expr = handler.slice(2, -2).trim();
          const methodName = expr.split('(')[0].split('.')[0].trim();
          if (methodName && !methodNames.has(methodName) && !['true','false'].includes(methodName)) {
            addIssue(page.js, i+1, 'WXML-JS mismatch', `WXML uses handler "${methodName}" but it may not be defined in JS`, `Add method "${methodName}" to the Page object`);
          }
        } else if (!handler.startsWith('/') && !handler.includes('{{')) {
          if (!methodNames.has(handler)) {
            addIssue(page.js, i+1, 'WXML-JS mismatch', `WXML uses handler "${handler}" but it may not be defined in JS`, `Add method "${handler}" to the Page object`);
          }
        }
      }
      
      while ((m = curlyRegex.exec(line)) !== null) {
        const expr = m[1].trim();
        const fieldMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (fieldMatch) {
          const field = fieldMatch[1];
          if (forVarsPerLine[i].has(field)) continue;
          if (!['true','false','null','undefined'].includes(field) && !dataFields.has(field)) {
            if (!methodNames.has(field)) {
              addIssue(page.js, i+1, 'Data field mismatch', `WXML references "${field}" but it may not be in data`, `Add "${field}" to data object or verify it exists`);
            }
          }
        }
      }
    }
  }
  
  // Check this.methodName() calls
  const thisCallRegex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    let m;
    while ((m = thisCallRegex.exec(line)) !== null) {
      const method = m[1];
      if (!methodNames.has(method) && !['data','setData'].includes(method)) {
        addIssue(page.js, i+1, 'Undefined method call', `JS calls this.${method}() but "${method}" is not defined`, `Define method "${method}" or fix the call`);
      }
    }
  }
  
  // Check this.data.field references
  const thisDataRegex = /this\.data\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    let m;
    while ((m = thisDataRegex.exec(line)) !== null) {
      const field = m[1];
      if (!dataFields.has(field)) {
        addIssue(page.js, i+1, 'Data field mismatch', `JS references this.data.${field} but "${field}" may not be in data`, `Add "${field}" to data object`);
      }
    }
  }
  
  // Check require() paths
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    let m;
    while ((m = requireRegex.exec(line)) !== null) {
      const reqPath = m[1];
      if (reqPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(page.js), reqPath);
        const exists = fs.existsSync(resolved) || fs.existsSync(resolved + '.js') || fs.existsSync(resolved + '.json') || fs.existsSync(resolved + '/index.js');
        if (!exists) {
          addIssue(page.js, i+1, 'Require issue', `require('${reqPath}') may resolve to missing file`, `Check path: ${resolved}`);
        }
      }
    }
  }
  
  // Check getApp() usage
  if (jsContent.includes('getApp()')) {
    const getAppVarMatch = jsContent.match(/(?:const|let|var)\s+(\w+)\s*=\s*getApp\s*\(\)/);
    if (getAppVarMatch) {
      const varName = getAppVarMatch[1];
      // Check if they do varName.something without checking if varName exists
      // Not a strong signal of bug
    }
  }
  
  // Check wx.showLoading without hideLoading in same function block
  let idx = 0;
  while (idx < jsContent.length) {
    const showIdx = jsContent.indexOf('wx.showLoading(', idx);
    if (showIdx === -1) break;
    let braceStart = jsContent.indexOf('{', showIdx);
    if (braceStart !== -1) {
      let depth = 1;
      let end = braceStart + 1;
      while (depth > 0 && end < jsContent.length) {
        if (jsContent[end] === '{') depth++;
        else if (jsContent[end] === '}') depth--;
        end++;
      }
      const block = jsContent.substring(braceStart, end);
      if (!block.includes('wx.hideLoading(')) {
        const lineNum = jsContent.substring(0, showIdx).split('\n').length;
        addIssue(page.js, lineNum, 'Missing hideLoading', 'A code block containing wx.showLoading does not contain wx.hideLoading', 'Add wx.hideLoading() in all exit paths of this block');
      }
    }
    idx = showIdx + 1;
  }
  
  // Check cloud function call parameters
  const cloudCallRegex = /wx\.cloud\.callFunction\s*\(\s*\{/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    if (cloudCallRegex.test(line)) {
      let j = i;
      let block = '';
      let braceDepth = 1;
      let started = false;
      while (j < jsLines.length && braceDepth > 0) {
        const l = jsLines[j];
        for (let c = 0; c < l.length; c++) {
          if (l[c] === '{') { braceDepth++; started = true; }
          else if (l[c] === '}') braceDepth--;
        }
        block += l + '\n';
        j++;
        if (started && braceDepth <= 0) break;
      }
      if (!block.includes('name:')) {
        addIssue(page.js, i+1, 'Cloud function parameter', 'wx.cloud.callFunction block missing "name" property', 'Add name: "cloudFunctionName"');
      }
    }
  }
  
  // Check for logical issues: catch without error handling or hideLoading
  const catchRegex = /catch\s*\(\s*\w+\s*\)\s*\{/g;
  let cm;
  while ((cm = catchRegex.exec(jsContent)) !== null) {
    const catchIdx = cm.index;
    let braceStart = jsContent.indexOf('{', catchIdx);
    if (braceStart !== -1) {
      let depth = 1;
      let end = braceStart + 1;
      while (depth > 0 && end < jsContent.length) {
        if (jsContent[end] === '{') depth++;
        else if (jsContent[end] === '}') depth--;
        end++;
      }
      const catchBlock = jsContent.substring(braceStart, end);
      // If this catch is inside a function that has showLoading but catch doesn't hideLoading
      // This is hard to detect precisely without AST, skip for now
    }
  }
}

// Deduplicate
const seen = new Set();
const deduped = issues.filter(i => {
  const key = `${i.file}:${i.line}:${i.type}:${i.desc}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Group by file
const grouped = {};
for (const issue of deduped) {
  if (!grouped[issue.file]) grouped[issue.file] = [];
  grouped[issue.file].push(issue);
}

for (const file of Object.keys(grouped).sort()) {
  console.log(`\n### ${file}\n`);
  for (const issue of grouped[file]) {
    console.log(`- Line ${issue.line} | ${issue.type}`);
    console.log(`  ${issue.desc}`);
    console.log(`  Suggestion: ${issue.suggestion}`);
  }
}

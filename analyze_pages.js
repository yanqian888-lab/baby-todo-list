const fs = require('fs');
const path = require('path');

const PAGES_DIR = '/Users/yanqian/Desktop/练习项目/baby-todo-list/pages';
const issues = [];

function addIssue(file, line, type, desc, suggestion) {
  issues.push({ file, line: line || 'N/A', type, desc, suggestion });
}

// Get all page JS files
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
  
  // Extract Page/component object methods
  // Simple regex-based parsing
  const methodNames = new Set();
  const dataFields = new Set();
  
  // Find method definitions: methodName: function or methodName(
  const methodRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:\(]\s*function/g;
  const methodRegex2 = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  const pageConfigRegex = /Page\s*\(\s*\{/;
  const componentConfigRegex = /Component\s*\(\s*\{/;
  
  // Extract all key: value in object literals (rough)
  // We'll scan for patterns like "key:" inside Page/Component
  let inPage = false;
  let braceDepth = 0;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    if (pageConfigRegex.test(line) || componentConfigRegex.test(line)) {
      inPage = true;
    }
    if (inPage) {
      // Look for data: { ... }
      const dataMatch = line.match(/data\s*:\s*\{/);
      if (dataMatch) {
        // extract fields in data block
        // naive: look ahead until matching }
        let j = i;
        let dataDepth = 0;
        let dataStarted = false;
        while (j < jsLines.length) {
          const dl = jsLines[j];
          for (let c = 0; c < dl.length; c++) {
            if (dl[c] === '{') { dataDepth++; dataStarted = true; }
            else if (dl[c] === '}') { dataDepth--; }
          }
          if (dataStarted && dataDepth <= 0) break;
          // extract field names
          const fieldMatches = dl.matchAll(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g);
          for (const m of fieldMatches) {
            if (m[1] !== 'data') dataFields.add(m[1]);
          }
          j++;
        }
      }
      
      // Look for method definitions
      const methodMatch = line.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function\s*\(/);
      if (methodMatch) methodNames.add(methodMatch[1]);
      const methodMatch2 = line.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/);
      if (methodMatch2 && !line.includes('if(') && !line.includes('while(') && !line.includes('for(') && !line.includes('catch(')) {
        // could be method shorthand in object - check it's after a comma or at start
        methodNames.add(methodMatch2[1]);
      }
    }
  }
  
  // Also add lifecycle methods
  ['onLoad','onShow','onReady','onHide','onUnload','onPullDownRefresh','onReachBottom','onShareAppMessage'].forEach(m => methodNames.add(m));
  
  // Check WXML bindings
  if (fs.existsSync(page.wxml)) {
    const wxmlContent = fs.readFileSync(page.wxml, 'utf-8');
    const wxmlLines = wxmlContent.split('\n');
    
    // Find all bind/catch attributes
    const bindingRegex = /\b(bind|catch)\w*\s*=\s*["']([^"']+)["']/g;
    const curlyRegex = /\{\{([^}]+)\}\}/g;
    
    for (let i = 0; i < wxmlLines.length; i++) {
      const line = wxmlLines[i];
      let m;
      while ((m = bindingRegex.exec(line)) !== null) {
        const handler = m[2].trim();
        // ignore literals
        if (handler.startsWith('{{') && handler.endsWith('}}')) {
          const expr = handler.slice(2, -2).trim();
          // e.g. "methodName" or "methodName(arg)" or "item.method"
          const methodName = expr.split('(')[0].split('.')[0].trim();
          if (methodName && !methodNames.has(methodName)) {
            addIssue(page.js, i+1, 'WXML-JS mismatch', `WXML uses handler "${methodName}" but it may not be defined in JS`, `Add method "${methodName}" to the Page object`);
          }
        } else if (!handler.startsWith('/') && !handler.includes('{{')) {
          // direct string like "handleTap"
          if (!methodNames.has(handler)) {
            addIssue(page.js, i+1, 'WXML-JS mismatch', `WXML uses handler "${handler}" but it may not be defined in JS`, `Add method "${handler}" to the Page object`);
          }
        }
      }
      
      // Check data fields used in WXML but not in data
      while ((m = curlyRegex.exec(line)) !== null) {
        const expr = m[1].trim();
        // Simple extraction: first identifier before . or [ or ? or (
        const fieldMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (fieldMatch) {
          const field = fieldMatch[1];
          if (!['true','false','null','undefined'].includes(field) && !dataFields.has(field)) {
            // could be a method or global, ignore if it's a known method
            if (!methodNames.has(field)) {
              addIssue(page.js, i+1, 'Data field mismatch', `WXML references "${field}" but it may not be in data`, `Add "${field}" to data object or verify it exists`);
            }
          }
        }
      }
    }
  }
  
  // Check for this.methodName() calls to undefined methods
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
  
  // Check for this.data.field references to undefined data fields
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
        // Check if file exists (with or without .js)
        const exists = fs.existsSync(resolved) || fs.existsSync(resolved + '.js') || fs.existsSync(resolved + '.json');
        if (!exists) {
          addIssue(page.js, i+1, 'Require issue', `require('${reqPath}') may resolve to missing file`, `Check path: ${resolved}`);
        }
      }
    }
  }
  
  // Check getApp() usage
  if (jsContent.includes('getApp()')) {
    // Check if getApp result is assigned
    if (!/const\s+\w+\s*=\s*getApp\s*\(\)/.test(jsContent) && !/let\s+\w+\s*=\s*getApp\s*\(\)/.test(jsContent) && !/var\s+\w+\s*=\s*getApp\s*\(\)/.test(jsContent)) {
      // It's okay if used inline, but let's check for getApp().globalData without assignment
      if (jsContent.includes('getApp().')) {
        // This is actually valid in WeChat mini programs, but sometimes getApp() returns null before onLaunch
        // Not an issue per se
      }
    }
  }
  
  // Check wx.showLoading without corresponding hideLoading in error paths
  // Find showLoading calls
  const showLoadingRegex = /wx\.showLoading\s*\(/g;
  // Find hideLoading calls
  const hasHideLoading = jsContent.includes('wx.hideLoading(');
  const hasShowLoading = jsContent.includes('wx.showLoading(');
  if (hasShowLoading && !hasHideLoading) {
    addIssue(page.js, 'N/A', 'Missing hideLoading', 'File uses wx.showLoading but never calls wx.hideLoading', 'Add wx.hideLoading() in success and error paths');
  }
  
  // More precise: look for showLoading inside functions and check if same function has hideLoading
  // This is complex with regex, let's do a simpler version: check each function block
  // We'll look for function bodies that contain showLoading but not hideLoading
  const funcBlocks = [];
  let idx = 0;
  while (idx < jsContent.length) {
    const showIdx = jsContent.indexOf('wx.showLoading(', idx);
    if (showIdx === -1) break;
    // Find enclosing function by looking backwards for "function" or "=>"
    // Look forwards for matching braces to extract block
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
        // Find line number
        const lineNum = jsContent.substring(0, showIdx).split('\n').length;
        addIssue(page.js, lineNum, 'Missing hideLoading', 'A code block containing wx.showLoading does not contain wx.hideLoading', 'Add wx.hideLoading() in all exit paths of this block');
      }
    }
    idx = showIdx + 1;
  }
  
  // Check cloud function calls for common parameter issues
  const cloudCallRegex = /wx\.cloud\.callFunction\s*\(\s*\{/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    if (cloudCallRegex.test(line)) {
      // Check subsequent lines for name and data
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
      if (block.includes('data:') && !block.includes('data: {')) {
        // data might be a variable, that's okay
      }
    }
  }
  
  // Check for logical bugs: setData with undefined variables
  const setDataRegex = /this\.setData\s*\(\s*\{/g;
  for (let i = 0; i < jsLines.length; i++) {
    const line = jsLines[i];
    if (setDataRegex.test(line)) {
      // check if any variable in setData is not obviously defined
      // too complex for regex, skip for now
    }
  }
}

// Print results
console.log(JSON.stringify(issues, null, 2));

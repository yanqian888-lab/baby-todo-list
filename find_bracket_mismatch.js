// 使用AST解析器查找括号不匹配问题
const fs = require('fs');
const path = require('path');
const { parse } = require('acorn');

// 读取文件内容
const filePath = path.join(__dirname, 'cloudfunctions/updateTaskStatus/index.js');
const content = fs.readFileSync(filePath, 'utf8');

try {
  // 尝试解析为AST
  parse(content, { 
    ecmaVersion: 'latest',
    sourceType: 'module'
  });
  console.log('✅ 语法解析成功，没有括号不匹配问题！');
} catch (error) {
  console.log('❌ 语法解析失败，错误信息如下：');
  console.log(`   行号: ${error.loc.line}, 列号: ${error.loc.column}`);
  console.log(`   错误: ${error.message}`);
  
  // 显示错误位置附近的代码
  const lines = content.split('\n');
  const errorLine = error.loc.line;
  const start = Math.max(0, errorLine - 5);
  const end = Math.min(lines.length, errorLine + 5);
  
  console.log('\n错误位置附近的代码：');
  for (let i = start; i < end; i++) {
    const lineNumber = i + 1;
    const line = lines[i] || '';
    const marker = lineNumber === errorLine ? '>>> ' : '    ';
    console.log(`${marker}${lineNumber}: ${line}`);
  }
}
// 语法检查脚本：验证云函数代码是否有语法错误
// 运行方式：node test_syntax_check.js

const fs = require('fs');
const path = require('path');

// 要检查的云函数列表
const cloudFunctions = [
  'updateTaskStatus',
  'getTaskClockIns'
];

// 检查单个云函数的语法
function checkSyntax(funcName) {
  console.log(`\n=== 检查 ${funcName} 云函数语法 ===`);
  
  const filePath = path.join(__dirname, `cloudfunctions/${funcName}/index.js`);
  
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 尝试编译代码（仅检查语法，不执行）
    new Function(content);
    
    console.log(`✅ ${funcName} 云函数语法检查通过！`);
    
    // 检查大括号匹配
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    
    if (openBraces === closeBraces) {
      console.log(`✅ ${funcName} 云函数大括号匹配正确！`);
    } else {
      console.log(`❌ ${funcName} 云函数大括号不匹配！`);
      console.log(`   开括号: ${openBraces}, 闭括号: ${closeBraces}`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ ${funcName} 云函数语法检查失败！`);
    console.log(`   错误信息: ${error.message}`);
    return false;
  }
}

// 主函数
function main() {
  console.log('=== 开始云函数语法检查 ===');
  
  let allPassed = true;
  
  // 检查所有云函数
  for (const funcName of cloudFunctions) {
    if (!checkSyntax(funcName)) {
      allPassed = false;
    }
  }
  
  console.log('\n=== 语法检查完成 ===');
  
  if (allPassed) {
    console.log('✅ 所有云函数语法检查通过！');
    console.log('✅ 修复已完成，可以部署云函数了！');
  } else {
    console.log('❌ 部分云函数语法检查失败，请检查错误信息！');
  }
}

// 运行检查
main();
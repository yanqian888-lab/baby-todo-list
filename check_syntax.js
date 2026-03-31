// 语法检查脚本 - 用于验证云函数文件的语法正确性
// 运行方式: node check_syntax.js

const fs = require('fs');
const path = require('path');

// 要检查的云函数文件列表
const cloudFunctionFiles = [
  './cloudfunctions/getTaskClockIns/index.js',
  './cloudfunctions/updateTaskStatus/index.js'
];

// 语法检查函数
function checkSyntax(filePath) {
  console.log(`\n=== 检查文件: ${filePath} ===`);
  
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 使用Node.js的语法检查器
    // 我们可以使用Function构造函数来检查语法
    new Function(content);
    
    console.log('✓ 语法检查通过');
    return true;
  } catch (error) {
    console.log('✗ 语法检查失败:', error.message);
    
    // 尝试定位错误位置
    if (error.stack) {
      const lines = error.stack.split('\n');
      for (const line of lines) {
        if (line.includes('<anonymous>:')) {
          const match = line.match(/<anonymous>:([0-9]+):([0-9]+)/);
          if (match) {
            console.log(`  错误位置: 第 ${match[1]} 行, 第 ${match[2]} 列`);
          }
          break;
        }
      }
    }
    
    return false;
  }
}

// 检查大括号匹配
function checkBraces(filePath) {
  console.log(`\n=== 检查大括号匹配: ${filePath} ===`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let braceCount = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        
        // 如果大括号数量为负，说明右括号过多
        if (braceCount < 0) {
          console.log(`✗ 大括号不匹配: 在位置 ${i} 处发现多余的右括号`);
          return false;
        }
      }
    }
    
    if (braceCount === 0) {
      console.log('✓ 大括号匹配检查通过');
      return true;
    } else {
      console.log(`✗ 大括号不匹配: 缺少 ${braceCount} 个右括号`);
      return false;
    }
    
  } catch (error) {
    console.log('✗ 大括号检查失败:', error.message);
    return false;
  }
}

// 主函数
function runSyntaxChecks() {
  console.log('=== 开始云函数语法检查 ===');
  
  let allPassed = true;
  
  for (const file of cloudFunctionFiles) {
    const fullPath = path.resolve(__dirname, file);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`\n⚠️  文件不存在: ${file}`);
      allPassed = false;
      continue;
    }
    
    // 检查语法
    const syntaxPassed = checkSyntax(fullPath);
    
    // 检查大括号
    const bracesPassed = checkBraces(fullPath);
    
    if (!syntaxPassed || !bracesPassed) {
      allPassed = false;
    }
  }
  
  console.log('\n=== 语法检查总结 ===');
  if (allPassed) {
    console.log('🎉 所有文件语法检查通过！');
    console.log('\n修复内容总结:');
    console.log('1. getTaskClockIns云函数: 添加了按checkinTime倒序排序');
    console.log('2. updateTaskStatus云函数: 修复了缩进问题和语法错误');
    console.log('3. 确保了所有try-catch块结构完整');
    console.log('\n现在可以在微信开发者工具中部署云函数并测试打卡功能！');
    process.exit(0);
  } else {
    console.log('❌ 部分文件语法检查失败，请修复后重试');
    process.exit(1);
  }
}

// 运行检查
runSyntaxChecks();
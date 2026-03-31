// 简单的语法和依赖检查脚本
const fs = require('fs');
const path = require('path');

// 检查的文件列表
const filesToCheck = [
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/pages/index/index.js',
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/pages/sensitivity/index.js',
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/pages/profile/index.js',
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/services/sensitivityService.js',
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/services/authService.js',
  '/Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst/services/userService.js'
];

console.log('开始检查文件语法和依赖...');

filesToCheck.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查语法错误
    new Function(content);
    
    // 检查服务类的使用方式
    if (content.includes('new sensitivityService')) {
      console.error(`❌ 文件 ${path.basename(filePath)} 中存在错误的服务类使用方式: new sensitivityService()`);
    } else {
      console.log(`✅ 文件 ${path.basename(filePath)} 语法检查通过`);
    }
    
  } catch (error) {
    console.error(`❌ 文件 ${path.basename(filePath)} 存在问题:`, error.message);
  }
});

console.log('\n检查完成！');
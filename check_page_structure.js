const fs = require('fs');
const path = require('path');

// 获取所有.js页面文件
const jsFiles = [
  'pages/auth/auth.js',
  'pages/clockin/calendar.js',
  'pages/clockin/index.js',
  'pages/clockin/task-stats.js',
  'pages/index/index.js',
  'pages/login/login.js',
  'pages/profile/about.js',
  'pages/profile/baby-info.js',
  'pages/profile/help.js',
  'pages/profile/index.js',
  'pages/sensitivity/add-record.js',
  'pages/sensitivity/detail.js',
  'pages/sensitivity/food-select.js',
  'pages/sensitivity/index.js',
  'pages/sensitivity/recommend.js',
  'pages/sensitivity/records.js',
  'pages/settings/index.js',
  'pages/statistics/index.js',
  'pages/suggest/list.js',
  'pages/task/create.js',
  'pages/task/index.js',
  'pages/template/index.js',
  'pages/test/test.js'
];

console.log('🔍 开始检查页面结构...\n');
let issuesFound = 0;

// 检查每个页面文件
jsFiles.forEach(jsFile => {
  const dir = path.dirname(jsFile);
  const baseName = path.basename(jsFile, '.js');
  const jsonFile = path.join(dir, baseName + '.json');
  const subDir = path.join(dir, baseName);
  
  console.log(`📄 检查页面: ${jsFile}`);
  
  // 检查是否存在同名子目录
  if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
    console.log(`   ❌ 错误: 存在同名子目录 ${subDir}`);
    issuesFound++;
  }
  
  // 检查是否存在.json配置文件
  if (!fs.existsSync(jsonFile)) {
    console.log(`   ⚠️  警告: 缺少配置文件 ${jsonFile}`);
    issuesFound++;
  }
  
  // 检查wxml和wxss文件
  const wxmlFile = path.join(dir, baseName + '.wxml');
  const wxssFile = path.join(dir, baseName + '.wxss');
  
  if (!fs.existsSync(wxmlFile)) {
    console.log(`   ⚠️  警告: 缺少wxml文件 ${wxmlFile}`);
    issuesFound++;
  }
  
  // wxss文件是可选的，不做强制检查
  
  console.log();
});

console.log('📊 检查完成！');
if (issuesFound > 0) {
  console.log(`⚠️  发现 ${issuesFound} 个问题需要修复！`);
} else {
  console.log('✅ 所有页面结构正常！');
}

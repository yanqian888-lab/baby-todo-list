// 测试云函数部署状态的脚本
const fs = require('fs');
const path = require('path');

/**
 * 检查云函数是否正确配置
 */
function checkCloudFunctions() {
  console.log('=== 检查云函数部署状态 ===\n');
  
  // 1. 检查login云函数是否存在
  const loginPath = path.join(__dirname, 'cloudfunctions/login/index.js');
  if (fs.existsSync(loginPath)) {
    console.log('✅ login云函数文件存在');
    const content = fs.readFileSync(loginPath, 'utf8');
    
    // 检查是否包含cloud导入
    if (content.includes('const cloud = require')) {
      console.log('   ✅ login云函数已正确导入cloud模块');
    } else {
      console.error('   ❌ login云函数缺少cloud模块导入');
    }
    
    // 检查是否包含cloud.init()
    if (content.includes('cloud.init()')) {
      console.log('   ✅ login云函数已正确初始化cloud');
    } else {
      console.error('   ❌ login云函数缺少cloud初始化');
    }
  } else {
    console.error('❌ login云函数文件不存在');
  }
  
  // 2. 检查cloudfunctions目录结构
  const cloudRoot = path.join(__dirname, 'cloudfunctions');
  if (fs.existsSync(cloudRoot)) {
    console.log('\n✅ cloudfunctions目录存在');
    
    // 检查package.json
    const pkgPath = path.join(cloudRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      console.log('   ✅ cloudfunctions/package.json存在');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies && pkg.dependencies['wx-server-sdk']) {
        console.log('   ✅ wx-server-sdk依赖已配置');
      } else {
        console.error('   ❌ wx-server-sdk依赖未配置');
      }
    } else {
      console.error('   ❌ cloudfunctions/package.json不存在');
    }
  }
  
  // 3. 检查云开发环境配置
  const projectConfigPath = path.join(__dirname, 'project.config.json');
  if (fs.existsSync(projectConfigPath)) {
    console.log('\n✅ project.config.json存在');
    const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    if (config.cloud && config.cloud.env) {
      console.log('   ✅ 云开发环境已配置:', config.cloud.env);
    } else {
      console.error('   ❌ 云开发环境未配置');
    }
  }
  
  console.log('\n=== 检查完成 ===');
  console.log('\n🚨 重要提示：');
  console.log('1. 确保已在微信开发者工具中登录并选择正确的云环境');
  console.log('2. 确保已将修改后的云函数重新部署到云端');
  console.log('3. 确保云函数依赖已正确安装');
}

checkCloudFunctions();
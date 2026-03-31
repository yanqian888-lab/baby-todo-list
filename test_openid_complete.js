// 完整的openid获取测试脚本
// 这个脚本需要在微信开发者工具的云开发控制台中运行
const fs = require('fs');
const path = require('path');

/**
 * 检查云函数部署状态
 */
function checkCloudFunctionDeployment() {
  console.log('=== 完整的openid获取问题排查 ===\n');
  
  // 检查login云函数内容
  const loginPath = path.join(__dirname, 'cloudfunctions/login/index.js');
  if (fs.existsSync(loginPath)) {
    console.log('✅ login云函数文件存在');
    const content = fs.readFileSync(loginPath, 'utf8');
    
    // 显示云函数核心代码
    console.log('\n📋 login云函数核心代码:');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (index < 20) {
        console.log(`   ${line}`);
      }
    });
  }
  
  // 检查userService.js中的login方法
  const userServicePath = path.join(__dirname, 'utils/userService.js');
  if (fs.existsSync(userServicePath)) {
    console.log('\n📋 userService.js中的login方法:');
    const content = fs.readFileSync(userServicePath, 'utf8');
    const loginSection = content.match(/login\s*:\s*function\s*\([^)]*\)\s*\{[\s\S]*?\}/);
    if (loginSection) {
      console.log(loginSection[0].replace(/\n/g, '\n   '));
    }
  }
  
  console.log('\n🔍 可能的问题原因:');
  console.log('1. 云函数未部署到云端');
  console.log('2. 微信开发者工具未登录或登录账号不正确');
  console.log('3. 云开发环境未开通或权限配置错误');
  console.log('4. 小程序appid与云开发环境不匹配');
  
  console.log('\n📱 用户操作指南:');
  console.log('1. 打开微信开发者工具，确保已登录正确的微信账号');
  console.log('2. 点击左侧「云开发」按钮，确认云开发环境已开通');
  console.log('3. 在「云函数」面板中，找到login函数，点击「部署」');
  console.log('4. 部署完成后，重新运行小程序尝试登录');
  console.log('5. 如仍失败，检查云开发控制台中的「日志」记录');
  
  console.log('\n📝 验证方法:');
  console.log('在微信开发者工具中按F12打开控制台，查看是否有以下错误信息:');
  console.log('- cloud.callFunction:fail');
  console.log('- Error: errCode: -501000');
  console.log('- openid is undefined');
}

// 执行检查
checkCloudFunctionDeployment();
# access_token missing 错误修复指南

## 错误现象
```
cloud init error: Error: access_token missing
cloud.callFunction:fail Error: access_token missing
```

## 问题原因
这是微信开发者工具与微信服务器之间的**身份验证问题**，不是代码问题。

可能原因：
1. 开发者工具登录会话过期
2. 项目 AppID 与登录账号不匹配
3. 云开发环境未正确初始化
4. 微信服务器临时故障

---

## 🔧 修复步骤（从简单到复杂）

### 方法 1：刷新登录状态（最快）

1. **打开微信开发者工具**
2. **点击右上角头像/设置图标**
3. **选择「退出登录」**
4. **关闭开发者工具**
5. **重新打开开发者工具**
6. **用微信扫码登录**（必须是小程序的管理员或开发者）
7. **重新编译项目**

### 方法 2：检查项目配置

1. **打开项目**
2. **点击右上角「详情」按钮**
3. **检查以下配置：**
   - AppID：必须是正确的已注册小程序 AppID
   - 开发模式：小程序
   - 使用云开发：已勾选
   
   你的项目配置：
   - AppID: `wx07137a5c4479d119`
   - 云环境: `cloud1-9g2wikx47c9ba4ec`

### 方法 3：重新关联云开发环境

1. **点击工具栏「云开发」按钮**
2. **如果显示「未开通云开发」：**
   - 点击开通
   - 选择「按量付费」（有免费额度）
3. **如果已开通：**
   - 点击「设置」→「环境设置」
   - 复制环境 ID
   - 打开 `project.config.json`
   - 确保 `cloud.env` 与环境 ID 一致

### 方法 4：重置开发者工具

1. **关闭开发者工具**
2. **删除本地缓存：**
   ```
   macOS: ~/Library/Application Support/微信开发者工具/
   Windows: C:\Users\用户名\AppData\Local\微信开发者工具\
   ```
3. **重新安装开发者工具**（从官网下载最新版）
4. **重新导入项目**

### 方法 5：检查微信账号权限

确保扫码登录的微信账号满足以下条件：
- 是小程序的**管理员**或**开发者**
- 没有被封禁或限制
- 可以访问微信公众平台

---

## 🧪 验证修复

修复后，在开发者工具 Console 输入以下代码测试：

```javascript
wx.cloud.callFunction({
  name: 'login',
  data: {}
}).then(res => {
  console.log('✅ 云开发正常:', res);
}).catch(err => {
  console.error('❌ 云开发错误:', err);
});
```

如果返回成功信息（包含 openid），说明修复成功。

---

## 🆘 如果以上方法都无效

### 临时绕过方案（本地开发）

修改 `app.js`，使用本地模式：

```javascript
onLaunch: function() {
  // 暂时跳过云开发初始化
  console.log('⚠️ 云开发已禁用，使用本地模式');
  
  // 设置模拟数据
  const mockUserInfo = {
    openId: 'mock-openid-' + Date.now(),
    nickName: '本地测试用户',
    avatarUrl: '/images/default-avatar.svg'
  };
  
  wx.setStorageSync('userInfo', mockUserInfo);
  this.globalData.userInfo = mockUserInfo;
}
```

修改 `pages/index/index.js`，禁用云函数调用：
- 将所有 `wx.cloud.callFunction` 调用注释掉
- 使用模拟数据渲染页面

---

## 📞 寻求官方帮助

如果仍然无法解决：

1. **微信开发者社区**：https://developers.weixin.qq.com/
2. **微信客服**：小程序后台 → 客服反馈
3. **错误码查询**：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference/error-code.html

提供以下信息：
- 错误截图
- 开发者工具版本
- 项目 AppID
- 云开发环境 ID

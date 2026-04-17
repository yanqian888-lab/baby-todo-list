# 500 错误排查指南

## 问题现象
页面上显示 "something wrong with request handler"
控制台显示 "Failed to load resource: the server responded with a status of 500"

## 可能原因

### 1. 云函数未部署 ⭐最常见
**症状**：云函数代码存在但从未部署到云端

**解决方法**：
1. 打开微信开发者工具
2. 在左侧文件树中找到 `cloudfunctions/login` 文件夹
3. 右键点击 → 选择"创建并部署：云端安装依赖"
4. 对所有云函数重复此操作（特别是 login、getTasks、getUserStatistics）

### 2. 数据库集合不存在
**症状**：云函数尝试访问不存在的集合

**解决方法**：
1. 打开云开发控制台（点击开发者工具工具栏上的"云开发"按钮）
2. 进入"数据库"标签
3. 创建以下集合（如果不存在）：
   - `users` - 用户信息
   - `tasks` - 任务数据
   - `task_completions` - 打卡记录
   - `baby_info` - 宝宝信息
   - `sensitivity_records` - 排敏记录

### 3. 数据库权限问题
**症状**：云函数可以读取但不能写入

**解决方法**：
1. 在云开发控制台 → 数据库中
2. 点击每个集合的"权限设置"
3. 设置为"所有用户可读，仅创建者可写"或"完全公开"

## 快速修复步骤

### 步骤1：检查并部署云函数
```
1. 在微信开发者工具中
2. 展开 cloudfunctions 文件夹
3. 对每个子文件夹（login、getTasks等）
4. 右键 → "创建并部署：云端安装依赖"
```

### 步骤2：创建数据库集合
```
1. 点击工具栏"云开发"按钮
2. 切换到"数据库"标签
3. 点击"添加集合"
4. 输入集合名称创建
```

### 步骤3：清除缓存重试
```
1. 开发者工具菜单：工具 → 清除缓存 → 全部清除
2. 重新编译项目
3. 重新登录
```

## 临时降级方案

如果暂时无法修复云函数，可以修改代码使用纯本地模式：

修改 `app.js` 中的 `checkUserLogin` 方法，注释掉云函数调用：

```javascript
// app.js
checkUserLogin: function() {
  // 使用本地登录，不检查云函数
  const storedUserInfo = wx.getStorageSync('userInfo');
  if (storedUserInfo) {
    this.globalData.userInfo = storedUserInfo;
    console.log('使用本地用户信息');
  }
  // 不再强制跳转登录页
}
```

修改 `pages/index/index.js` 中的 `initData`，使用模拟数据：

```javascript
async initData() {
  // 使用模拟数据
  this.setData({
    todayTasks: [],
    completedTasks: []
  });
  // 暂时不调用云函数
}
```

## 诊断信息收集

如果以上方法无效，请收集以下信息：

1. 开发者工具版本号
2. 基础库版本号
3. 云开发环境 ID
4. 具体的错误日志（Console 面板完整输出）
5. 云函数部署状态（已部署/未部署）

收集后提供给开发团队进行进一步排查。

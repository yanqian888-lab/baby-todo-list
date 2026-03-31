# 母婴打卡应用技术文档

## 📱 产品说明

### 产品概述
母婴打卡是一款专为新手父母设计的育儿任务管理工具，帮助用户记录宝宝的日常护理、喂养、睡眠等重要事项，通过打卡形式培养良好的育儿习惯，提供数据统计和分析，让育儿过程更加科学、有序。

### 核心功能
1. **任务管理**：创建、编辑、删除各类育儿任务
2. **打卡功能**：完成任务后进行打卡记录
3. **统计分析**：展示完成率、连续打卡天数等数据
4. **任务建议**：根据宝宝成长阶段推荐合适的育儿任务
5. **用户中心**：管理个人信息和宝宝信息

## 🛠️ 技术架构

### 技术栈
- **前端**：微信小程序原生开发
- **后端**：微信云开发（CloudBase）
- **数据库**：云开发数据库
- **云函数**：处理业务逻辑和数据统计

### 项目结构
```
├── app.js                 # 小程序入口文件
├── app.json               # 全局配置文件
├── app.wxss               # 全局样式
├── pages/                 # 页面文件夹
│   ├── index/            # 首页（打卡页面）
│   ├── login/            # 登录页面
│   ├── profile/          # 个人中心
│   ├── sensitivity/      # 排敏记录
│   ├── task/             # 任务管理
│   └── suggest/          # 任务建议
├── cloudfunctions/       # 云函数
│   ├── getTasks/         # 获取任务列表
│   ├── createTask/       # 创建任务
│   ├── clockIn/          # 打卡功能
│   └── getUserStatistics/ # 用户统计
└── images/               # 图片资源
```

## 📁 详细文件说明

### 1. 根目录文件

#### app.js
**功能**：小程序全局配置和初始化

```javascript
// 小程序初始化时执行
onLaunch: function() {
  // 初始化云开发环境
  wx.cloud.init({
    env: wx.cloud.DYNAMIC_CURRENT_ENV,
    traceUser: true
  });
  
  // 初始化数据库引用
  this.globalData.db = wx.cloud.database();
  
  // 检查用户登录状态
  this.checkUserLogin();
}
```

**主要功能点**：
- 云开发环境初始化
- 用户登录状态检查
- 全局数据管理
- 网络状态监控

#### app.json
**功能**：小程序全局配置文件，定义页面路径、窗口样式、tabBar等

```json
{
  "pages": [
    "pages/index/index",
    "pages/login/login",
    "pages/task/index",
    "pages/statistics/index",
    "pages/profile/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "母婴打卡",
    "navigationBarTextStyle": "black"
  },
  "tabBar": {
    "color": "#999",
    "selectedColor": "#FF6B8B",
    "backgroundColor": "#fff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/icon-stat.png",
        "selectedIconPath": "images/icon-stat-active.png"
      }
    ]
  }
}
```

**主要功能点**：
- 定义小程序页面路径
- 配置窗口样式
- 设置tabBar导航
- 配置网络超时时间

#### app.wxss
**功能**：小程序全局样式文件，定义全局样式变量和公共样式

```css
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

/* 容器样式 */
.container {
  padding: 20rpx;
  box-sizing: border-box;
}

/* 按钮样式 */
.btn-primary {
  background-color: #FF6B8B;
  color: white;
  border-radius: 8rpx;
  padding: 20rpx;
  text-align: center;
}
```

### 2. cloudfunctions 文件夹

#### clockIn/index.js
**功能**：处理用户打卡操作的云函数

```javascript
exports.main = async (event, context) => {
  const { taskId } = event;
  const { OPENID } = cloud.getWXContext();
  
  try {
    // 创建打卡记录
    await db.collection('task_completions').add({
      data: {
        taskId: taskId,
        userId: OPENID,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // 更新任务状态
    await db.collection('tasks').doc(taskId).update({
      data: {
        status: 'completed',
        updatedAt: new Date()
      }
    });
    
    return {
      success: true,
      message: '打卡成功'
    };
  } catch (error) {
    console.error('打卡失败:', error);
    return {
      success: false,
      message: '打卡失败',
      error: error
    };
  }
};
```

#### createTask/index.js
**功能**：创建新任务的云函数

```javascript
exports.main = async (event, context) => {
  const { name, subtitle, frequency, selectedDays = [] } = event;
  const { OPENID } = cloud.getWXContext();
  
  try {
    // 创建任务
    const result = await db.collection('tasks').add({
      data: {
        name: name,
        subtitle: subtitle,
        frequency: frequency,
        selectedDays: selectedDays,
        userId: OPENID,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    return {
      success: true,
      taskId: result._id,
      message: '任务创建成功'
    };
  } catch (error) {
    console.error('创建任务失败:', error);
    return {
      success: false,
      message: '创建任务失败',
      error: error
    };
  }
};
```

#### getTasks/index.js
**功能**：获取用户任务列表的云函数

```javascript
exports.main = async (event, context) => {
  const { status = 'pending' } = event;
  const { OPENID } = cloud.getWXContext();
  
  try {
    // 查询任务
    const tasks = await db.collection('tasks')
      .where({
        userId: OPENID,
        status: status
      })
      .orderBy('createdAt', 'desc')
      .get();
    
    return {
      success: true,
      tasks: tasks.data
    };
  } catch (error) {
    console.error('获取任务失败:', error);
    return {
      success: false,
      message: '获取任务失败',
      error: error
    };
  }
};
```

#### getUserStatistics/index.js
**功能**：获取用户统计数据的云函数

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  try {
    // 获取用户信息
    const user = await db.collection('users').where({ openid: OPENID }).get();
    
    if (user.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 获取打卡记录
    const clockIns = await db.collection('task_completions')
      .where({ userId: OPENID })
      .get();
    
    // 计算统计数据
    const statistics = calculateStatistics(user.data[0], clockIns.data);
    
    return {
      success: true,
      statistics: statistics
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      success: false,
      message: '获取统计数据失败',
      error: error
    };
  }
};
```

### 3. pages 文件夹

#### index/index.js
**功能**：首页，展示待打卡任务和已完成任务

```javascript
// 获取待打卡任务
async getTodoTasks(skipLoading = false) {
  if (!skipLoading) {
    wx.showLoading({ title: '加载中...' });
  }
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'getTasks',
      data: { status: 'pending' }
    });
    
    this.setData({
      todayTasks: res.result.tasks
    });
  } catch (error) {
    console.error('获取待打卡任务失败:', error);
  } finally {
    if (!skipLoading) {
      wx.hideLoading();
    }
  }
}
```

#### task/create.js
**功能**：创建新任务页面

```javascript
// 提交任务创建
async submitTask() {
  if (!this.validateForm()) {
    return;
  }
  
  wx.showLoading({ title: '创建任务...' });
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'createTask',
      data: {
        name: this.data.name,
        subtitle: this.data.subtitle,
        frequency: this.data.frequency,
        selectedDays: this.data.selectedDays
      }
    });
    
    if (res.result.success) {
      wx.showToast({ title: '任务创建成功' });
      wx.navigateBack();
    } else {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  } catch (error) {
    console.error('创建任务失败:', error);
    wx.showToast({ title: '创建失败', icon: 'none' });
  } finally {
    wx.hideLoading();
  }
}
```

#### statistics/index.js
**功能**：统计页面，展示用户打卡统计数据

```javascript
// 获取统计数据
async getStatistics() {
  wx.showLoading({ title: '加载中...' });
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'getUserStatistics'
    });
    
    if (res.result.success) {
      this.setData({
        statistics: res.result.statistics
      });
    } else {
      wx.showToast({ title: '获取统计数据失败', icon: 'none' });
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
    wx.showToast({ title: '获取统计数据失败', icon: 'none' });
  } finally {
    wx.hideLoading();
  }
}
```

#### profile/index.js
**功能**：个人中心页面，展示用户信息和设置

```javascript
// 更新用户信息
async updateUserInfo() {
  wx.showLoading({ title: '更新中...' });
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        nickName: this.data.userInfo.nickName,
        avatarUrl: this.data.userInfo.avatarUrl,
        babyInfo: this.data.babyInfo
      }
    });
    
    if (res.result.success) {
      wx.showToast({ title: '更新成功' });
      this.getUserInfo();
    } else {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  } catch (error) {
    console.error('更新用户信息失败:', error);
    wx.showToast({ title: '更新失败', icon: 'none' });
  } finally {
    wx.hideLoading();
  }
}
```

#### login/login.js
**功能**：登录页面，处理用户登录和授权

```javascript
// 处理微信登录
async handleLogin() {
  try {
    wx.showLoading({ title: '登录中...' });
    
    // 获取用户信息
    const userInfoRes = await wx.getUserProfile({
      desc: '用于完善用户资料'
    });
    
    // 调用登录云函数
    const loginRes = await wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: userInfoRes.userInfo
      }
    });
    
    if (loginRes.result.success) {
      // 登录成功，保存用户信息
      wx.setStorageSync('userInfo', loginRes.result.userInfo);
      wx.showToast({ title: '登录成功' });
      wx.navigateBack();
    } else {
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  } catch (error) {
    console.error('登录失败:', error);
    wx.showToast({ title: '登录失败', icon: 'none' });
  } finally {
    wx.hideLoading();
  }
}
```

### 4. services 文件夹

#### authService.js
**功能**：认证服务，处理用户登录、注册和授权

```javascript
// 微信登录
async function login(userInfo) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'login',
      data: { userInfo }
    });
    
    return res.result;
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, message: '登录失败' };
  }
}

// 检查用户登录状态
function checkLoginStatus() {
  const userInfo = wx.getStorageSync('userInfo');
  return !!userInfo;
}

module.exports = {
  login,
  checkLoginStatus
};
```

#### userService.js
**功能**：用户服务，处理用户信息相关操作

```javascript
// 获取用户信息
async function getUserInfo() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getUserInfo'
    });
    
    return res.result;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { success: false, message: '获取用户信息失败' };
  }
}

// 更新用户信息
async function updateUserInfo(userInfo) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: userInfo
    });
    
    return res.result;
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return { success: false, message: '更新用户信息失败' };
  }
}

module.exports = {
  getUserInfo,
  updateUserInfo
};
```

### 5. images 文件夹

**功能**：存储小程序所需的图片资源

- `icon-stat.png`：首页图标
- `icon-stat-active.png`：首页选中图标
- `default-avatar.svg`：默认头像
- `empty-stats.svg`：空统计数据图标

### 6. docs 文件夹

**功能**：存储项目文档

- `PRD文档.md`：产品需求文档
- `UI设计规范文档.md`：UI设计规范
- `开发指南.md`：开发指南
- `技术架构文档.md`：技术架构文档
- `数据存储方案.md`：数据存储方案


## 🎯 技术重点

### 1. 云开发架构
- 使用云函数处理业务逻辑，减少前端计算压力
- 云数据库存储用户数据和打卡记录
- 云存储保存用户上传的图片和文件

### 2. 数据安全
- 使用云开发的权限控制功能，确保数据安全
- 用户数据隔离，每个用户只能访问自己的数据
- 敏感数据加密存储

### 3. 性能优化
- 使用缓存技术减少网络请求
- 分页加载大量数据
- 图片资源优化

### 4. 错误处理
- 使用Promise.allSettled处理并行请求，确保单个请求失败不影响其他请求
- 完善的错误日志记录
- 用户友好的错误提示

## 🔧 核心功能代码说明

### 1. 任务打卡功能
```javascript
// 处理打卡操作
async handleCheckIn(e) {
  try {
    // 阻止事件冒泡
    e.stopPropagation();
    
    const taskId = e.currentTarget.dataset.id;
    
    // 调用云函数进行打卡
    wx.cloud.callFunction({
      name: 'clockIn',
      data: {
        taskId: taskId
      },
      success: res => {
        // 打卡成功，更新页面数据
        this.updateTaskStatus(taskId, true);
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });
      },
      fail: err => {
        // 打卡失败，显示错误信息
        console.error('打卡失败:', err);
        wx.showToast({
          title: '打卡失败，请重试',
          icon: 'none'
        });
      }
    });
  } catch (error) {
    console.error('handleCheckIn出错:', error);
    wx.showToast({
      title: '操作失败，请重试',
      icon: 'none'
    });
  }
}
```

### 2. 统计数据计算
```javascript
// 计算统计数据
calculateStats() {
  try {
    const todayTasks = this.data.todayTasks.length;
    const completedTasks = this.data.completedTasks.length;
    
    // 计算总任务数
    const total = todayTasks + completedTasks;
    
    // 计算已完成任务数
    let completed = completedTasks;
    this.data.todayTasks.forEach(task => {
      if (task.completed) {
        completed++;
      }
    });
    
    // 计算完成率
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // 更新统计数据
    this.setData({
      todayStats: {
        total: total,
        completed: completed,
        percentage: percentage
      }
    });
    
    console.log('统计数据计算完成:', this.data.todayStats);
  } catch (error) {
    console.error('计算统计数据失败:', error);
  }
}
```

### 3. 用户登录状态管理
```javascript
// 检查用户登录状态
checkUserLogin() {
  const that = this;
  
  // 先检查本地存储
  wx.getStorage({
    key: 'userInfo',
    success: function(res) {
      if (res.data && res.data.openId) {
        that.globalData.userInfo = res.data;
        console.log('用户信息已从本地加载');
        
        // 验证token有效性（如果有）
        if (res.data.token) {
          that.verifyToken();
        }
      } else {
        console.log('本地用户信息不完整');
        that.navigateToLogin();
      }
    },
    fail: function() {
      console.log('用户未登录或本地无存储');
      that.navigateToLogin();
    }
  });
}
```

## 📊 数据模型

### 1. 用户集合（users）
```javascript
{
  _id: string,          // 用户ID
  openid: string,       // 微信openid
  nickName: string,     // 昵称
  avatarUrl: string,    // 头像
  babyInfo: {
    name: string,       // 宝宝姓名
    birthDate: Date,    // 出生日期
    gender: number      // 性别
  },
  statistics: {
    streakDays: number, // 连续打卡天数
    totalClockIns: number, // 总打卡次数
    updatedTime: Date   // 更新时间
  },
  createdAt: Date,      // 创建时间
  updatedAt: Date       // 更新时间
}
```

### 2. 任务集合（tasks）
```javascript
{
  _id: string,          // 任务ID
  name: string,         // 任务名称
  subtitle: string,     // 任务描述
  frequency: string,    // 频率（daily/weekly/monthly/once）
  selectedDays: Array,  // 选择的日期（用于weekly/monthly）
  status: string,       // 状态（pending/completed）
  createdAt: Date,      // 创建时间
  updatedAt: Date       // 更新时间
}
```

### 3. 任务完成记录（task_completions）
```javascript
{
  _id: string,          // 记录ID
  taskId: string,       // 任务ID
  completedAt: Date,    // 完成时间
  createdAt: Date,      // 创建时间
  updatedAt: Date       // 更新时间
}
```

## 🚀 部署说明

### 开发环境配置
1. 安装微信开发者工具
2. 创建云开发环境
3. 配置project.config.json文件
4. 部署云函数

### 云函数部署
```bash
# 使用cloudbase-cli部署云函数
cb functions deploy
```

### 数据库初始化
1. 创建所需的集合
2. 设置集合权限
3. 导入初始数据

## 📝 开发规范

### 代码规范
1. 遵循微信小程序开发规范
2. 函数和变量命名使用驼峰命名法
3. 添加必要的注释
4. 使用ES6+语法

### 安全规范
1. 不要在前端代码中暴露敏感信息
2. 使用云函数处理敏感操作
3. 验证用户输入
4. 定期备份数据

## 🤝 协作说明

### 分支管理
- master：主分支，用于发布生产版本
- develop：开发分支，用于集成各个功能
- feature/xxx：功能分支，用于开发新功能
- fix/xxx：修复分支，用于修复bug

### 提交规范
- feat: 添加新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码风格调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建脚本或工具更新

## 🔮 未来规划

1. 添加宝宝成长记录功能
2. 支持多宝宝管理
3. 增加育儿知识文章
4. 实现数据导出功能
5. 接入第三方健康数据

## 📞 联系方式

如有问题或建议，请联系开发团队：
- 邮箱：contact@example.com
- 微信：xxx
- 电话：xxx-xxxx-xxxx

---

**更新时间**：2024年6月13日
**版本**：v1.0.0
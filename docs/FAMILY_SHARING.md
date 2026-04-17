# 家庭共享功能说明

## 功能概述

家庭共享功能允许多个家庭成员共同管理同一个宝宝的打卡任务和排敏记录。

## 核心特性

- 👨‍👩‍👧 **家庭创建**：创建家庭并设置宝宝信息
- 🔗 **成员邀请**：通过邀请码邀请家人加入
- 👥 **多人协作**：家庭成员可共同查看和管理任务
- 🔄 **数据同步**：所有成员数据实时同步
- 🔒 **权限管理**：创建者可管理成员和编辑宝宝信息

## 数据库集合

### 1. families（家庭信息）
```javascript
{
  _id: String,           // 家庭ID
  familyName: String,    // 家庭名称
  creatorOpenId: String, // 创建者OpenID
  babyInfo: {
    nickname: String,    // 宝宝昵称
    gender: String,      // 性别（boy/girl）
    birthday: String     // 生日
  },
  memberCount: Number,   // 当前成员数
  maxMembers: Number,    // 最大成员数（默认10）
  createdAt: Date,       // 创建时间
  updatedAt: Date        // 更新时间
}
```

### 2. family_members（家庭成员）
```javascript
{
  _id: String,        // 记录ID
  familyId: String,   // 家庭ID
  openId: String,     // 成员OpenID
  role: String,       // 角色（creator/admin/member）
  status: String,     // 状态（active/exited/removed）
  joinedAt: Date,     // 加入时间
  exitedAt: Date      // 退出时间
}
```

### 3. family_invitations（邀请记录）
```javascript
{
  _id: String,        // 记录ID
  familyId: String,   // 家庭ID
  inviteCode: String, // 邀请码（6位字母数字）
  createdBy: String,  // 创建者OpenID
  status: String,     // 状态（active/used/expired）
  createdAt: Date,    // 创建时间
  expireAt: Date,     // 过期时间
  usedBy: String,     // 使用者OpenID
  usedAt: Date        // 使用时间
}
```

## 云函数接口

### familyManager

#### createFamily
创建新家庭
```javascript
{
  action: 'createFamily',
  familyName: String,  // 家庭名称
  babyInfo: Object     // 宝宝信息
}
```

#### getMyFamilies
获取我的家庭列表
```javascript
{
  action: 'getMyFamilies'
}
```

#### inviteMember
生成邀请码
```javascript
{
  action: 'inviteMember',
  familyId: String  // 家庭ID
}
```

#### joinFamily
加入家庭
```javascript
{
  action: 'joinFamily',
  inviteCode: String  // 6位邀请码
}
```

#### exitFamily
退出家庭
```javascript
{
  action: 'exitFamily',
  familyId: String  // 家庭ID
}
```

#### removeMember
移除成员（创建者权限）
```javascript
{
  action: 'removeMember',
  familyId: String,     // 家庭ID
  memberOpenId: String  // 成员OpenID
}
```

#### updateBabyInfo
更新宝宝信息（创建者权限）
```javascript
{
  action: 'updateBabyInfo',
  familyId: String,  // 家庭ID
  babyInfo: Object   // 宝宝信息
}
```

## 前端页面

### 页面路由

| 页面 | 路径 | 说明 |
|------|------|------|
| 家庭管理 | `/pages/family/index` | 创建/加入/管理家庭 |
| 加入家庭 | `/pages/family/join` | 通过邀请链接加入 |
| 编辑宝宝 | `/pages/family/baby-info` | 编辑宝宝信息 |

### 服务模块

`services/familyService.js` 提供以下方法：

- `createFamily(familyName, babyInfo)` - 创建家庭
- `getMyFamilies()` - 获取家庭列表
- `switchFamily(familyId)` - 切换当前家庭
- `inviteMember(familyId)` - 生成邀请码
- `joinFamily(inviteCode)` - 加入家庭
- `exitFamily(familyId)` - 退出家庭
- `removeMember(familyId, memberOpenId)` - 移除成员
- `updateBabyInfo(familyId, babyInfo)` - 更新宝宝信息
- `getCurrentFamilyId()` - 获取当前家庭ID
- `shareInvite(familyId, inviteCode)` - 分享邀请配置

## 使用流程

### 创建家庭
1. 进入"我的"页面
2. 点击"家庭共享"
3. 点击"创建家庭"
4. 填写家庭名称和宝宝信息
5. 创建成功，自动成为管理员

### 邀请成员
1. 在家庭详情页点击"邀请"
2. 复制邀请码或分享给好友
3. 邀请码有效期7天

### 加入家庭
1. 通过分享链接进入或手动输入邀请码
2. 点击"加入"
3. 成为家庭成员

### 退出/解散家庭
- **成员退出**：进入家庭详情页，点击"退出家庭"
- **创建者解散**：账号注销时自动解散创建的家庭

## 权限说明

| 操作 | 创建者 | 成员 |
|------|--------|------|
| 查看家庭信息 | ✅ | ✅ |
| 编辑宝宝信息 | ✅ | ❌ |
| 邀请成员 | ✅ | ❌ |
| 移除成员 | ✅ | ❌ |
| 退出家庭 | ❌ | ✅ |

## 注意事项

1. **每人限创一个家庭**：一个用户只能创建一个家庭
2. **成员上限**：每个家庭最多10名成员
3. **邀请码有效期**：7天，过期自动失效
4. **数据隔离**：不同家庭的数据完全隔离
5. **账号注销**：注销时会自动退出或解散相关家庭

## 后续优化方向

1. 多宝宝支持：允许家庭添加多个宝宝
2. 任务分配：指定任务负责人
3. 消息通知：成员操作实时通知
4. 成长记录共享：照片、视频等多媒体共享

# task_completions集合创建指南

## 问题分析
测试结果确认，云数据库中**不存在**`task_completions`集合，这是导致`DATABASE_COLLECTION_NOT_EXIST`错误的直接原因。

## 解决方案
需要在云开发控制台手动创建`task_completions`集合。

## 创建步骤

### 方法1：手动在云开发控制台创建（推荐）

1. **登录云开发控制台**
   - 访问：https://console.cloud.tencent.com/tcb
   - 选择环境：`cloud1-9g2wikx47c9ba4ec`

2. **创建集合**
   - 进入左侧导航栏的「数据库」页面
   - 点击右上角的「创建集合」按钮
   - 在弹出的对话框中输入集合名称：`task_completions`
   - 点击「确定」按钮完成创建

3. **添加索引（推荐）**
   为了提高查询性能，建议添加以下索引：
   - 联合索引：`taskId` + `openid`（唯一索引）
     - 点击集合名进入集合详情页
     - 切换到「索引管理」标签页
     - 点击「添加索引」
     - 索引名称：`taskId_openid`
     - 索引字段：选择`taskId`（升序）和`openid`（升序）
     - 索引类型：唯一索引
     - 点击「确定」
   - 单字段索引：`completedAt`
     - 点击「添加索引」
     - 索引名称：`completedAt`
     - 索引字段：选择`completedAt`（升序）
     - 索引类型：普通索引
     - 点击「确定」

### 方法2：使用云函数自动创建

如果您已登录云开发账号，可以使用项目中已有的`ensureCollections`云函数自动创建集合：

```bash
# 进入项目根目录
cd /Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst

# 部署云函数
tcb fn deploy ensureCollections

# 调用云函数
tcb fn invoke ensureCollections
```

### 方法3：使用云函数自动创建（修正版本）

注意：`wx-server-sdk` 只能在云函数环境中运行，无法直接在本地Node.js环境使用。请使用以下步骤：

1. **登录云开发CLI**
   ```bash
   tcb login
   ```
   按照提示在浏览器中完成登录授权

2. **部署ensureCollections云函数**
   ```bash
   cd /Users/yanqian/Desktop/练习项目/03 母婴应用ToDOLIst
   tcb fn deploy ensureCollections
   ```

3. **调用云函数创建集合**
   ```bash
   tcb fn invoke ensureCollections
   ```

4. **验证结果**
   云函数调用成功后，会返回集合创建结果

## 集合结构说明

该集合用于存储任务完成记录，文档结构如下：

```json
{
  "_id": "自动生成的文档ID",
  "taskId": "任务ID字符串",
  "openid": "用户唯一标识",
  "completedAt": "完成时间（Timestamp类型）",
  "_createTime": "文档创建时间（系统自动生成）",
  "_updateTime": "文档更新时间（系统自动生成）"
}
```

## 验证方法

创建集合后，可以使用以下方式验证修复效果：

### 方法1：运行测试脚本
```bash
node test_collection_exists.js
```

### 方法2：调用云函数
```bash
tcb fn invoke testCollection
```

### 方法3：在小程序中测试
重新启动小程序并测试获取任务打卡记录功能。

## 注意事项

1. 确保集合名称**完全一致**：`task_completions`（全部小写，下划线分隔）
2. 确保操作环境正确：`cloud1-9g2wikx47c9ba4ec`
3. 创建集合后，系统会自动处理后续的数据写入操作

## 后续监控

建议创建集合后观察应用运行情况，确保：
- 获取任务打卡记录功能正常
- 任务完成状态更新功能正常
- 没有新的数据库错误产生
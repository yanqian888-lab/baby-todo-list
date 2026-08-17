// 云函数：删除任务
const cloud = require('wx-server-sdk');

// 初始化云环境，指定环境ID（如果有多个环境）
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用当前环境
});

const db = cloud.database();
const _ = db.command;

/**
 * deleteTask 云函数
 * 功能：执行任务软删除操作，将任务状态更新为deleted
 * 
 * 部署指南（通过微信云开发控制台手动部署）：
 * 1. 打开微信开发者工具，确保已登录微信开发者账号
 * 2. 点击左侧菜单栏的「云开发」按钮进入云开发控制台
 * 3. 在云开发控制台中，点击「云函数」选项卡
 * 4. 点击「新建云函数」按钮
 * 5. 填写函数名称为「deleteTask」，选择运行环境（Node.js 14或更高版本）
 * 6. 创建函数后，点击「函数代码」选项卡
 * 7. 复制本文件的完整代码粘贴到代码编辑器中
 * 8. 点击「依赖管理」选项卡，添加依赖项：
 *    - wx-server-sdk: ~2.3.2（或最新兼容版本）
 * 9. 点击「部署」按钮，等待部署完成
 * 10. 部署成功后，可以通过「函数配置」查看函数信息
 * 
 * 注意事项：
 * - 确保云环境已正确初始化，与小程序配置的环境ID一致
 * - 确保数据库中有tasks集合，并且具有适当的读写权限
 * - 函数部署后可能需要2-3分钟生效
 */
exports.main = async (event, context) => {
  try {
    // 获取用户信息
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || wxContext.openid;
    const appid = wxContext.APPID;
    
    console.log('=== 云函数deleteTask开始执行 ===', {
      taskId: event.taskId,
      openid: openid,
      appid: appid,
      timestamp: new Date().toISOString()
    });
    
    // 参数验证 - 更严格的检查
    if (!event.taskId) {
      console.error('参数错误: taskId未提供');
      return {
        success: false,
        error: '任务ID不能为空'
      };
    }
    
    if (typeof event.taskId !== 'string') {
      console.error('参数错误: taskId类型错误，期望字符串', typeof event.taskId);
      return {
        success: false,
        error: '任务ID格式错误'
      };
    }
    
    const taskId = event.taskId.trim();
    
    if (taskId === '') {
      console.error('参数错误: taskId为空白字符串');
      return {
        success: false,
        error: '任务ID不能为空'
      };
    }
    
    console.log('任务ID验证通过:', taskId);
    
    // 先查询任务是否存在并验证权限
    let taskData = null;
    try {
      console.log('开始查询任务信息...');
      const taskResult = await db.collection('tasks')
        .doc(taskId)
        .get();
      
      taskData = taskResult.data;
      console.log('查询任务成功，任务数据:', JSON.stringify(taskData).substring(0, 200) + '...'); // 限制日志长度
      
      // 验证任务所属权限：任务创建者或家庭创建者可删除
      const taskOwnerId = taskData._openid || taskData.openid;
      const taskFamilyId = taskData.familyId || null;
      let canDelete = false;
      if (taskOwnerId === openid) {
        canDelete = true;
      } else if (taskFamilyId) {
        try {
          const familyRes = await db.collection('families').doc(taskFamilyId).get();
          const family = familyRes.data || null;
          if (family && family.creatorOpenId === openid) {
            canDelete = true;
          }
        } catch (e) {
          console.warn('校验家庭创建者身份失败:', e);
        }
      }
      if (!canDelete) {
        console.error('权限验证失败: 当前用户无权删除此任务', {
          currentOpenid: openid,
          taskOwnerOpenid: taskOwnerId
        });
        return {
          success: false,
          error: '只有任务创建者或家庭创建者可以删除任务'
        };
      }
      console.log('权限验证通过，用户有权限删除此任务');
    } catch (getErr) {
      console.error('查询任务失败:', getErr);
      
      // 详细的错误类型判断
      if (getErr.errMsg && (getErr.errMsg.includes('document.get:fail') || 
          getErr.errMsg.includes('document not found') || 
          getErr.errMsg.includes('找不到记录'))) {
        return {
          success: false,
          error: '任务不存在或已被删除'
        };
      }
      
      return {
        success: false,
        error: `查询任务失败: ${getErr.message || '未知错误'}`
      };
    }
    
    // 检查任务是否已经被删除
    if (taskData.status === 'deleted') {
      console.warn('任务已被删除');
      return {
        success: false,
        error: '任务已被删除'
      };
    }
    
    // 执行软删除操作 - 更新status为deleted并记录删除时间
    try {
      console.log('开始执行软删除操作（更新status为deleted）...');
      const updateResult = await db.collection('tasks')
        .doc(taskId)
        .update({
          data: {
            status: 'deleted',
            deletedAt: db.serverDate() // 使用服务器时间
          }
        });
      
      console.log('软删除操作完成，结果:', JSON.stringify(updateResult));
      console.log('更新统计信息:', updateResult.stats);
      
      // 检查更新是否成功 - 更详细的结果检查
      if (updateResult.stats) {
        if (updateResult.stats.updated === 1) {
          console.log('软删除成功，影响行数:', updateResult.stats.updated);
          // 清理关联的打卡记录
          try {
            await db.collection('task_completions').where({ taskId }).remove();
            console.log('关联打卡记录清理完成');
          } catch (cleanupErr) {
            console.warn('清理关联打卡记录失败:', cleanupErr);
          }
          // 递减用户总任务数（仅在 totalTasks > 0 时递减，避免减成负数）
          try {
            const userStats = await db.collection('users').where({
              openid,
              'statistics.totalTasks': _.gt(0)
            }).get();
            if (userStats.data.length > 0) {
              await db.collection('users').where({ openid }).update({
                data: { 'statistics.totalTasks': _.inc(-1) }
              });
            }
          } catch (statsErr) {
            console.warn('更新用户统计失败:', statsErr);
          }
          return {
            success: true,
            message: '任务删除成功',
            stats: updateResult.stats
          };
        } else if (updateResult.stats.updated === 0) {
          console.warn('软删除操作执行但未更新任何文档');
          return {
            success: false,
            error: '删除失败，任务可能已被删除或无权限修改'
          };
        } else {
          console.error('更新结果异常，updated值:', updateResult.stats.updated);
          return {
            success: false,
            error: '更新结果异常，请检查任务状态'
          };
        }
      } else {
        console.error('软删除操作未返回stats信息');
        return {
          success: false,
          error: '软删除操作结果未知'
        };
      }
    } catch (updateErr) {
      console.error('执行软删除操作时异常:', updateErr);
      
      // 针对权限错误的特殊处理
      if (updateErr.errMsg) {
        if (updateErr.errMsg.includes('permission') || 
            updateErr.errMsg.includes('权限')) {
          return {
            success: false,
            error: '更新权限不足，请检查数据库权限配置'
          };
        } else if (updateErr.errMsg.includes('document') || 
                   updateErr.errMsg.includes('文档')) {
          if (updateErr.errMsg.includes('not exist') || 
              updateErr.errMsg.includes('不存在')) {
            return {
              success: false,
              error: '任务不存在或已被删除'
            };
          }
        }
      }
      
      return {
        success: false,
        error: `删除失败: ${updateErr.message || '未知错误'}`
      };
    }
  } catch (error) {
    console.error('删除任务云函数发生未捕获异常:', error);
    return {
      success: false,
      error: '系统错误，请稍后重试'
    };
  } finally {
    console.log('=== 云函数deleteTask执行结束 ===');
  }
};
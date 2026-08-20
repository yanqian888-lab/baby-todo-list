// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const cloudOpenid = wxContext.OPENID || wxContext.openid;  // 微信云开发自动获取的 openid
  const { userId } = event;  // 前端传入的 userId
  
  console.log('========== 开始删除用户数据 ==========');
  console.log('微信云开发 OPENID:', cloudOpenid);
  console.log('前端传入 userId:', userId);
  
  // 校验前端传入的 userId 必须与云端 openid 一致
  if (userId && userId !== cloudOpenid) {
    console.error('userId 与 cloudOpenid 不匹配，拒绝删除');
    return {
      success: false,
      error: '非法请求：用户身份不匹配'
    };
  }
  
  if (!cloudOpenid) {
    return {
      success: false,
      error: '无法获取用户 OPENID'
    };
  }

  try {
    const deleteResults = [];
    
    // 1. 删除 tasks 集合中匹配当前用户的任务
    try {
      const tasksRes = await db.collection('tasks').where({
        _openid: cloudOpenid,
        isTemplate: _.neq(true)
      }).remove();
      console.log('删除 tasks(by _openid) 结果:', tasksRes);
      deleteResults.push({ collection: 'tasks', stats: tasksRes.stats });
    } catch (e) {
      console.warn('删除 tasks(by _openid) 失败:', e);
    }
    
    // 2. 删除 users 集合（users 使用 openid 字段）
    try {
      const usersRes = await db.collection('users').where({
        openid: cloudOpenid
      }).remove();
      console.log('删除 users 结果:', usersRes);
      deleteResults.push({ collection: 'users', stats: usersRes.stats });
    } catch (e) {
      console.warn('删除 users 失败:', e);
    }
    
    // 3. 删除 baby_info 集合（baby_info 使用 userId 字段）
    try {
      const babyRes = await db.collection('baby_info').where({
        userId: cloudOpenid
      }).remove();
      console.log('删除 baby_info 结果:', babyRes);
      deleteResults.push({ collection: 'baby_info', stats: babyRes.stats });
    } catch (e) {
      console.warn('删除 baby_info 失败:', e);
    }
    
    // 4. 删除 sensitivity_records 集合（sensitivity_records 使用 userId 字段）
    try {
      const sensRes = await db.collection('sensitivity_records').where({
        userId: cloudOpenid
      }).remove();
      console.log('删除 sensitivity_records 结果:', sensRes);
      deleteResults.push({ collection: 'sensitivity_records', stats: sensRes.stats });
    } catch (e) {
      console.warn('删除 sensitivity_records 失败:', e);
    }
    
    // 5. 删除 task_completions 集合（task_completions 使用 _openid 字段）
    try {
      const compRes = await db.collection('task_completions').where({
        _openid: cloudOpenid
      }).remove();
      console.log('删除 task_completions 结果:', compRes);
      deleteResults.push({ collection: 'task_completions', stats: compRes.stats });
    } catch (e) {
      console.warn('删除 task_completions 失败:', e);
    }
    
    // 5.5 删除 clockIns 集合
    try {
      const clockRes = await db.collection('clockIns').where({
        openid: cloudOpenid
      }).remove();
      console.log('删除 clockIns 结果:', clockRes);
      deleteResults.push({ collection: 'clockIns', stats: clockRes.stats });
    } catch (e) {
      console.warn('删除 clockIns 失败:', e);
    }
    
    // 6. 处理家庭数据
    try {
      // 获取用户所在的所有家庭（同时查询 members 和 creatorOpenId，避免旧数据遗漏）
      const [joinedFamiliesRes, createdFamiliesRes] = await Promise.all([
        db.collection('families').where({
          'members.openId': cloudOpenid
        }).get(),
        db.collection('families').where({
          creatorOpenId: cloudOpenid
        }).get()
      ]);
      
      // 合并去重
      const familyMap = new Map();
      [...joinedFamiliesRes.data, ...createdFamiliesRes.data].forEach(family => {
        familyMap.set(family._id, family);
      });
      
      for (const family of familyMap.values()) {
        if (family.creatorOpenId === cloudOpenid) {
          // 是创建者：解散家庭（删除家庭、邀请码）
          // 先清除所有成员的 currentFamilyId
          const membersToClear = (family.members || []).filter(m => {
            const mOpenId = m.openId || m.openid || '';
            return mOpenId && mOpenId !== cloudOpenid;
          });
          for (const m of membersToClear) {
            const mOpenId = m.openId || m.openid || '';
            try {
              await db.collection('users').where({ openid: mOpenId }).update({
                data: { currentFamilyId: null }
              });
            } catch (e) {
              console.warn('清除成员 currentFamilyId 失败:', mOpenId, e);
            }
          }
          // 解散家庭前清理关联的任务和打卡记录
          try {
            const tasksRes = await db.collection('tasks').where({ familyId: family._id }).remove();
            deleteResults.push({ collection: 'tasks(dissolved)', stats: tasksRes.stats });
          } catch (e) {
            console.warn('解散家庭时清理任务失败:', e);
          }
          try {
            const completionsRes = await db.collection('task_completions').where({ familyId: family._id }).remove();
            deleteResults.push({ collection: 'task_completions(dissolved)', stats: completionsRes.stats });
          } catch (e) {
            console.warn('解散家庭时清理打卡记录失败:', e);
          }
          try {
            const checklistsRes = await db.collection('checklists').where({ familyId: family._id }).remove();
            deleteResults.push({ collection: 'checklists(dissolved)', stats: checklistsRes.stats });
          } catch (e) {
            console.warn('解散家庭时清理清单失败:', e);
          }
          try {
            const sensRecordsRes = await db.collection('sensitivity_records').where({ familyId: family._id }).remove();
            deleteResults.push({ collection: 'sensitivity_records(dissolved)', stats: sensRecordsRes.stats });
          } catch (e) {
            console.warn('解散家庭时清理排敏记录失败:', e);
          }
          await db.collection('families').doc(family._id).remove();
          await db.collection('family_invitations').where({
            familyId: family._id
          }).remove();
          deleteResults.push({ collection: 'families(dissolved)', familyId: family._id });
        } else {
          // 非创建者：从成员数组中移除（兼容 openId/openid 大小写）
          const updatedMembers = (family.members || []).filter(m => {
            const mOpenId = m.openId || m.openid || '';
            return mOpenId !== cloudOpenid;
          });
          await db.collection('families').doc(family._id).update({
            data: { 
              members: updatedMembers,
              memberCount: updatedMembers.length 
            }
          });
          // 清除退出者自身的 currentFamilyId
          try {
            await db.collection('users').where({ openid: cloudOpenid }).update({
              data: { currentFamilyId: null }
            });
          } catch (e) {
            console.warn('清除自身 currentFamilyId 失败:', cloudOpenid, e);
          }
          deleteResults.push({ collection: 'families(exited)', familyId: family._id });
        }
      }
      console.log('家庭数据处理完成，处理家庭数:', familyMap.size);
    } catch (e) {
      console.warn('处理家庭数据失败:', e);
    }
    
    // 8. 最终验证
    const checkResult = await db.collection('tasks').where({
      _openid: cloudOpenid
    }).count();
    
    console.log('========== 删除完成 ==========');
    console.log('剩余任务数:', checkResult.total);
    console.log('删除详情:', deleteResults);
    
    return {
      success: true,
      openid: cloudOpenid,
      remainingTasks: checkResult.total,
      message: '用户数据删除完成',
      details: deleteResults
    };
    
  } catch (error) {
    console.error('删除用户数据失败:', error);
    return {
      success: false,
      error: error.message || '删除失败'
    };
  }
};

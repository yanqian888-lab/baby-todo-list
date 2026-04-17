// 云函数：家庭管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 获取我的家庭列表
async function getMyFamilies(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  
  try {
    // 获取我加入的所有家庭（通过 members 数组或 creatorOpenId 查询）
    const familiesResult = await db.collection('families').where(_.or([
      { 'members.openId': OPENID },
      { creatorOpenId: OPENID }
    ])).get();
    
    // 获取用户当前家庭ID
    let currentFamilyId = null;
    try {
      const userResult = await db.collection('users').where({
        openid: OPENID
      }).get();
      if (userResult.data.length > 0) {
        currentFamilyId = userResult.data[0].currentFamilyId || null;
      }
    } catch (e) {
      console.warn('获取用户当前家庭ID失败:', e);
    }
    
    return { 
      success: true, 
      families: familiesResult.data,
      currentFamilyId: currentFamilyId
    };
  } catch (error) {
    console.error('获取家庭列表失败:', error);
    return { success: false, error: error.message };
  }
}

// 创建家庭
async function createFamily(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyName, babyInfo } = event;

  // 验证 babyInfo 类型和大小，防止文档膨胀
  if (babyInfo !== undefined && babyInfo !== null) {
    if (typeof babyInfo !== 'object' || Array.isArray(babyInfo)) {
      return { success: false, error: 'babyInfo 格式错误' };
    }
    const babyInfoStr = JSON.stringify(babyInfo);
    if (babyInfoStr.length > 4096) {
      return { success: false, error: 'babyInfo 数据过大' };
    }
  }

  try {
    // 检查是否已创建家庭
    const existing = await db.collection('families').where({
      creatorOpenId: OPENID
    }).get();
    
    if (existing.data.length > 0) {
      return { success: false, error: '您已创建过家庭' };
    }
    
    // 获取用户信息
    const userInfo = await getUserInfo(OPENID);
    const nickName = userInfo?.nickName || userInfo?.userInfo?.nickName || '我';
    
    // 创建家庭
    const familyData = {
      familyName: (familyName && String(familyName).trim().slice(0, 50)) || `${(babyInfo?.nickname || '宝宝').toString().slice(0, 20)}的家`,
      creatorOpenId: OPENID,
      babyNickname: (babyInfo?.nickname || '').toString().slice(0, 20),
      babyInfo: babyInfo || {},
      members: [{
        openId: OPENID,
        nickName: nickName,
        role: 'admin'
      }],
      createTime: new Date(),
      updateTime: new Date()
    };
    
    const addResult = await db.collection('families').add({
      data: familyData
    });
    
    // 更新用户当前家庭ID
    try {
      await db.collection('users').where({
        openid: OPENID
      }).update({
        data: {
          currentFamilyId: addResult._id,
          updateTime: new Date()
        }
      });
    } catch (e) {
      console.warn('更新用户当前家庭ID失败:', e);
    }
    
    return {
      success: true,
      familyId: addResult._id,
      currentFamilyId: addResult._id,
      family: { ...familyData, _id: addResult._id }
    };
  } catch (error) {
    console.error('创建家庭失败:', error);
    return { success: false, error: error.message };
  }
}

// 通用辅助：验证用户是否属于指定家庭
async function verifyFamilyMember(familyId, openId) {
  try {
    const familyDoc = await db.collection('families').doc(familyId).get();
    const family = familyDoc.data;
    if (!family) return { valid: false, error: '家庭不存在' };
    const isMember = family.creatorOpenId === openId || (family.members || []).some(m => m.openId === openId);
    if (!isMember) return { valid: false, error: '您不属于该家庭' };
    return { valid: true, family };
  } catch (error) {
    return { valid: false, error: '家庭校验失败' };
  }
}

// 更新宝宝信息
async function updateBabyInfo(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyId, babyInfo } = event;
  
  try {
    if (!familyId) {
      return { success: false, error: '缺少家庭ID' };
    }
    
    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    const family = verify.family;
    
    if (family.creatorOpenId !== OPENID) {
      return { success: false, error: '只有创建者可以更新宝宝信息' };
    }
    
    await db.collection('families').doc(familyId).update({
      data: {
        babyInfo: babyInfo,
        babyNickname: babyInfo?.nickname || family.babyNickname || '',
        updateTime: new Date()
      }
    });
    
    return { success: true, message: '宝宝信息更新成功' };
  } catch (error) {
    console.error('更新宝宝信息失败:', error);
    return { success: false, error: error.message };
  }
}

// 邀请成员
async function inviteMember(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyId } = event;
  
  try {
    // 验证创建者身份
    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    const family = verify.family;
    
    if (family.creatorOpenId !== OPENID) {
      return { success: false, error: '只有创建者可以邀请成员' };
    }
    
    // 生成邀请码（固定6位，不足补零，带查重）
    let inviteCode;
    let exist;
    do {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase().padStart(6, '0');
      exist = await db.collection('families').where({ 
        inviteCode,
        inviteCodeExpireTime: _.gte(new Date())
      }).count();
    } while (exist.total > 0);
    
    // 保存到家庭记录
    await db.collection('families').doc(familyId).update({
      data: {
        inviteCode: inviteCode,
        inviteCodeExpireTime: new Date(Date.now() + 60 * 60 * 1000), // 1小时有效期
        updateTime: new Date()
      }
    });
    
    return { 
      success: true, 
      inviteCode: inviteCode,
      message: '邀请码生成成功'
    };
  } catch (error) {
    console.error('邀请成员失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取用户信息
async function getUserInfo(openId) {
  try {
    const userResult = await db.collection('users').where({
      openid: openId
    }).get();
    
    if (userResult.data.length > 0) {
      return userResult.data[0];
    }
    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

// 获取家庭详情
async function getFamilyById(familyId) {
  try {
    const familyDoc = await db.collection('families').doc(familyId).get();
    return familyDoc.data || null;
  } catch (error) {
    console.error('获取家庭详情失败:', error);
    return null;
  }
}

// 切换家庭
async function switchFamily(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyId } = event;

  try {
    if (!familyId) {
      return { success: false, error: '缺少家庭ID' };
    }

    const familyDoc = await db.collection('families').doc(familyId).get();
    const family = familyDoc.data;
    if (!family) {
      return { success: false, error: '家庭不存在' };
    }

    const isMember = family.creatorOpenId === OPENID || (family.members || []).some(member => member.openId === OPENID);
    if (!isMember) {
      return { success: false, error: '您不属于该家庭' };
    }

    try {
      await db.collection('users').where({
        openid: OPENID
      }).update({
        data: {
          currentFamilyId: familyId
        }
      });
      console.log('用户当前家庭ID已更新为:', familyId);
    } catch (userUpdateError) {
      console.warn('更新用户当前家庭ID失败:', userUpdateError);
    }

    return {
      success: true,
      family: family
    };
  } catch (error) {
    console.error('切换家庭失败:', error);
    return { success: false, error: error.message };
  }
}

// 加入家庭
async function joinFamily(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { inviteCode, nickName: clientNickName } = event;

  if (!inviteCode || !/^[A-Z0-9]{6}$/i.test(inviteCode)) {
    return { success: false, error: '邀请码格式错误' };
  }
  
  const normalizedCode = inviteCode.toUpperCase();
  
  try {
    // 根据邀请码查询家庭
    const familyResult = await db.collection('families').where({
      inviteCode: normalizedCode
    }).get();
    
    if (familyResult.data.length === 0) {
      return { success: false, error: '邀请码无效或已过期' };
    }
    
    const family = familyResult.data[0];

    // 检查邀请码是否过期
    if (!family.inviteCodeExpireTime || new Date(family.inviteCodeExpireTime) < new Date()) {
      return { success: false, error: '邀请码已过期' };
    }
    
    // 检查是否已在家庭中（包括创建者）
    const existingMember = family.members?.find(m => m.openId === OPENID);
    if (existingMember || family.creatorOpenId === OPENID) {
      return { success: false, error: '您已在该家庭中' };
    }
    
    // 获取用户信息以获取微信昵称（优先使用客户端传递的昵称）
    let nickName = clientNickName;
    if (!nickName || nickName === '微信用户' || nickName === '家庭成员') {
      const userInfo = await getUserInfo(OPENID);
      nickName = userInfo?.nickName || userInfo?.userInfo?.nickName || '家庭成员';
    }
    
    // 添加为新成员
    const newMember = {
      openId: OPENID,
      nickName: nickName,
      role: 'member',
      joinTime: new Date()
    };
    
    const updatedMembers = [...(family.members || []), newMember];
    
    // 更新家庭信息
    await db.collection('families').doc(family._id).update({
      data: {
        members: updatedMembers,
        updateTime: new Date()
      }
    });

    // 同步更新用户的 currentFamilyId
    await db.collection('users').where({ openid: OPENID }).update({
      data: {
        currentFamilyId: family._id,
        updateTime: new Date()
      }
    });
    
    return { 
      success: true, 
      familyId: family._id,
      currentFamilyId: family._id,
      familyName: family.familyName,
      message: '加入家庭成功'
    };
  } catch (error) {
    console.error('加入家庭失败:', error);
    return { success: false, error: error.message };
  }
}

// 移出成员
async function removeMember(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyId, memberOpenId } = event;
  
  try {
    // 验证创建者身份
    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    const family = verify.family;
    
    if (family.creatorOpenId !== OPENID) {
      return { success: false, error: '只有创建者可以移除成员' };
    }
    
    // 从成员数组中移除
    const updatedMembers = (family.members || []).filter(m => m.openId !== memberOpenId);
    
    await db.collection('families').doc(familyId).update({
      data: {
        members: updatedMembers,
        updateTime: new Date()
      }
    });

    // 清除被移除成员的 currentFamilyId
    await db.collection('users').where({ openid: memberOpenId, currentFamilyId: familyId }).update({
      data: { currentFamilyId: null }
    });

    // 清理被移除成员在该家庭任务上的打卡记录
    await db.collection('task_completions').where({
      familyId: familyId,
      _openid: memberOpenId
    }).remove();
    
    return { success: true, message: '移除成功' };
  } catch (error) {
    console.error('移除成员失败:', error);
    return { success: false, error: error.message };
  }
}

// 退出家庭
async function exitFamily(event, context) {
  const OPENID = (cloud.getWXContext().OPENID || cloud.getWXContext().openid);
  const { familyId } = event;
  
  try {
    // 先校验成员身份
    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    const family = verify.family;
    
    // 检查是否为创建者
    if (family.creatorOpenId === OPENID) {
      return { success: false, error: '创建者不能退出家庭' };
    }
    
    // 从成员数组中移除
    const updatedMembers = (family.members || []).filter(m => m.openId !== OPENID);
    
    await db.collection('families').doc(familyId).update({
      data: {
        members: updatedMembers,
        updateTime: new Date()
      }
    });
    
    // 清除用户的 currentFamilyId
    await db.collection('users').where({ openid: OPENID }).update({
      data: { currentFamilyId: null }
    });
    
    return { success: true, message: '退出成功' };
  } catch (error) {
    console.error('退出家庭失败:', error);
    return { success: false, error: error.message };
  }
}

// 主入口
exports.main = async (event, context) => {
  const { action } = event;
  
  switch (action) {
    case 'getMyFamilies':
      return await getMyFamilies(event, context);
    case 'createFamily':
      return await createFamily(event, context);
    case 'updateBabyInfo':
      return await updateBabyInfo(event, context);
    case 'switchFamily':
      return await switchFamily(event, context);
    case 'inviteMember':
      return await inviteMember(event, context);
    case 'joinFamily':
      return await joinFamily(event, context);
    case 'removeMember':
      return await removeMember(event, context);
    case 'exitFamily':
      return await exitFamily(event, context);
    default:
      return { success: false, error: '未知操作' };
  }
};

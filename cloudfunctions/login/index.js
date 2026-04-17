// 云函数：用户登录
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init();

const db = cloud.database();

// 生成6位随机字符（0-9 + a-z + A-Z）
function generateRandomCode(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成唯一随机昵称（基于 openid 后缀避免并发冲突）
function generateUniqueNickname(openid) {
  const suffix = (openid || '').slice(-6) || generateRandomCode(6);
  return `微信用户${suffix}`;
}

exports.main = async (event, context) => {
  // 获取小程序上下文
  const wxContext = cloud.getWXContext()
  const { code } = event

  try {
    // 优先使用微信上下文提供的openid
    let openid = wxContext.OPENID || wxContext.openid;
    let unionid = wxContext.UNIONID || wxContext.unionid;

    console.log('微信上下文openid:', openid);
    console.log('微信上下文unionid:', unionid);
    console.log('传入的code:', code);

    // 云函数内直接使用 wxContext.OPENID，无需调用微信登录接口
    if (!openid) {
      openid = wxContext.OPENID || wxContext.openid;
      unionid = wxContext.UNIONID || wxContext.unionid;
      console.log('使用微信上下文的openid:', openid);
    }

    // 如果仍然没有openid，返回错误
    if (!openid) {
      console.error('无法获取openid');
      return {
        success: false,
        error: '无法获取openid'
      };
    }

    let currentUser = null;

    // 尝试查询或创建用户
    try {
      // 查询用户是否已存在
      const userResult = await db.collection('users').where({
        openid: openid
      }).get()

      // 如果用户不存在，创建新用户
      if (userResult.data.length === 0) {
        const nickname = generateUniqueNickname(openid);
        await db.collection('users').add({
          data: {
            openid,
            unionid,
            createTime: new Date(),
            lastLoginTime: new Date(),
            avatarUrl: '',
            nickName: nickname,
            gender: 0,
            statistics: {
              totalTasks: 0,
              completedTasks: 0,
              consecutiveDays: 0,
              totalClockIns: 0
            }
          }
        })
        console.log('创建新用户成功，昵称:', nickname);
      } else {
        currentUser = userResult.data[0];
        const updateData = {
          lastLoginTime: new Date()
        };

        // 如果用户没有昵称或被微信默认昵称覆盖，重新生成随机昵称
        if (!currentUser.nickName || currentUser.nickName === '微信用户') {
          updateData.nickName = generateUniqueNickname(openid);
          console.log('为用户生成随机昵称:', updateData.nickName);
        }

        // 如果头像被微信默认头像覆盖，清空头像
        const isWechatDefaultAvatar = (url) => typeof url === 'string' && (url.includes('thirdwx.qlogo.cn') || url.includes('mmopen'));
        if (isWechatDefaultAvatar(currentUser.avatarUrl)) {
          updateData.avatarUrl = '';
        }

        // 更新用户的最后登录时间
        await db.collection('users').where({
          openid: openid
        }).update({
          data: updateData
        })
        console.log('更新用户最后登录时间成功');
      }
    } catch (dbError) {
      console.error('数据库操作失败:', dbError);
      // 数据库操作失败不影响登录流程，继续返回openid
    }

    // 查询最新的用户信息返回给前端
    let finalUserInfo = null;
    try {
      const latestUser = await db.collection('users').where({ openid: openid }).get();
      if (latestUser.data.length > 0) {
        finalUserInfo = latestUser.data[0];
      }
    } catch (e) {
      console.warn('查询最新用户信息失败:', e);
    }

    return {
      success: true,
      openid,
      unionid,
      userInfo: finalUserInfo ? {
        nickName: finalUserInfo.nickName,
        avatarUrl: finalUserInfo.avatarUrl,
        gender: finalUserInfo.gender
      } : null
    }
  } catch (error) {
    console.error('登录失败:', error)
    // 获取微信上下文的openid作为备选方案
    const fallbackOpenid = wxContext.OPENID || wxContext.openid;
    if (fallbackOpenid) {
      return {
        success: true,
        openid: fallbackOpenid,
        unionid: wxContext.UNIONID,
        error: error.message
      };
    }
    return {
      success: false,
      error: error.message
    }
  }
}
// 云函数：获取用户信息
const cloud = require('wx-server-sdk')
cloud.init()

function generateUniqueNickname(openid) {
  const suffix = (openid || '').slice(-6) || Math.floor(Math.random() * 1000000).toString();
  return `微信用户${suffix}`;
}

function isWechatDefaultAvatar(url) {
  return typeof url === 'string' && (url.includes('thirdwx.qlogo.cn') || url.includes('mmopen'));
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  
  try {
    // 查询用户信息
    const result = await cloud.database().collection('users').where({
      openid: openid
    }).get()
    
    if (result.data.length > 0) {
      const user = result.data[0];
      const updates = {};
      
      // 自动修复被微信默认信息覆盖的脏数据
      if (!user.nickName || user.nickName === '微信用户') {
        updates.nickName = generateUniqueNickname(openid);
        console.log('自动修复昵称:', updates.nickName);
      }
      if (isWechatDefaultAvatar(user.avatarUrl)) {
        updates.avatarUrl = '';
        console.log('自动清空头像（微信默认头像）');
      }
      
      if (Object.keys(updates).length > 0) {
        await cloud.database().collection('users').doc(user._id).update({
          data: { ...updates, updateTime: new Date() }
        });
        return {
          success: true,
          userInfo: { ...user, ...updates }
        };
      }
      
      return {
        success: true,
        userInfo: user
      }
    } else {
      return {
        success: false,
        error: '用户不存在'
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
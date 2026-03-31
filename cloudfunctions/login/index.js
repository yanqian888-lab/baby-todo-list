// 云函数：用户登录
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init();

exports.main = async (event, context) => {
  // 获取小程序上下文
  const wxContext = cloud.getWXContext()
  const { code } = event
  
  try {
    // 优先使用微信上下文提供的openid
    let openid = wxContext.OPENID;
    let unionid = wxContext.UNIONID;
    
    console.log('微信上下文openid:', openid);
    console.log('微信上下文unionid:', unionid);
    console.log('传入的code:', code);
    
    // 如果上下文没有openid，才调用微信登录接口
    if (!openid && code) {
      try {
        // 调用微信登录接口获取openid和session_key
        const result = await cloud.openapi.login({ code })
        
        // 获取用户的openid和unionid
        openid = result.openid;
        unionid = result.unionid;
        
        console.log('调用微信登录接口成功，openid:', openid);
      } catch (loginError) {
        console.error('调用微信登录接口失败:', loginError);
        // 如果调用微信登录接口失败，返回上下文的openid（如果有）
        if (wxContext.OPENID) {
          openid = wxContext.OPENID;
          console.log('使用微信上下文的openid:', openid);
        }
      }
    }
    
    // 如果仍然没有openid，返回错误
    if (!openid) {
      console.error('无法获取openid');
      return {
        success: false,
        error: '无法获取openid'
      };
    }
    
    // 尝试查询或创建用户，但即使失败也返回openid
    try {
      // 查询用户是否已存在
      const userInfo = await cloud.database().collection('users').where({
        openid: openid
      }).get()
      
      // 如果用户不存在，创建新用户
      if (userInfo.data.length === 0) {
        await cloud.database().collection('users').add({
          data: {
            openid,
            unionid,
            createTime: new Date(),
            lastLoginTime: new Date(),
            avatarUrl: '',
            nickName: '',
            gender: 0,
            statistics: {
              totalTasks: 0,
              completedTasks: 0,
              consecutiveDays: 0,
              totalClockIns: 0
            }
          }
        })
        console.log('创建新用户成功');
      } else {
        // 更新用户的最后登录时间
        await cloud.database().collection('users').where({
          openid: openid
        }).update({
          data: {
            lastLoginTime: new Date()
          }
        })
        console.log('更新用户最后登录时间成功');
      }
    } catch (dbError) {
      console.error('数据库操作失败:', dbError);
      // 数据库操作失败不影响登录流程，继续返回openid
    }
    
    return {
      success: true,
      openid,
      unionid
    }
  } catch (error) {
    console.error('登录失败:', error)
    // 获取微信上下文的openid作为备选方案
    const fallbackOpenid = wxContext.OPENID;
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
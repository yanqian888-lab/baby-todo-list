// 云函数：更新用户信息
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.openid
  const { userInfo } = event
  
  if (!userInfo || typeof userInfo !== 'object') {
    return {
      success: false,
      error: '缺少userInfo参数'
    }
  }
  
  try {
    // 只允许更新白名单内的字段，防止客户端覆盖敏感数据
    const allowedFields = ['nickName', 'avatarUrl', 'gender', 'country', 'province', 'city'];
    const sanitizedInfo = {};
    allowedFields.forEach(field => {
      if (userInfo[field] !== undefined) {
        sanitizedInfo[field] = userInfo[field];
      }
    });

    // 更新用户信息
    await cloud.database().collection('users').where({
      openid: openid
    }).update({
      data: {
        ...sanitizedInfo,
        updateTime: new Date()
      }
    })
    
    // 返回更新后的用户信息
    const result = await cloud.database().collection('users').where({
      openid: openid
    }).get()
    
    return {
      success: true,
      userInfo: result.data[0]
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
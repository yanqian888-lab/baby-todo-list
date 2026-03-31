// 云函数：更新用户信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  const { userInfo } = event
  
  try {
    // 更新用户信息
    await cloud.database().collection('users').where({
      openid: openid
    }).update({
      data: {
        ...userInfo,
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
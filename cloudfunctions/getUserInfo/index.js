// 云函数：获取用户信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { openid } = wxContext
  
  try {
    // 查询用户信息
    const result = await cloud.database().collection('users').where({
      openid: openid
    }).get()
    
    if (result.data.length > 0) {
      return {
        success: true,
        userInfo: result.data[0]
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
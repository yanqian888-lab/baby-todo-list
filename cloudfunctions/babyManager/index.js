// 云函数：宝宝信息管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const OPENID = cloud.getWXContext().OPENID || cloud.getWXContext().openid;
  const { action, babyInfo } = event;

  if (!OPENID) {
    return { success: false, error: '无法获取用户身份信息' };
  }

  try {
    switch (action) {
      case 'getBabyInfo':
        return await getBabyInfo(OPENID);
      case 'saveBabyInfo':
        return await saveBabyInfo(OPENID, babyInfo);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (error) {
    console.error('babyManager 执行失败:', error);
    return { success: false, error: error.message };
  }
};

async function getBabyInfo(openId) {
  try {
    const res = await db.collection('baby_info').where({ userId: openId }).get();
    return { success: true, data: res.data[0] || null };
  } catch (error) {
    console.error('获取宝宝信息失败:', error);
    return { success: false, error: error.message };
  }
}

async function saveBabyInfo(openId, babyInfo) {
  if (!babyInfo || !babyInfo.nickname || !babyInfo.birthday) {
    return { success: false, error: '宝宝昵称和出生日期不能为空' };
  }

  try {
    const babyInfoData = {
      userId: openId,
      nickname: babyInfo.nickname,
      birthday: babyInfo.birthday,
      gender: babyInfo.gender !== undefined ? babyInfo.gender : '',
      safeFoods: babyInfo.safeFoods || '',
      safeFoodsList: babyInfo.safeFoodsList || [],
      babyAge: babyInfo.babyAge || '',
      updatedAt: new Date()
    };

    const existing = await db.collection('baby_info').where({ userId: openId }).get();

    if (existing.data && existing.data.length > 0) {
      await db.collection('baby_info').doc(existing.data[0]._id).update({ data: babyInfoData });
      return { success: true, babyId: existing.data[0]._id };
    } else {
      babyInfoData.createdAt = new Date();
      const result = await db.collection('baby_info').add({ data: babyInfoData });
      return { success: true, babyId: result._id };
    }
  } catch (error) {
    console.error('保存宝宝信息失败:', error);
    return { success: false, error: error.message };
  }
}

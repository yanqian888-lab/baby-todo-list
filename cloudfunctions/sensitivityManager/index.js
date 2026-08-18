// 云函数：排敏记录管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 安全格式化日期（与前端 utils/helpers.js 的 safeDateFormat 保持一致）
function safeDateFormat(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 通用辅助：验证用户是否属于指定家庭
async function verifyFamilyMember(familyId, openId) {
  try {
    const familyDoc = await db.collection('families').doc(familyId).get();
    const family = familyDoc.data;
    if (!family) return { valid: false, error: '家庭不存在' };
    const isMember = family.creatorOpenId === openId || (family.members || []).some(m => m.openId === openId || m.openid === openId);
    if (!isMember) return { valid: false, error: '您不属于该家庭' };
    return { valid: true, family };
  } catch (error) {
    return { valid: false, error: '家庭校验失败' };
  }
}

// 新增排敏记录（openid/userId 以云端 context 为准，不信任前端传值）
async function addRecord(OPENID, record) {
  try {
    if (!record || typeof record !== 'object') {
      return { success: false, error: '记录数据格式错误' };
    }
    const data = { ...record, _openid: OPENID, userId: OPENID };
    delete data._id;
    const res = await db.collection('sensitivity_records').add({ data });
    return { success: true, data: { _id: res._id } };
  } catch (error) {
    console.error('新增排敏记录失败:', error);
    return { success: false, error: error.message };
  }
}

// 同步排敏记录：删除同家庭/用户同一天旧记录后写入新记录（替代前端直连 remove + add）
async function syncRecord(OPENID, record) {
  try {
    if (!record || typeof record !== 'object') {
      return { success: false, error: '记录数据格式错误' };
    }
    const todayStr = safeDateFormat(record.date);
    if (!todayStr) {
      return { success: false, error: '记录日期无效' };
    }

    // 基础查询条件
    const baseQuery = {};
    if (record.familyId) {
      const verify = await verifyFamilyMember(record.familyId, OPENID);
      if (!verify.valid) {
        return { success: false, error: verify.error };
      }
      baseQuery.familyId = record.familyId;
    } else {
      baseQuery._openid = OPENID;
      baseQuery.babyId = record.babyId;
    }

    // 获取该用户/家庭的所有记录，再在服务端过滤同一天
    const existing = await db.collection('sensitivity_records').where(baseQuery).get();
    const sameDayRecords = existing.data.filter(r => safeDateFormat(r.date) === todayStr);

    if (sameDayRecords.length > 0) {
      // 删除旧记录
      for (const old of sameDayRecords) {
        await db.collection('sensitivity_records').doc(old._id).remove();
      }
    }

    // 添加新记录
    const data = { ...record, _openid: OPENID, userId: OPENID };
    delete data._id;
    const res = await db.collection('sensitivity_records').add({ data });
    return { success: true, data: { _id: res._id } };
  } catch (error) {
    console.error('同步排敏记录失败:', error);
    return { success: false, error: error.message };
  }
}

// 删除排敏记录：按 recordId 删除单条，或按 date + familyId 删除当天记录
async function deleteRecord(OPENID, event) {
  try {
    const { recordId, date, familyId } = event;

    if (recordId) {
      const doc = await db.collection('sensitivity_records').doc(recordId).get();
      const record = doc.data;
      if (!record) {
        return { success: false, error: '记录不存在' };
      }
      // 鉴权：记录创建者本人，或该记录所属家庭的成员
      if (record.familyId) {
        const verify = await verifyFamilyMember(record.familyId, OPENID);
        if (!verify.valid) {
          return { success: false, error: verify.error };
        }
      } else if ((record._openid || record.userId) !== OPENID) {
        return { success: false, error: '无权删除该记录' };
      }
      await db.collection('sensitivity_records').doc(recordId).remove();
      return { success: true };
    }

    if (date) {
      const dateStr = safeDateFormat(date);
      if (!dateStr) {
        return { success: false, error: '日期无效' };
      }
      const query = {};
      if (familyId) {
        const verify = await verifyFamilyMember(familyId, OPENID);
        if (!verify.valid) {
          return { success: false, error: verify.error };
        }
        query.familyId = familyId;
      } else {
        query._openid = OPENID;
        query.familyId = _.exists(false);
      }
      const res = await db.collection('sensitivity_records').where(query).get();
      const sameDayRecords = res.data.filter(r => safeDateFormat(r.date) === dateStr);
      for (const record of sameDayRecords) {
        await db.collection('sensitivity_records').doc(record._id).remove();
      }
      return { success: true, data: { deleted: sameDayRecords.length } };
    }

    return { success: false, error: '缺少 recordId 或 date 参数' };
  } catch (error) {
    console.error('删除排敏记录失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取排敏记录（家庭模式下成员共享可见）
async function getRecords(OPENID, event) {
  try {
    const { familyId, babyId } = event;
    const query = {};
    if (familyId) {
      // 家庭模式下共享可见：校验成员后只按家庭ID查询，不限定用户
      const verify = await verifyFamilyMember(familyId, OPENID);
      if (!verify.valid) {
        return { success: false, error: verify.error };
      }
      query.familyId = familyId;
    } else {
      query._openid = OPENID;
      if (babyId && babyId !== 'local-baby-id') {
        query.babyId = babyId;
      }
    }
    const res = await db.collection('sensitivity_records').where(query).get();
    return { success: true, data: res.data || [] };
  } catch (error) {
    console.error('获取排敏记录失败:', error);
    return { success: false, error: error.message };
  }
}

// 按家庭获取宝宝信息（校验调用者是家庭成员）
async function getFamilyBabyInfo(OPENID, event) {
  try {
    const { familyId } = event;
    if (!familyId) {
      return { success: false, error: '缺少家庭ID' };
    }
    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    return { success: true, data: { babyInfo: verify.family.babyInfo || null } };
  } catch (error) {
    console.error('获取家庭宝宝信息失败:', error);
    return { success: false, error: error.message };
  }
}

// 主入口
exports.main = async (event, context) => {
  const OPENID = cloud.getWXContext().OPENID || cloud.getWXContext().openid;
  const { action } = event;

  if (!OPENID) {
    return { success: false, error: '无法获取用户身份信息' };
  }

  switch (action) {
    case 'addRecord':
      return await addRecord(OPENID, event.record);
    case 'syncRecord':
      return await syncRecord(OPENID, event.record);
    case 'deleteRecord':
      return await deleteRecord(OPENID, event);
    case 'getRecords':
      return await getRecords(OPENID, event);
    case 'getFamilyBabyInfo':
      return await getFamilyBabyInfo(OPENID, event);
    default:
      return { success: false, error: '未知操作' };
  }
};

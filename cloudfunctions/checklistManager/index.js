// 云函数：宝贝清单（家庭共享清单）管理
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 预制清单（家庭首次使用时自动实例化）
const PRESET_LISTS = [
  {
    presetId: 'shopping',
    name: '家庭购物清单',
    items: ['纸尿裤', '婴儿湿巾', '棉柔巾', '奶粉', '高铁米粉', '婴儿洗衣液', '护臀膏', '电子体温计']
  },
  {
    presetId: 'outing',
    name: '出门清单',
    items: ['纸尿裤', '湿巾', '奶瓶', '奶粉分装盒', '保温杯（温水）', '备用衣物', '口水巾', '小玩具', '防晒帽']
  },
  {
    presetId: 'travel',
    name: '旅行清单',
    items: ['宝宝证件（出生证明/户口本）', '纸尿裤', '奶粉', '奶瓶', '便携烧水壶', '辅食碗勺', '常备药（退烧药/益生菌）', '换洗衣物', '睡袋', '绘本玩具']
  },
  {
    presetId: 'hospital',
    name: '待产包',
    items: ['产褥垫', '产妇卫生巾', '一次性内裤', '吸管杯', '哺乳文胸', '新生儿衣服', '包被', 'NB 码纸尿裤', '婴儿帽', '证件（身份证/医保卡/产检本）']
  }
];

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

// 通用辅助：取出清单文档并校验调用者是其所属家庭的成员
async function getListAndVerify(listId, openId) {
  try {
    const listDoc = await db.collection('checklists').doc(listId).get();
    const list = listDoc.data;
    if (!list) return { valid: false, error: '清单不存在' };
    const verify = await verifyFamilyMember(list.familyId, openId);
    if (!verify.valid) {
      return { valid: false, error: verify.error };
    }
    return { valid: true, list, family: verify.family };
  } catch (error) {
    return { valid: false, error: '清单不存在' };
  }
}

// 生成条目ID
function genItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// 构造新条目（默认未勾选）
function makeItem(text) {
  return {
    id: genItemId(),
    text: text,
    checked: false,
    checkedBy: '',
    checkedByName: '',
    checkedAt: null
  };
}

// 获取家庭全部清单；若一条都没有则自动实例化 4 个预制清单（幂等，仅在 0 条时触发）
async function getLists(OPENID, event) {
  try {
    const { familyId } = event;
    if (!familyId) {
      return { success: false, error: '缺少家庭ID' };
    }

    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }
    const family = verify.family;

    let result = await db.collection('checklists').where({ familyId }).get();
    let lists = result.data || [];

    // 家庭首次使用：实例化预制清单
    if (lists.length === 0) {
      for (const preset of PRESET_LISTS) {
        await db.collection('checklists').add({
          data: {
            familyId: familyId,
            name: preset.name,
            items: preset.items.map(text => makeItem(text)),
            creatorOpenId: OPENID,
            isPreset: true,
            presetId: preset.presetId,
            createTime: new Date(),
            updateTime: new Date()
          }
        });
      }
      result = await db.collection('checklists').where({ familyId }).get();
      lists = result.data || [];
    }

    return {
      success: true,
      data: {
        lists: lists,
        isCreator: family.creatorOpenId === OPENID
      }
    };
  } catch (error) {
    console.error('获取清单列表失败:', error);
    return { success: false, error: error.message };
  }
}

// 创建清单（可携带预制清单条目）
async function createList(OPENID, event) {
  try {
    const { familyId, presetId } = event;
    const name = (event.name || '').toString().trim();

    if (!familyId) {
      return { success: false, error: '缺少家庭ID' };
    }
    if (!name) {
      return { success: false, error: '清单名称不能为空' };
    }
    if (name.length > 20) {
      return { success: false, error: '清单名称不能超过20个字' };
    }

    const verify = await verifyFamilyMember(familyId, OPENID);
    if (!verify.valid) {
      return { success: false, error: verify.error };
    }

    // 清单数量上限 20 个
    const countResult = await db.collection('checklists').where({ familyId }).count();
    if (countResult.total >= 20) {
      return { success: false, error: '清单数量已达上限（20个）' };
    }

    let items = [];
    if (presetId) {
      const preset = PRESET_LISTS.find(p => p.presetId === presetId);
      if (preset) {
        items = preset.items.map(text => makeItem(text));
      }
    }

    const listData = {
      familyId: familyId,
      name: name,
      items: items,
      creatorOpenId: OPENID,
      isPreset: !!presetId,
      presetId: presetId || null,
      createTime: new Date(),
      updateTime: new Date()
    };

    const addResult = await db.collection('checklists').add({ data: listData });
    return { success: true, data: { _id: addResult._id, list: { ...listData, _id: addResult._id } } };
  } catch (error) {
    console.error('创建清单失败:', error);
    return { success: false, error: error.message };
  }
}

// 重命名清单
async function renameList(OPENID, event) {
  try {
    const { listId } = event;
    const name = (event.name || '').toString().trim();

    if (!listId) {
      return { success: false, error: '缺少清单ID' };
    }
    if (!name) {
      return { success: false, error: '清单名称不能为空' };
    }
    if (name.length > 20) {
      return { success: false, error: '清单名称不能超过20个字' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    await db.collection('checklists').doc(listId).update({
      data: { name: name, updateTime: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('重命名清单失败:', error);
    return { success: false, error: error.message };
  }
}

// 删除清单（仅家庭创建者）
async function deleteList(OPENID, event) {
  try {
    const { listId } = event;
    if (!listId) {
      return { success: false, error: '缺少清单ID' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    if (check.family.creatorOpenId !== OPENID) {
      return { success: false, error: '只有家庭创建者可以删除清单' };
    }

    await db.collection('checklists').doc(listId).remove();
    return { success: true };
  } catch (error) {
    console.error('删除清单失败:', error);
    return { success: false, error: error.message };
  }
}

// 添加条目
async function addItem(OPENID, event) {
  try {
    const { listId } = event;
    const text = (event.text || '').toString().trim();

    if (!listId) {
      return { success: false, error: '缺少清单ID' };
    }
    if (!text) {
      return { success: false, error: '条目内容不能为空' };
    }
    if (text.length > 50) {
      return { success: false, error: '条目内容不能超过50个字' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
    const list = check.list;

    const items = list.items || [];
    if (items.length >= 100) {
      return { success: false, error: '单个清单条目已达上限（100条）' };
    }

    const newItem = makeItem(text);
    items.push(newItem);

    await db.collection('checklists').doc(listId).update({
      data: { items: items, updateTime: new Date() }
    });
    return { success: true, data: { item: newItem } };
  } catch (error) {
    console.error('添加条目失败:', error);
    return { success: false, error: error.message };
  }
}

// 重命名条目
async function renameItem(OPENID, event) {
  try {
    const { listId, itemId } = event;
    const text = (event.text || '').toString().trim();

    if (!listId || !itemId) {
      return { success: false, error: '缺少清单ID或条目ID' };
    }
    if (!text) {
      return { success: false, error: '条目内容不能为空' };
    }
    if (text.length > 50) {
      return { success: false, error: '条目内容不能超过50个字' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
    const list = check.list;

    const items = list.items || [];
    const item = items.find(i => i.id === itemId);
    if (!item) {
      return { success: false, error: '条目不存在' };
    }
    item.text = text;

    await db.collection('checklists').doc(listId).update({
      data: { items: items, updateTime: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('重命名条目失败:', error);
    return { success: false, error: error.message };
  }
}

// 删除条目（所有成员可删）
async function deleteItem(OPENID, event) {
  try {
    const { listId, itemId } = event;
    if (!listId || !itemId) {
      return { success: false, error: '缺少清单ID或条目ID' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
    const list = check.list;

    const items = list.items || [];
    const newItems = items.filter(i => i.id !== itemId);
    if (newItems.length === items.length) {
      return { success: false, error: '条目不存在' };
    }

    await db.collection('checklists').doc(listId).update({
      data: { items: newItems, updateTime: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('删除条目失败:', error);
    return { success: false, error: error.message };
  }
}

// 勾选/取消勾选条目
async function toggleItem(OPENID, event) {
  try {
    const { listId, itemId, checked } = event;
    if (!listId || !itemId) {
      return { success: false, error: '缺少清单ID或条目ID' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
    const list = check.list;

    const items = list.items || [];
    const item = items.find(i => i.id === itemId);
    if (!item) {
      return { success: false, error: '条目不存在' };
    }

    if (checked) {
      // 从 users 集合查询昵称
      let nickName = '';
      try {
        const userResult = await db.collection('users').where({ openid: OPENID }).get();
        if (userResult.data.length > 0) {
          nickName = userResult.data[0].nickName || '';
        }
      } catch (e) {
        console.warn('获取用户昵称失败:', e);
      }
      item.checked = true;
      item.checkedBy = OPENID;
      item.checkedByName = nickName;
      item.checkedAt = new Date();
    } else {
      item.checked = false;
      item.checkedBy = '';
      item.checkedByName = '';
      item.checkedAt = null;
    }

    await db.collection('checklists').doc(listId).update({
      data: { items: items, updateTime: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('勾选条目失败:', error);
    return { success: false, error: error.message };
  }
}

// 清除所有勾选（开启下一轮）
async function clearChecked(OPENID, event) {
  try {
    const { listId } = event;
    if (!listId) {
      return { success: false, error: '缺少清单ID' };
    }

    const check = await getListAndVerify(listId, OPENID);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
    const list = check.list;

    const items = (list.items || []).map(i => ({
      ...i,
      checked: false,
      checkedBy: '',
      checkedByName: '',
      checkedAt: null
    }));

    await db.collection('checklists').doc(listId).update({
      data: { items: items, updateTime: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('清除勾选失败:', error);
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
    case 'getLists':
      return await getLists(OPENID, event);
    case 'createList':
      return await createList(OPENID, event);
    case 'renameList':
      return await renameList(OPENID, event);
    case 'deleteList':
      return await deleteList(OPENID, event);
    case 'addItem':
      return await addItem(OPENID, event);
    case 'renameItem':
      return await renameItem(OPENID, event);
    case 'deleteItem':
      return await deleteItem(OPENID, event);
    case 'toggleItem':
      return await toggleItem(OPENID, event);
    case 'clearChecked':
      return await clearChecked(OPENID, event);
    default:
      return { success: false, error: '未知操作' };
  }
};

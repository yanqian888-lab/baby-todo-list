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
    presetId: 'hospital',
    name: '孕妈待产包',
    items: ['身份证', '医保卡', '产检本', '全部产检报告单', '银行卡', '现金', '结婚证', '出生证明办理材料（提前复印）', '一次性内裤15-20条', '大号产褥垫10片', '加长夜用、日用产妇卫生巾', '哺乳睡衣2套', '防滑拖鞋', '袜子', '哺乳内衣2件', '弯头吸管', '保温杯', '纸巾抽纸', '湿纸巾', '一次性马桶垫', '乳头膏', '收腹带（顺产不用立刻用，剖腹产遵医嘱）', '52码连体衣2-3件', '薄款包被1条', '厚款包被1条', '纱布小方巾4-6条', 'NB码纸尿裤一小包', '棉柔巾', '宝宝湿巾']
  },
  {
    presetId: 'home',
    name: '新生儿居家清单（0-3个月）',
    items: ['52码连体衣3-5件', '59码连体衣4-6件', '防惊跳包巾2条', '袜子若干', '双边吸奶器', '储奶袋', '储奶盒', '奶瓶2~3个', '奶瓶刷', '奶嘴', '乳头膏', '防溢乳垫', '小罐奶粉', '奶瓶消毒器/消毒柜', '恒温水壶', '棉柔巾', '纯水湿纸巾', '洗澡盆', '悬浮浴垫', '婴儿沐浴露洗发水二合一', '抚触油', '护臀膏', '医用碘伏棉签', '婴儿指甲剪套装', '婴儿床/拼接床', '床垫', '纯棉床单2套', '隔尿垫2-3条', '安全提篮/安全座椅', '轻便可折叠婴儿推车']
  },
  {
    presetId: 'outing',
    name: '日常出门随身包',
    items: ['纸尿裤若干片', '棉柔巾', '云柔巾', '便携装宝宝湿巾', '便携隔尿垫', '护臀膏（便携装）', '密封垃圾袋（装脏衣物、脏尿不湿）', '备用衣一套（应对吐奶、漏屎）', '薄小盖毯', '口水纱布方巾', '保温杯', '奶瓶', '便携奶粉分装盒', '哺乳巾（母乳妈妈）', '防溢乳垫', '免洗洗手液', '安抚奶嘴/小型安抚玩具', '防晒帽', '腰凳/轻便推车']
  },
  {
    presetId: 'travel',
    name: '短途过夜旅行清单',
    items: ['宝宝出生证明复印件', '宝宝医保卡', '纸尿裤足量（多备1/3余量）', '棉柔巾', '云柔巾', '便携湿巾', '可水洗隔尿垫', '护臀膏', '抚触油便携装', '婴儿洗护二合一旅行装', '换洗衣2-3套', '袜子', '薄外套', '纱布方巾多条', '奶瓶2-3个', '便携奶瓶刷', '恒温水壶', '奶粉（按天数准备）', '储奶袋（母乳妈妈）', '吸奶器', '安抚玩偶/安抚奶嘴', '电子体温计']
  },
  {
    presetId: 'weaning',
    name: '辅食必备工具',
    items: ['食品级辅食碗（吸盘款，防打翻）', '软头辅食勺2-3把（不同硬度，训练吃饭）', '防水硅胶围兜2个', '辅食锅（小奶锅，蒸煮一体）', '蒸格（搭配小锅蒸菜、蒸肉）', '辅食研磨碗（手动研磨，初期泥状辅食）', '辅食机/料理棒（打泥、打碎，料理棒更省收纳）', '食物储存盒（分格，冷冻分装辅食）', '辅食冷冻格（硅胶，冻肉泥菜泥，脱模方便）', '食品密封袋（分装小份食材、零食）', '刀具+小菜板（宝宝专用，生熟分开）', '刷碗小刷子、奶瓶刷（清洗辅食工具）', '硅胶食物咬咬乐', '消毒柜', '食物称（精准记录食材重量）']
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

// 获取家庭全部清单；若一条都没有且未初始化过则自动实例化 6 个预制清单（确定性ID + 初始化标记，保证幂等）
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

    // 家庭首次使用：实例化预制清单（presetsInitialized 标记防止用户删光后复活）
    if (lists.length === 0 && !family.presetsInitialized) {
      for (const preset of PRESET_LISTS) {
        // 使用确定性文档ID，set 幂等，并发首次进入不会重复插入
        await db.collection('checklists').doc(`${familyId}_${preset.presetId}`).set({
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
      // 标记家庭已初始化预制清单，此后删光也不再复活
      try {
        await db.collection('families').doc(familyId).update({
          data: { presetsInitialized: true }
        });
      } catch (e) {
        console.warn('更新预制清单初始化标记失败，尝试 set 合并:', e);
        const { _id, ...familyData } = family;
        await db.collection('families').doc(familyId).set({
          data: { ...familyData, presetsInitialized: true }
        }).catch(err => console.error('set 合并家庭文档失败:', err));
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    let matchedPreset = null;
    if (presetId) {
      matchedPreset = PRESET_LISTS.find(p => p.presetId === presetId) || null;
      if (matchedPreset) {
        items = matchedPreset.items.map(text => makeItem(text));
      }
      // 传入查不到的 presetId 时按普通清单处理
    }

    const listData = {
      familyId: familyId,
      name: name,
      items: items,
      creatorOpenId: OPENID,
      isPreset: !!matchedPreset,
      presetId: matchedPreset ? matchedPreset.presetId : null,
      createTime: new Date(),
      updateTime: new Date()
    };

    const addResult = await db.collection('checklists').add({ data: listData });
    return { success: true, data: { _id: addResult._id, list: { ...listData, _id: addResult._id } } };
  } catch (error) {
    console.error('创建清单失败:', error);
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
  }
}

// 勾选/取消勾选条目
async function toggleItem(OPENID, event) {
  try {
    const { listId, itemId, checked } = event;
    if (!listId || !itemId) {
      return { success: false, error: '缺少清单ID或条目ID' };
    }
    if (typeof checked !== 'boolean') {
      return { success: false, error: '参数错误' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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
    return { success: false, error: '操作失败，请稍后再试' };
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

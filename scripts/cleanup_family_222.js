const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec'
});

const db = cloud.database();
const _ = db.command;

async function cleanup() {
  try {
    // 1. 找到 222 的家庭
    const familiesRes = await db.collection('families').where({
      familyName: '222的家'
    }).get();

    if (familiesRes.data.length === 0) {
      console.log('未找到 222 的家');
      return;
    }

    const familyId = familiesRes.data[0]._id;
    console.log('找到家庭ID:', familyId);

    // 2. 找到今天（2026-04-06）该家庭的 sensitivity_records
    const todayStr = '2026-04-06';
    const recordsRes = await db.collection('sensitivity_records').where({
      familyId: familyId,
      date: _.gte(`${todayStr}T00:00:00.000Z`).and(_.lte(`${todayStr}T23:59:59.999Z`))
    }).get();

    console.log('找到记录数:', recordsRes.data.length);
    for (const r of recordsRes.data) {
      console.log(' -', r.foodName, r.date, r._id);
    }

    // 3. 删除
    for (const record of recordsRes.data) {
      await db.collection('sensitivity_records').doc(record._id).remove();
      console.log('已删除记录:', record.foodName, record._id);
    }

    console.log('清理完成');
  } catch (err) {
    console.error('清理失败:', err);
  }
}

cleanup();

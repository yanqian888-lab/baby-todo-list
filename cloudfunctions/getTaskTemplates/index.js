// 云函数：获取任务模板
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  try {
    const db = cloud.database()
    const { category } = event
    
    // 构建查询条件
    const query = { isTemplate: true }
    if (category) {
      query.category = category
    }
    
    // 查询模板列表
    const templates = await db.collection('tasks')
      .where(query)
      .orderBy('createTime', 'desc')
      .get()
    
    // 准备任务模板数据
    const defaultTemplates = [
      // 孕妈妈任务模板
      {
        title: '称体重',
        description: '每天记录体重变化，监控孕期体重增长',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '量血压',
        description: '定期测量血压，预防妊娠高血压',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '测血糖',
        description: '监测血糖水平，预防妊娠期糖尿病',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '胎心监测',
        description: '定期听胎心，确保胎儿健康',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '吃叶酸',
        description: '补充叶酸，预防胎儿神经管畸形',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '吃钙片',
        description: '补充钙质，预防孕期缺钙',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '补铁',
        description: '补充铁剂，预防贫血',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '散步',
        description: '适量运动，有助于顺产和健康',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '孕期瑜伽',
        description: '缓解孕期不适，增强体质',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '凯格尔运动',
        description: '锻炼盆底肌，为分娩做准备',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '爬楼梯',
        description: '适量爬楼梯，有助于顺产',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      {
        title: '胎教',
        description: '进行音乐、语言等胎教活动',
        category: 'study',
        priority: 0,
        reminderTime: null,
        group: 'pregnant'
      },
      
      // 新手妈妈任务模板
      {
        title: '凯格尔运动',
        description: '产后恢复盆底肌功能',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'new_mom'
      },
      {
        title: '腹式呼吸',
        description: '促进产后恢复，缓解压力',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'new_mom'
      },
      
      // 宝宝任务模板 - 0~1月
      {
        title: '脐部消毒',
        description: '保持脐部清洁干燥，预防感染',
        category: 'care',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '洗屁屁',
        description: '清洁臀部，预防红屁股',
        category: 'hygiene',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '晾屁屁',
        description: '让臀部保持干燥透气',
        category: 'hygiene',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '黑白卡追视训练',
        description: '促进视觉发育',
        category: 'study',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '抚触操',
        description: '促进亲子关系，帮助宝宝放松',
        category: 'care',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '排气操',
        description: '帮助宝宝排气，缓解肠胀气',
        category: 'care',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '吃AD',
        description: '补充维生素AD，促进钙吸收',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      {
        title: '打疫苗',
        description: '按时接种疫苗，预防疾病',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '0-1'
      },
      
      // 宝宝任务模板 - 2~6个月
      {
        title: '追听训练',
        description: '用声音吸引宝宝，训练听力',
        category: 'study',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '追视训练',
        description: '用玩具引导宝宝追视，训练视觉',
        category: 'study',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '洗屁屁',
        description: '清洁臀部，预防红屁股',
        category: 'hygiene',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '晾屁屁',
        description: '让臀部保持干燥透气',
        category: 'hygiene',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '抚触操',
        description: '促进亲子关系，帮助宝宝放松',
        category: 'care',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '排气操',
        description: '帮助宝宝排气，缓解肠胀气',
        category: 'care',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '被动操',
        description: '帮助宝宝活动肢体，促进发育',
        category: 'activity',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '吃AD',
        description: '补充维生素AD，促进钙吸收',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '补钙',
        description: '补充钙质，促进骨骼发育',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      {
        title: '打疫苗',
        description: '按时接种疫苗，预防疾病',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '2-6'
      },
      
      // 宝宝任务模板 - 7~24个月
      {
        title: '洗屁屁',
        description: '清洁臀部，保持卫生',
        category: 'hygiene',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '晾屁屁',
        description: '让臀部保持干燥透气',
        category: 'hygiene',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '吃AD',
        description: '补充维生素AD，促进钙吸收',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '补钙',
        description: '补充钙质，促进骨骼发育',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: 'DHA',
        description: '补充DHA，促进大脑发育',
        category: 'health',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '刷牙',
        description: '清洁牙齿，培养口腔卫生习惯',
        category: 'hygiene',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '亲子共读',
        description: '培养阅读兴趣，促进语言发育',
        category: 'study',
        priority: 0,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      },
      {
        title: '打疫苗',
        description: '按时接种疫苗，预防疾病',
        category: 'health',
        priority: 1,
        reminderTime: null,
        group: 'baby',
        ageRange: '7-24'
      }
    ]
    
    // 如果数据库中没有模板，返回默认模板
    let result = templates.data
    if (result.length === 0) {
      // 使用 count 再次确认，防止并发重复插入
      const doubleCheck = await db.collection('tasks').where({ isTemplate: true }).count();
      if (doubleCheck.total === 0) {
        for (const template of defaultTemplates) {
          await db.collection('tasks').add({
            data: {
              ...template,
              isTemplate: true,
              status: 'pending',
              createTime: new Date(),
              updateTime: new Date()
            }
          })
        }
      }
      result = defaultTemplates
    }
    
    return {
      success: true,
      templates: result
    }
  } catch (error) {
    console.error('获取任务模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
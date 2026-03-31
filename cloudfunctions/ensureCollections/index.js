// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 确保必要的数据库集合存在，如果不存在则创建
 * 目前需要确保存在的集合：task_completions, task_clock_ins, users, clockIns, tasks
 */
async function ensureCollectionsExist() {
  const collectionsToCheck = ['task_completions', 'task_clock_ins', 'users', 'clockIns', 'tasks', 'sensitivity_foods', 'baby_info', 'sensitivity_records']
  const results = {}
  
  for (const collectionName of collectionsToCheck) {
    try {
      // 尝试查询集合，如果集合不存在会抛出错误
      await db.collection(collectionName).count()
      results[collectionName] = {
        exists: true,
        message: `${collectionName} 集合已存在`
      }
      console.log(`✅ ${collectionName} 集合已存在`)
    } catch (error) {
      if (error.errCode === -502005) {
        // 集合不存在，尝试创建
        try {
          // 在云函数中，我们需要通过创建文档的方式来隐式创建集合
          // 因为云开发不支持直接通过API创建空集合
          const testDocId = `test_${Date.now()}`
          await db.collection(collectionName).doc(testDocId).set({
            data: {
              test: true,
              createdAt: db.serverDate()
            }
          })
          
          // 删除测试文档
          await db.collection(collectionName).doc(testDocId).remove()
          
          results[collectionName] = {
            exists: false,
            created: true,
            message: `${collectionName} 集合已成功创建`
          }
          console.log(`✅ ${collectionName} 集合已成功创建`)
        } catch (createError) {
          results[collectionName] = {
            exists: false,
            created: false,
            error: createError.message,
            message: `创建 ${collectionName} 集合失败`
          }
          console.error(`❌ 创建 ${collectionName} 集合失败:`, createError)
        }
      } else {
        results[collectionName] = {
          exists: false,
          error: error.message,
          message: `检查 ${collectionName} 集合时发生未知错误`
        }
        console.error(`❌ 检查 ${collectionName} 集合时发生未知错误:`, error)
      }
    }
  }
  
  return results
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('=== 开始执行 ensureCollections 云函数 ===')
  
  try {
    const results = await ensureCollectionsExist()
    
    // 检查是否所有集合都已存在或创建成功
    const allSuccess = Object.values(results).every(result => 
      result.exists || result.created
    )
    
    return {
      success: allSuccess,
      results: results,
      message: allSuccess ? '所有必要集合已确保存在' : '部分集合创建失败，请检查错误信息'
    }
  } catch (error) {
    console.error('❌ 执行 ensureCollections 云函数失败:', error)
    return {
      success: false,
      error: error.message,
      message: '执行集合检查/创建时发生错误'
    }
  }
}
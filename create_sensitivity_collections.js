// 创建排敏功能所需的数据库集合脚本
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 创建指定名称的集合
 * @param {string} collectionName - 集合名称
 * @returns {Promise<Object>} 创建结果
 */
async function createCollection(collectionName) {
  console.log(`=== 开始创建${collectionName}集合 ===`);
  
  try {
    // 检查集合是否已存在
    console.log(`1. 检查${collectionName}集合是否存在...`);
    const countResult = await db.collection(collectionName).count();
    console.log(`✅ ${collectionName}集合已存在，文档数量: ${countResult.total}`);
    return {
      success: true,
      exists: true,
      collectionName: collectionName,
      message: `${collectionName}集合已存在`
    };
  } catch (error) {
    if (error.errCode === -502005) {
      // 集合不存在，需要创建
      console.log(`2. ${collectionName}集合不存在，开始创建...`);
      
      try {
        // 通过创建一个测试文档来隐式创建集合
        const testDocId = `test_${Date.now()}`;
        await db.collection(collectionName).doc(testDocId).set({
          data: {
            test: true,
            createdAt: db.serverDate()
          }
        });
        
        console.log('3. 测试文档创建成功，集合已隐式创建');
        
        // 删除测试文档
        await db.collection(collectionName).doc(testDocId).remove();
        console.log('4. 已删除测试文档');
        
        console.log(`✅ ${collectionName}集合创建成功`);
        return {
          success: true,
          exists: false,
          created: true,
          collectionName: collectionName,
          message: `${collectionName}集合创建成功`
        };
      } catch (createError) {
        console.error(`❌ 创建${collectionName}集合失败: ${createError.message}`);
        return {
          success: false,
          error: createError.message,
          collectionName: collectionName,
          message: `创建${collectionName}集合失败`
        };
      }
    } else {
      console.error(`❌ 检查${collectionName}集合时发生未知错误: ${error.message}`);
      return {
        success: false,
        error: error.message,
        collectionName: collectionName,
        message: `检查${collectionName}集合时发生未知错误`
      };
    }
  }
}

/**
 * 创建排敏功能所需的所有集合
 */
async function createAllSensitivityCollections() {
  console.log('\n=== 开始创建排敏功能所需集合 ===');
  
  // 排敏功能所需的集合列表
  const collections = [
    'sensitivity_foods',  // 排敏食物分类数据
    'baby_info',          // 宝宝信息
    'sensitivity_records' // 排敏记录
  ];
  
  const results = [];
  
  // 依次创建每个集合
  for (const collectionName of collections) {
    const result = await createCollection(collectionName);
    results.push(result);
  }
  
  return results;
}

// 执行创建函数
createAllSensitivityCollections()
  .then(results => {
    console.log('\n=== 所有集合创建结果 ===');
    
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    console.log(`✅ 成功: ${successResults.length}个集合`);
    failedResults.forEach(result => {
      console.log(`❌ 失败: ${result.collectionName} - ${result.message}`);
    });
    
    if (failedResults.length === 0) {
      console.log('\n🎉 所有排敏功能所需集合创建成功！');
    } else {
      console.log(`\n⚠️  部分集合创建失败，共${failedResults.length}个`);
    }
  })
  .catch(error => {
    console.error('\n❌ 执行失败:', error);
  });
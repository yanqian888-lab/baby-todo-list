// 创建必要的数据库集合脚本
// 注意：此脚本需要在微信开发者工具的云函数环境中运行，或在云开发控制台执行

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: 'cloud1-9g2wikx47c9ba4ec'
});

const db = cloud.database();

// 需要确保存在的集合列表
const collectionsToCreate = ['users', 'clockIns', 'tasks'];

/**
 * 创建集合（通过创建文档的方式隐式创建）
 * @param {string} collectionName - 集合名称
 * @returns {Promise<Object>} - 创建结果
 */
async function createCollection(collectionName) {
  try {
    // 尝试查询集合，如果集合不存在会抛出错误
    await db.collection(collectionName).count();
    return {
      success: true,
      exists: true,
      message: `${collectionName} 集合已存在`
    };
  } catch (error) {
    if (error.errCode === -502005) {
      // 集合不存在，尝试创建（通过创建文档的方式）
      try {
        const testDocId = `test_${Date.now()}`;
        await db.collection(collectionName).doc(testDocId).set({
          data: {
            test: true,
            createdAt: db.serverDate(),
            openid: 'test_openid'
          }
        });
        
        // 删除测试文档
        await db.collection(collectionName).doc(testDocId).remove();
        
        return {
          success: true,
          created: true,
          message: `${collectionName} 集合已成功创建`
        };
      } catch (createError) {
        return {
          success: false,
          error: createError.message,
          message: `创建 ${collectionName} 集合失败: ${createError.message}`
        };
      }
    } else {
      return {
        success: false,
        error: error.message,
        message: `检查 ${collectionName} 集合时发生未知错误: ${error.message}`
      };
    }
  }
}

/**
 * 主函数：创建所有必要的集合
 */
async function main() {
  console.log('=== 开始创建必要的数据库集合 ===');
  
  const results = {};
  let allSuccess = true;
  
  for (const collectionName of collectionsToCreate) {
    console.log(`\n处理集合: ${collectionName}`);
    const result = await createCollection(collectionName);
    results[collectionName] = result;
    
    if (result.exists) {
      console.log(`✅ ${result.message}`);
    } else if (result.created) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ ${result.message}`);
      allSuccess = false;
    }
  }
  
  console.log('\n=== 创建结果汇总 ===');
  for (const [collectionName, result] of Object.entries(results)) {
    const status = result.exists ? '已存在' : result.created ? '已创建' : '失败';
    console.log(`${collectionName}: ${status}`);
    if (!result.success) {
      console.log(`  错误信息: ${result.error}`);
    }
  }
  
  return {
    success: allSuccess,
    results: results,
    message: allSuccess ? '所有必要集合已确保存在' : '部分集合创建失败，请检查错误信息'
  };
}

// 执行主函数
if (require.main === module) {
  main()
    .then(result => {
      console.log('\n=== 执行完成 ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('\n❌ 执行过程中发生错误:', error);
    });
}

module.exports = { main };
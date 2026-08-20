const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 直接把最新数据内嵌在云函数里，避免依赖本地文件路径
const sensitivityFoodsData = {
  "categories": [
    {
      "id": "grain",
      "name": "高铁基础谷物类",
      "sortOrder": 1,
      "foods": [
        {
          "_id": "1",
          "name": "高铁婴儿米粉",
          "allergyLevel": 1,
          "sortOrder": 1,
          "sensitivityOrder": 0,
          "recipes": [
            "原味米糊",
            "米粉南瓜糊",
            "米粉苹果糊"
          ]
        },
        {
          "_id": "2",
          "name": "小米",
          "allergyLevel": 1,
          "sortOrder": 2,
          "sensitivityOrder": 1,
          "recipes": [
            "小米粥",
            "小米南瓜粥",
            "小米山药粥"
          ]
        },
        {
          "_id": "3",
          "name": "燕麦",
          "allergyLevel": 1,
          "sortOrder": 3,
          "sensitivityOrder": 2,
          "recipes": [
            "燕麦糊",
            "燕麦香蕉糊",
            "燕麦苹果粥"
          ]
        },
        {
          "_id": "4",
          "name": "藜麦",
          "allergyLevel": 1,
          "sortOrder": 4,
          "sensitivityOrder": 3,
          "recipes": [
            "藜麦米糊",
            "藜麦南瓜粥",
            "藜麦蔬菜粥"
          ]
        },
        {
          "_id": "5",
          "name": "大米粥",
          "allergyLevel": 1,
          "sortOrder": 5,
          "sensitivityOrder": 4,
          "recipes": [
            "白米粥",
            "大米南瓜粥",
            "大米青菜粥"
          ]
        },
        {
          "_id": "6",
          "name": "糙米",
          "allergyLevel": 1,
          "sortOrder": 6,
          "sensitivityOrder": 5,
          "recipes": [
            "糙米糊",
            "糙米大米粥",
            "糙米南瓜粥"
          ]
        },
        {
          "_id": "7",
          "name": "玉米",
          "allergyLevel": 1,
          "sortOrder": 7,
          "sensitivityOrder": 6,
          "recipes": [
            "玉米糊",
            "玉米泥",
            "玉米小米粥"
          ]
        }
      ]
    },
    {
      "id": "root_vegetable",
      "name": "淀粉类根茎蔬菜",
      "sortOrder": 2,
      "foods": [
        {
          "_id": "8",
          "name": "土豆",
          "allergyLevel": 1,
          "sortOrder": 8,
          "sensitivityOrder": 1,
          "recipes": [
            "土豆泥",
            "土豆南瓜泥",
            "土豆胡萝卜泥"
          ]
        },
        {
          "_id": "9",
          "name": "南瓜",
          "allergyLevel": 1,
          "sortOrder": 9,
          "sensitivityOrder": 1,
          "recipes": [
            "南瓜泥",
            "小米南瓜粥",
            "南瓜米糊"
          ]
        },
        {
          "_id": "10",
          "name": "山药",
          "allergyLevel": 1,
          "sortOrder": 10,
          "sensitivityOrder": 2,
          "recipes": [
            "山药泥",
            "山药小米粥",
            "山药苹果泥"
          ]
        },
        {
          "_id": "11",
          "name": "莲藕",
          "allergyLevel": 1,
          "sortOrder": 11,
          "sensitivityOrder": 3,
          "recipes": [
            "莲藕泥",
            "莲藕米糊",
            "莲藕雪梨羹"
          ]
        },
        {
          "_id": "12",
          "name": "红薯",
          "allergyLevel": 1,
          "sortOrder": 12,
          "sensitivityOrder": 4,
          "recipes": [
            "红薯泥",
            "红薯大米粥",
            "红薯米糊"
          ]
        },
        {
          "_id": "13",
          "name": "紫薯",
          "allergyLevel": 1,
          "sortOrder": 13,
          "sensitivityOrder": 5,
          "recipes": [
            "紫薯泥",
            "紫薯大米粥",
            "紫薯米糊"
          ]
        },
        {
          "_id": "14",
          "name": "芋头",
          "allergyLevel": 1,
          "sortOrder": 14,
          "sensitivityOrder": 6,
          "recipes": [
            "芋头泥",
            "芋头米糊",
            "芋头南瓜泥"
          ]
        },
        {
          "_id": "15",
          "name": "菱角",
          "allergyLevel": 1,
          "sortOrder": 15,
          "sensitivityOrder": 7,
          "recipes": [
            "菱角泥",
            "菱角米糊",
            "菱角大米粥"
          ]
        }
      ]
    },
    {
      "id": "leafy_vegetable",
      "name": "绿叶蔬菜类",
      "sortOrder": 3,
      "foods": [
        {
          "_id": "16",
          "name": "菠菜",
          "allergyLevel": 1,
          "sortOrder": 16,
          "sensitivityOrder": 1,
          "recipes": [
            "菠菜泥",
            "菠菜米糊",
            "菠菜大米粥"
          ]
        },
        {
          "_id": "17",
          "name": "西兰花",
          "allergyLevel": 1,
          "sortOrder": 17,
          "sensitivityOrder": 2,
          "recipes": [
            "西兰花泥",
            "西兰花米糊",
            "西兰花土豆泥"
          ]
        },
        {
          "_id": "18",
          "name": "油麦菜",
          "allergyLevel": 1,
          "sortOrder": 18,
          "sensitivityOrder": 3,
          "recipes": [
            "油麦菜泥",
            "油麦菜米糊",
            "油麦菜大米粥"
          ]
        },
        {
          "_id": "19",
          "name": "生菜",
          "allergyLevel": 1,
          "sortOrder": 19,
          "sensitivityOrder": 4,
          "recipes": [
            "生菜泥",
            "生菜米糊",
            "生菜大米粥"
          ]
        },
        {
          "_id": "20",
          "name": "油菜",
          "allergyLevel": 1,
          "sortOrder": 20,
          "sensitivityOrder": 5,
          "recipes": [
            "油菜泥",
            "油菜米糊",
            "油菜大米粥"
          ]
        },
        {
          "_id": "21",
          "name": "娃娃菜",
          "allergyLevel": 1,
          "sortOrder": 21,
          "sensitivityOrder": 6,
          "recipes": [
            "娃娃菜泥",
            "娃娃菜米糊",
            "娃娃菜大米粥"
          ]
        },
        {
          "_id": "22",
          "name": "芥蓝",
          "allergyLevel": 1,
          "sortOrder": 22,
          "sensitivityOrder": 7,
          "recipes": [
            "芥蓝泥",
            "芥蓝米糊",
            "芥蓝大米粥"
          ]
        },
        {
          "_id": "23",
          "name": "茼蒿",
          "allergyLevel": 1,
          "sortOrder": 23,
          "sensitivityOrder": 8,
          "recipes": [
            "茼蒿泥",
            "茼蒿米糊",
            "茼蒿大米粥"
          ]
        },
        {
          "_id": "24",
          "name": "菠菜苗",
          "allergyLevel": 1,
          "sortOrder": 24,
          "sensitivityOrder": 8,
          "recipes": [
            "菠菜苗泥",
            "菠菜苗米糊",
            "菠菜苗大米粥"
          ]
        }
      ]
    },
    {
      "id": "melon_vegetable",
      "name": "瓜茄类蔬菜",
      "sortOrder": 4,
      "foods": [
        {
          "_id": "25",
          "name": "黄瓜",
          "allergyLevel": 1,
          "sortOrder": 25,
          "sensitivityOrder": 1,
          "recipes": [
            "黄瓜泥",
            "黄瓜米糊",
            "黄瓜苹果泥"
          ]
        },
        {
          "_id": "26",
          "name": "番茄",
          "allergyLevel": 1,
          "sortOrder": 26,
          "sensitivityOrder": 2,
          "recipes": [
            "番茄泥",
            "番茄米糊",
            "番茄土豆泥"
          ]
        },
        {
          "_id": "27",
          "name": "西葫芦",
          "allergyLevel": 1,
          "sortOrder": 27,
          "sensitivityOrder": 3,
          "recipes": [
            "西葫芦泥",
            "西葫芦米糊",
            "西葫芦大米粥"
          ]
        },
        {
          "_id": "28",
          "name": "冬瓜",
          "allergyLevel": 1,
          "sortOrder": 28,
          "sensitivityOrder": 4,
          "recipes": [
            "冬瓜泥",
            "冬瓜米糊",
            "冬瓜大米粥"
          ]
        },
        {
          "_id": "29",
          "name": "丝瓜",
          "allergyLevel": 1,
          "sortOrder": 29,
          "sensitivityOrder": 5,
          "recipes": [
            "丝瓜泥",
            "丝瓜米糊",
            "丝瓜大米粥"
          ]
        },
        {
          "_id": "30",
          "name": "苦瓜",
          "allergyLevel": 1,
          "sortOrder": 30,
          "sensitivityOrder": 6,
          "recipes": [
            "苦瓜泥",
            "苦瓜米糊"
          ]
        },
        {
          "_id": "31",
          "name": "彩椒（甜椒）",
          "allergyLevel": 1,
          "sortOrder": 31,
          "sensitivityOrder": 8,
          "recipes": [
            "彩椒泥",
            "彩椒米糊",
            "彩椒土豆泥"
          ]
        }
      ]
    },
    {
      "id": "low_sugar_fruit",
      "name": "低糖低酸水果类",
      "sortOrder": 5,
      "foods": [
        {
          "_id": "32",
          "name": "苹果",
          "allergyLevel": 1,
          "sortOrder": 32,
          "sensitivityOrder": 1,
          "recipes": [
            "苹果泥",
            "蒸苹果泥",
            "苹果米糊"
          ]
        },
        {
          "_id": "33",
          "name": "梨",
          "allergyLevel": 1,
          "sortOrder": 33,
          "sensitivityOrder": 2,
          "recipes": [
            "梨泥",
            "蒸梨泥",
            "雪梨米糊"
          ]
        },
        {
          "_id": "34",
          "name": "香蕉",
          "allergyLevel": 1,
          "sortOrder": 34,
          "sensitivityOrder": 3,
          "recipes": [
            "香蕉泥",
            "香蕉米糊",
            "香蕉燕麦糊"
          ]
        },
        {
          "_id": "35",
          "name": "木瓜",
          "allergyLevel": 1,
          "sortOrder": 35,
          "sensitivityOrder": 4,
          "recipes": [
            "木瓜泥",
            "木瓜米糊",
            "木瓜香蕉泥"
          ]
        },
        {
          "_id": "36",
          "name": "白心火龙果",
          "allergyLevel": 1,
          "sortOrder": 36,
          "sensitivityOrder": 5,
          "recipes": [
            "火龙果泥",
            "火龙果米糊",
            "火龙果香蕉泥"
          ]
        },
        {
          "_id": "37",
          "name": "猕猴桃",
          "allergyLevel": 1,
          "sortOrder": 37,
          "sensitivityOrder": 6,
          "recipes": [
            "猕猴桃泥",
            "猕猴桃苹果泥",
            "猕猴桃米糊"
          ]
        },
        {
          "_id": "38",
          "name": "草莓",
          "allergyLevel": 1,
          "sortOrder": 38,
          "sensitivityOrder": 7,
          "recipes": [
            "草莓泥",
            "草莓米糊",
            "草莓香蕉泥"
          ]
        },
        {
          "_id": "39",
          "name": "蓝莓",
          "allergyLevel": 1,
          "sortOrder": 39,
          "sensitivityOrder": 8,
          "recipes": [
            "蓝莓泥",
            "蓝莓米糊",
            "蓝莓香蕉泥"
          ]
        },
        {
          "_id": "40",
          "name": "桃子（软桃）",
          "allergyLevel": 1,
          "sortOrder": 40,
          "sensitivityOrder": 8,
          "recipes": [
            "桃子泥",
            "蒸桃泥",
            "桃子米糊"
          ]
        }
      ]
    },
    {
      "id": "mushroom",
      "name": "菌菇类",
      "sortOrder": 6,
      "foods": [
        {
          "_id": "41",
          "name": "香菇",
          "allergyLevel": 1,
          "sortOrder": 41,
          "sensitivityOrder": 7,
          "recipes": [
            "香菇泥",
            "香菇大米粥",
            "香菇青菜粥"
          ]
        },
        {
          "_id": "42",
          "name": "平菇",
          "allergyLevel": 1,
          "sortOrder": 42,
          "sensitivityOrder": 7,
          "recipes": [
            "平菇泥",
            "平菇大米粥",
            "平菇青菜粥"
          ]
        },
        {
          "_id": "43",
          "name": "金针菇",
          "allergyLevel": 1,
          "sortOrder": 43,
          "sensitivityOrder": 8,
          "recipes": [
            "金针菇泥",
            "金针菇大米粥"
          ]
        },
        {
          "_id": "44",
          "name": "杏鲍菇",
          "allergyLevel": 1,
          "sortOrder": 44,
          "sensitivityOrder": 8,
          "recipes": [
            "杏鲍菇泥",
            "杏鲍菇大米粥",
            "杏鲍菇米糊"
          ]
        },
        {
          "_id": "45",
          "name": "蟹味菇",
          "allergyLevel": 1,
          "sortOrder": 45,
          "sensitivityOrder": 8,
          "recipes": [
            "蟹味菇泥",
            "蟹味菇大米粥"
          ]
        },
        {
          "_id": "46",
          "name": "白玉菇",
          "allergyLevel": 1,
          "sortOrder": 46,
          "sensitivityOrder": 8,
          "recipes": [
            "白玉菇泥",
            "白玉菇大米粥"
          ]
        },
        {
          "_id": "47",
          "name": "口蘑",
          "allergyLevel": 1,
          "sortOrder": 47,
          "sensitivityOrder": 8,
          "recipes": [
            "口蘑泥",
            "口蘑大米粥",
            "口蘑米糊"
          ]
        }
      ]
    },
    {
      "id": "medium_allergy",
      "name": "中敏食材",
      "sortOrder": 7,
      "foods": [
        {
          "_id": "48",
          "name": "猪肉",
          "allergyLevel": 2,
          "sortOrder": 48,
          "sensitivityOrder": 6,
          "recipes": [
            "猪肉泥",
            "猪肉青菜粥",
            "猪肉南瓜泥"
          ]
        },
        {
          "_id": "49",
          "name": "鸡肉",
          "allergyLevel": 2,
          "sortOrder": 49,
          "sensitivityOrder": 6,
          "recipes": [
            "鸡肉泥",
            "鸡肉大米粥",
            "鸡肉胡萝卜泥"
          ]
        },
        {
          "_id": "50",
          "name": "蛋黄",
          "allergyLevel": 2,
          "sortOrder": 50,
          "sensitivityOrder": 9,
          "recipes": [
            "蛋黄泥",
            "蛋黄米糊",
            "蛋黄南瓜羹"
          ]
        },
        {
          "_id": "51",
          "name": "牛肉",
          "allergyLevel": 2,
          "sortOrder": 51,
          "sensitivityOrder": 9,
          "recipes": [
            "牛肉泥",
            "牛肉大米粥",
            "牛肉番茄泥"
          ]
        },
        {
          "_id": "52",
          "name": "羊肉",
          "allergyLevel": 2,
          "sortOrder": 52,
          "sensitivityOrder": 9,
          "recipes": [
            "羊肉泥",
            "羊肉大米粥",
            "羊肉山药粥"
          ]
        },
        {
          "_id": "53",
          "name": "鸭肉",
          "allergyLevel": 2,
          "sortOrder": 53,
          "sensitivityOrder": 10,
          "recipes": [
            "鸭肉泥",
            "鸭肉大米粥",
            "鸭肉冬瓜粥"
          ]
        },
        {
          "_id": "54",
          "name": "三文鱼",
          "allergyLevel": 2,
          "sortOrder": 54,
          "sensitivityOrder": 10,
          "recipes": [
            "三文鱼泥",
            "三文鱼大米粥",
            "三文鱼土豆泥"
          ]
        },
        {
          "_id": "55",
          "name": "鳕鱼",
          "allergyLevel": 2,
          "sortOrder": 55,
          "sensitivityOrder": 10,
          "recipes": [
            "鳕鱼泥",
            "鳕鱼大米粥",
            "鳕鱼南瓜泥"
          ]
        },
        {
          "_id": "56",
          "name": "鲈鱼",
          "allergyLevel": 2,
          "sortOrder": 56,
          "sensitivityOrder": 10,
          "recipes": [
            "鲈鱼泥",
            "鲈鱼大米粥",
            "鲈鱼米糊"
          ]
        },
        {
          "_id": "57",
          "name": "猪肝",
          "allergyLevel": 2,
          "sortOrder": 57,
          "sensitivityOrder": 11,
          "recipes": [
            "猪肝泥",
            "猪肝大米粥",
            "猪肝菠菜泥"
          ]
        }
      ]
    },
    {
      "id": "high_allergy",
      "name": "高敏食材",
      "sortOrder": 8,
      "foods": [
        {
          "_id": "60",
          "name": "蛋清",
          "allergyLevel": 3,
          "sortOrder": 60,
          "sensitivityOrder": 12,
          "recipes": [
            "蒸蛋羹",
            "蛋清米糊",
            "蛋清蔬菜羹"
          ]
        },
        {
          "_id": "61",
          "name": "核桃粉",
          "allergyLevel": 3,
          "sortOrder": 61,
          "sensitivityOrder": 12,
          "recipes": [
            "核桃粉米糊",
            "核桃大米粥",
            "核桃粉香蕉糊"
          ]
        },
        {
          "_id": "62",
          "name": "杏仁粉（甜杏仁）",
          "allergyLevel": 3,
          "sortOrder": 62,
          "sensitivityOrder": 12,
          "recipes": [
            "杏仁粉米糊",
            "杏仁大米粥",
            "杏仁粉苹果糊"
          ]
        },
        {
          "_id": "63",
          "name": "花生粉",
          "allergyLevel": 3,
          "sortOrder": 63,
          "sensitivityOrder": 12,
          "recipes": [
            "花生粉米糊",
            "花生大米粥",
            "花生粉香蕉糊"
          ]
        },
        {
          "_id": "64",
          "name": "黄豆",
          "allergyLevel": 3,
          "sortOrder": 64,
          "sensitivityOrder": 12,
          "recipes": [
            "黄豆泥",
            "黄豆大米粥",
            "黄豆米糊"
          ]
        },
        {
          "_id": "65",
          "name": "黑豆",
          "allergyLevel": 3,
          "sortOrder": 65,
          "sensitivityOrder": 13,
          "recipes": [
            "黑豆泥",
            "黑豆大米粥",
            "黑豆米糊"
          ]
        },
        {
          "_id": "66",
          "name": "扁豆",
          "allergyLevel": 3,
          "sortOrder": 66,
          "sensitivityOrder": 13,
          "recipes": [
            "扁豆泥",
            "扁豆大米粥",
            "扁豆米糊"
          ]
        },
        {
          "_id": "67",
          "name": "芒果",
          "allergyLevel": 3,
          "sortOrder": 67,
          "sensitivityOrder": 13,
          "recipes": [
            "芒果泥",
            "芒果米糊",
            "芒果香蕉泥"
          ]
        },
        {
          "_id": "68",
          "name": "菠萝",
          "allergyLevel": 3,
          "sortOrder": 68,
          "sensitivityOrder": 13,
          "recipes": [
            "菠萝泥",
            "蒸菠萝泥",
            "菠萝米糊"
          ]
        },
        {
          "_id": "69",
          "name": "绿心猕猴桃",
          "allergyLevel": 3,
          "sortOrder": 69,
          "sensitivityOrder": 13,
          "recipes": [
            "猕猴桃泥",
            "猕猴桃苹果泥",
            "猕猴桃米糊"
          ]
        },
        {
          "_id": "70",
          "name": "荔枝",
          "allergyLevel": 3,
          "sortOrder": 70,
          "sensitivityOrder": 14,
          "recipes": [
            "荔枝泥",
            "荔枝米糊"
          ]
        },
        {
          "_id": "71",
          "name": "龙眼",
          "allergyLevel": 3,
          "sortOrder": 71,
          "sensitivityOrder": 14,
          "recipes": [
            "龙眼泥",
            "龙眼米糊"
          ]
        },
        {
          "_id": "72",
          "name": "虾仁",
          "allergyLevel": 3,
          "sortOrder": 72,
          "sensitivityOrder": 14,
          "recipes": [
            "虾仁泥",
            "虾仁大米粥",
            "虾仁南瓜泥"
          ]
        }
      ]
    }
  ]
};

exports.main = async (event, context) => {
  // 仅允许管理员调用，openid 取云端上下文，不信任前端传参
  const { OPENID } = cloud.getWXContext();
  const adminOpenids = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!OPENID || adminOpenids.indexOf(OPENID) === -1) {
    return { success: false, error: '无权限执行此操作' };
  }

  try {
    // 1. 清空 sensitivity_foods 集合（.get() 单次最多返回100条，需循环分页删除直至清空）
    let deletedFoods = 0;
    while (true) {
      const oldFoods = await db.collection('sensitivity_foods').limit(100).get();
      if (!oldFoods.data || oldFoods.data.length === 0) {
        break;
      }
      const deleteFoodPromises = oldFoods.data.map(item => {
        return db.collection('sensitivity_foods').doc(item._id).remove();
      });
      await Promise.all(deleteFoodPromises);
      deletedFoods += deleteFoodPromises.length;
    }
    console.log(`已删除 sensitivity_foods ${deletedFoods} 条旧数据`);

    // 2. 批量插入新数据
    const addPromises = [];
    sensitivityFoodsData.categories.forEach(category => {
      category.foods.forEach(food => {
        addPromises.push(
          db.collection('sensitivity_foods').add({
            data: {
              ...food,
              category: category.name,
              categoryId: category.id,
              createTime: new Date()
            }
          })
        );
      });
    });
    await Promise.all(addPromises);
    console.log(`已插入 ${addPromises.length} 条新数据`);

    return {
      success: true,
      deletedFoods: deletedFoods,
      inserted: addPromises.length,
      message: `已重导食材字典，删除旧数据 ${deletedFoods} 条，导入 ${addPromises.length} 条最新食材`
    };
  } catch (err) {
    console.error('初始化食材数据失败:', err);
    return { success: false, error: err.message };
  }
};

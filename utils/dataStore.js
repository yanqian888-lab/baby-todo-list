/**
 * 统一数据访问层
 * 封装本地存储和云数据库操作，提供一致的API
 */

const db = wx.cloud.database();

/**
 * 数据存储类
 * 统一管理本地存储和云端数据同步
 */
class DataStore {
  /**
   * 创建数据存储实例
   * @param {Object} options - 配置选项
   * @param {string} options.collection - 云数据库集合名称
   * @param {string} options.localKey - 本地存储键名
   * @param {string} [options.syncStrategy='manual'] - 同步策略：'auto'自动, 'manual'手动, 'local'仅本地
   */
  constructor(options) {
    this.collection = options.collection;
    this.localKey = options.localKey;
    this.syncStrategy = options.syncStrategy || 'manual';
    this._cache = null;
    this._cacheTime = null;
    this._cacheExpiry = 5 * 60 * 1000; // 默认缓存5分钟
  }

  /**
   * 获取本地存储的数据
   * @returns {Array|Object}
   */
  getLocal() {
    try {
      const data = wx.getStorageSync(this.localKey);
      return data || (this.collection ? [] : {});
    } catch (e) {
      console.error(`[DataStore] 读取本地存储失败 [${this.localKey}]:`, e);
      return this.collection ? [] : {};
    }
  }

  /**
   * 保存数据到本地存储
   * @param {Array|Object} data 
   */
  setLocal(data) {
    try {
      wx.setStorageSync(this.localKey, data);
      this._cache = data;
      this._cacheTime = Date.now();
    } catch (e) {
      console.error(`[DataStore] 写入本地存储失败 [${this.localKey}]:`, e);
    }
  }

  /**
   * 从云数据库查询数据
   * @param {Object} query - 查询条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async queryCloud(query = {}, options = {}) {
    if (!this.collection) {
      console.warn('[DataStore] 未配置集合名称');
      return [];
    }

    const { orderBy = { field: '_id', type: 'desc' }, limit = 100 } = options;

    try {
      let dbQuery = db.collection(this.collection).where(query);
      
      if (orderBy) {
        dbQuery = dbQuery.orderBy(orderBy.field, orderBy.type);
      }
      
      if (limit) {
        dbQuery = dbQuery.limit(limit);
      }

      const result = await dbQuery.get();
      return result.data || [];
    } catch (error) {
      console.error(`[DataStore] 云数据库查询失败 [${this.collection}]:`, error);
      throw error;
    }
  }

  /**
   * 添加数据到云端
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async addToCloud(data) {
    if (!this.collection) {
      throw new Error('未配置集合名称');
    }

    try {
      const result = await db.collection(this.collection).add({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return result;
    } catch (error) {
      console.error(`[DataStore] 云数据库添加失败 [${this.collection}]:`, error);
      throw error;
    }
  }

  /**
   * 更新云端数据
   * @param {string} docId - 文档ID
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async updateCloud(docId, data) {
    if (!this.collection) {
      throw new Error('未配置集合名称');
    }

    try {
      const result = await db.collection(this.collection).doc(docId).update({
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
      return result;
    } catch (error) {
      console.error(`[DataStore] 云数据库更新失败 [${this.collection}]:`, error);
      throw error;
    }
  }

  /**
   * 删除云端数据
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>}
   */
  async removeCloud(docId) {
    if (!this.collection) {
      throw new Error('未配置集合名称');
    }

    try {
      const result = await db.collection(this.collection).doc(docId).remove();
      return result;
    } catch (error) {
      console.error(`[DataStore] 云数据库删除失败 [${this.collection}]:`, error);
      throw error;
    }
  }

  /**
   * 获取数据（优先本地，自动同步云端）
   * @param {Object} query - 查询条件
   * @param {boolean} forceRefresh - 强制刷新
   * @returns {Promise<Array|Object>}
   */
  async get(query = {}, forceRefresh = false) {
    // 检查缓存
    if (!forceRefresh && this._cache && this._cacheTime) {
      const cacheAge = Date.now() - this._cacheTime;
      if (cacheAge < this._cacheExpiry) {
        return this._cache;
      }
    }

    // 先返回本地数据
    const localData = this.getLocal();

    // 自动同步策略
    if (this.syncStrategy === 'auto' && this.collection) {
      try {
        const cloudData = await this.queryCloud(query);
        this.setLocal(cloudData);
        return cloudData;
      } catch (error) {
        console.warn('[DataStore] 自动同步失败，使用本地数据:', error);
        return localData;
      }
    }

    return localData;
  }

  /**
   * 保存数据（本地+云端）
   * @param {Array|Object} data 
   * @param {boolean} syncToCloud - 是否同步到云端
   * @returns {Promise<boolean>}
   */
  async save(data, syncToCloud = false) {
    // 先保存本地
    this.setLocal(data);

    // 同步到云端（如果需要）
    if (syncToCloud && this.collection) {
      try {
        // 对于数组数据，需要逐个处理
        if (Array.isArray(data)) {
          // 这里简化处理，实际应根据业务需求实现批量同步
          console.warn('[DataStore] 批量同步未实现，建议逐个调用 add/update');
        } else {
          await this.addToCloud(data);
        }
      } catch (error) {
        console.error('[DataStore] 同步到云端失败:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * 清除缓存和本地存储
   */
  clear() {
    this._cache = null;
    this._cacheTime = null;
    try {
      wx.removeStorageSync(this.localKey);
    } catch (e) {
      console.error(`[DataStore] 清除本地存储失败 [${this.localKey}]:`, e);
    }
  }
}

// 预定义的数据存储实例
const stores = {
  // 排敏记录存储
  sensitivityRecords: new DataStore({
    collection: 'sensitivity_records',
    localKey: 'sensitivity_records',
    syncStrategy: 'manual'
  }),
  
  // 宝宝信息存储
  babyInfo: new DataStore({
    collection: 'baby_info',
    localKey: 'babyInfo',
    syncStrategy: 'manual'
  }),
  
  // 用户信息存储（仅本地）
  userInfo: new DataStore({
    localKey: 'userInfo',
    syncStrategy: 'local'
  }),
  
  // 认证信息存储（仅本地）
  authInfo: new DataStore({
    localKey: 'authInfo',
    syncStrategy: 'local'
  })
};

module.exports = {
  DataStore,
  stores
};

/**
 * 分页管理工具
 * 统一管理分页逻辑，减少重复代码
 */

class Pagination {
  /**
   * 创建分页实例
   * @param {Object} options - 配置选项
   * @param {number} [options.pageSize=20] - 每页数量
   * @param {Function} options.fetchFn - 获取数据的函数
   * @param {Function} [options.onDataChange] - 数据变化回调
   */
  constructor(options) {
    this.pageSize = options.pageSize || 20;
    this.fetchFn = options.fetchFn;
    this.onDataChange = options.onDataChange || (() => {});
    
    this.reset();
  }

  /**
   * 重置分页状态
   */
  reset() {
    this.page = 1;
    this.list = [];
    this.hasMore = true;
    this.loading = false;
    this.total = 0;
  }

  /**
   * 加载数据
   * @param {boolean} isRefresh - 是否刷新
   * @returns {Promise<Object>}
   */
  async load(isRefresh = false) {
    if (this.loading) return { list: this.list, hasMore: this.hasMore };
    if (!isRefresh && !this.hasMore) return { list: this.list, hasMore: false };

    this.loading = true;

    try {
      if (isRefresh) {
        this.page = 1;
        this.list = [];
      }

      const result = await this.fetchFn({
        page: this.page,
        pageSize: this.pageSize
      });

      const newList = result.list || result.data || [];
      this.total = result.total || 0;

      // 合并数据
      if (isRefresh) {
        this.list = newList;
      } else {
        this.list = this.list.concat(newList);
      }

      // 判断是否还有更多
      this.hasMore = newList.length >= this.pageSize;
      
      if (this.hasMore) {
        this.page++;
      }

      this.onDataChange({
        list: this.list,
        hasMore: this.hasMore,
        total: this.total,
        page: this.page
      });

      return {
        list: this.list,
        hasMore: this.hasMore,
        total: this.total,
        isRefresh
      };
    } catch (error) {
      console.error('分页加载失败:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * 加载下一页
   */
  async loadMore() {
    return this.load(false);
  }

  /**
   * 刷新数据
   */
  async refresh() {
    return this.load(true);
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      page: this.page,
      pageSize: this.pageSize,
      list: this.list,
      hasMore: this.hasMore,
      loading: this.loading,
      total: this.total
    };
  }
}

/**
 * 批量更新工具
 * 合并多个 setData 调用
 */
class BatchUpdater {
  constructor(page) {
    this.page = page;
    this.data = {};
    this.timer = null;
    this.delay = 20; // 20ms 延迟合并
  }

  /**
   * 添加更新数据
   * @param {Object} data 
   */
  setData(data) {
    Object.assign(this.data, data);
    this._scheduleUpdate();
  }

  /**
   * 立即执行更新
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (Object.keys(this.data).length > 0) {
      this.page.setData(this.data);
      this.data = {};
    }
  }

  /**
   * 安排更新
   * @private
   */
  _scheduleUpdate() {
    if (this.timer) return;
    
    this.timer = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
}

module.exports = {
  Pagination,
  BatchUpdater
};

// pages/sensitivity/add-record.js
import sensitivityService from '../../services/sensitivityService';
import authService from '../../services/authService';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    foodId: '',               // 食物ID
    foodName: '',             // 食物名称
    foodType: '',             // 食物类型
    recordDate: '',           // 排敏日期
    recordStatus: 'safe',     // 排敏状态：safe(安全)、allergic(过敏)、unknown(观察中)
    allergySymptoms: '',      // 过敏症状
    remark: '',               // 备注信息
    loading: false,           // 加载状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取食物信息参数
    const foodId = options.foodId;
    const foodName = options.foodName;
    const foodType = options.foodType;

    if (foodId && foodName) {
      this.setData({
        foodId,
        foodName,
        foodType: foodType || '其他',
        recordDate: this.formatDate(new Date())
      });
      this.checkLogin();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none',
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  },

  /**
   * 检查登录状态
   */
  checkLogin: function () {
    const isLoggedIn = authService.isLoggedIn();
    if (!isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ isLoggedIn: true });
  },

  /**
   * 格式化日期
   */
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 显示日期选择器
   */
  showDatePicker: function () {
    const that = this;
    wx.showDatePicker({
      success: function (res) {
        that.setData({
          recordDate: res.year + '-' + res.month + '-' + res.day
        });
      }
    });
  },

  /**
   * 设置排敏状态
   */
  setStatus: function (e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ recordStatus: status });
  },

  /**
   * 过敏症状输入
   */
  onSymptomsInput: function (e) {
    this.setData({ allergySymptoms: e.detail.value });
  },

  /**
   * 备注信息输入
   */
  onRemarkInput: function (e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 提交排敏记录
   */
  submitRecord: function () {
    // 表单验证
    if (!this.data.recordDate) {
      wx.showToast({
        title: '请选择排敏日期',
        icon: 'none'
      });
      return;
    }

    if (this.data.recordStatus === 'allergic' && !this.data.allergySymptoms) {
      wx.showToast({
        title: '请描述过敏症状',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    // 构建记录数据
    const recordData = {
      foodId: this.data.foodId,
      foodName: this.data.foodName,
      foodType: this.data.foodType,
      recordDate: this.data.recordDate,
      status: this.data.recordStatus,
      allergySymptoms: this.data.allergySymptoms || '',
      remark: this.data.remark || '',
      createTime: new Date().toISOString()
    };

    // 提交记录
    sensitivityService.addSensitivityRecord(recordData)
      .then(res => {
        wx.showToast({
          title: '记录添加成功',
          icon: 'success',
          success: () => {
            // 返回上一页并刷新数据
            setTimeout(() => {
              wx.navigateBack({
                delta: 2
              });
            }, 1500);
          }
        });
      })
      .catch(err => {
        console.error('添加排敏记录失败:', err);
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  /**
   * 返回上一页
   */
  navigateBack: function () {
    wx.navigateBack();
  },
});
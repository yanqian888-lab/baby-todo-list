Page({
  data: {
    pageReady: false
  },
  
  onReady() {
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 50);
  }
});

import { paths } from "@src/config";

/** 轮播定时器挂在组件实例上（原为模块级单例，多实例会互相覆盖并泄漏） */
Component({
  properties: {
    type: {
      type: String,
      value: "night" as AppUI.BgImageType
    },
    enableSwiper: {
      type: Boolean,
      value: false
    },
    swiperInterval: {
      type: Number,
      value: 8000
    }
  },
  data: {
    bgImages: Object.values(paths.BgImages) as string[],
    currentImage: paths.BgImages["night"],
    currentIndex: 0,
  },
  lifetimes: {
    attached() {
      (this as any)._swiperTimer = 0;
      if (this.properties.enableSwiper && this.data.bgImages.length > 1) {
        this.startAutoPlay();
      }
    },
    detached() {
      this.stopAutoPlay();
    }
  },
  methods: {
    startAutoPlay() {
      const self = this as any;
      this.stopAutoPlay();
      self._swiperTimer = setInterval(() => {
        const next = (this.data.currentIndex + 1) % this.data.bgImages.length;
        this.setData({ currentIndex: next });
      }, this.properties.swiperInterval) as unknown as number;
    },
    stopAutoPlay() {
      const self = this as any;
      if (self._swiperTimer) {
        clearInterval(self._swiperTimer);
        self._swiperTimer = 0;
      }
    },
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({ currentIndex: e.detail.current });
    }
  }
});

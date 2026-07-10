import { paths } from "../../../config";

let _swiperTimer: number | null = null;

Component({
  properties: {
    type:{
      type:String,
      value: "night" as AppUI.BgImageType
    },
    enableSwiper:{
      type: Boolean,
      value: false
    },
    swiperInterval:{
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
      this.stopAutoPlay();
      _swiperTimer = setInterval(() => {
        const next = (this.data.currentIndex + 1) % this.data.bgImages.length;
        this.setData({ currentIndex: next });
      }, this.properties.swiperInterval) as unknown as number;
    },
    stopAutoPlay() {
      if (_swiperTimer !== null) {
        clearInterval(_swiperTimer);
        _swiperTimer = null;
      }
    },
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({ currentIndex: e.detail.current });
    }
  }
})
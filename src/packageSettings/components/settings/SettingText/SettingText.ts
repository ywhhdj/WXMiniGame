Component({
  data: {
    speed: 100
  },

  pageLifetimes: {
    show() {
      // 每次进入设置页面，重新播放打字机动画
      this.restartTypewriter();
    }
  },

  methods: {
    restartTypewriter() {
      const typewriter = this.selectComponent('.typewriter') as unknown as { setSpeed: (v: number) => void; play: () => void } | null;
      if (typewriter) {
        typewriter.setSpeed(this.data.speed);
        typewriter.play();
      }
    },

    onSpeedChange(e: WechatMiniprogram.CustomEvent) {
      const value = e.detail.value as number;
      const typewriter = this.selectComponent('.typewriter') as unknown as { 
        setSpeed: (v: number) => void; 
        play: () => void;
      } | null;
      if (typewriter) {
        typewriter.setSpeed(value);
        typewriter.play();
      }
      this.setData({ speed: value });
    },

    onSpeedChanging(e: WechatMiniprogram.CustomEvent) {
      // 拖动过程中仅实时更新速度，不打断动画
      const typewriter = this.selectComponent('.typewriter') as unknown as { setSpeed: (v: number) => void } | null;
      if (typewriter) {
        typewriter.setSpeed(e.detail.value as number);
      }
    }
  }
});

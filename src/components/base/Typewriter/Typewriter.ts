// components/base/Typewriter/Typewriter.ts
Component({
  properties: {
    text: {
      type: String,
      observer: "onTextChange",
    },
    speed: {
      type: Number,
      value: 100,
      observer: "onSpeedChange",
    },
    showBg: {
      type: Boolean,
      value: false,
    },
    color: {
      type: String,
      value: "#ffffff",
    },
    showCursor: {
      type: Boolean,
      value: false,
    },
    cursorColor: {
      type: String,
      value: "#ffffff",
    },
    autoStart: {
      type: Boolean,
      value: true,
    },
    bgHeight: {
      type: Number,
      value: 65,
    },
  },
  data: {
    displayText: "",
    isTyping: true,
    cursorVisible: true,
    _scopedSpeed: 100,
  },
  lifetimes: {
    attached() {
      this._timer = 0 as unknown as ReturnType<typeof setInterval>;
      this._cursorTimer = 0 as unknown as ReturnType<typeof setInterval>;
    },
    ready() {
      if (this.properties.autoStart && this.properties.text) {
        this.startType();
      }
      if (this.properties.showCursor) {
        this.startCursorBlink();
      }
    },
    detached() {
      this.stopType();
      this.stopCursorBlink();
    },
  },
  methods: {
    onTextChange(newVal: string) {
      if (newVal && this.properties.autoStart) {
        this.resetAndStart();
      } else if (!newVal) {
        this.reset();
      }
    },

    /** speed 属性变化，同步内部值 */
    onSpeedChange(newVal: number) {
      this.setData({ _scopedSpeed: newVal });
    },

    /** 将 1-100 的 speed 映射为实际毫秒间隔（100最快≈50ms，1最慢≈350ms） */
    getInterval(): number {
      const speed = this.data._scopedSpeed || this.properties.speed || 100;
      const clamped = Math.max(1, Math.min(100, speed));
      return Math.round(350 - clamped * 3);
    },

    /** 开始打字 */
    startType(){
      const text = this.properties.text;
      if (!text || this.data.isTyping) return;
      // 始终先清理旧定时器，避免竞态
      this.stopType();
      this.setData({ isTyping: true, displayText: "" });

      let index = 0;
      const delay = this.getInterval();
      this._timer = setInterval(() => {
        if (index < text.length) {
          index++;
          this.setData({ displayText: text.slice(0, index) });
        } else {
          this.stopType();
          // 结束时显式写入完整文本，防止最后一个字丢失
          this.setData({
            displayText: text,
            isTyping: false,
          });
          this.triggerEvent("complete", {
            complete: true,
          });
        }
      }, delay);
    },

    /** 停止打字 */
    stopType() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = 0;
      }
    },

    /** 重置并重新开始 */
    resetAndStart() {
      this.stopType();
      this.setData({ displayText: "", isTyping: false });
      this.startType();
    },

    /** 重置 */
    reset() {
      this.stopType();
      this.setData({ displayText: "", isTyping: false });
    },

    /** 立即显示全部文本（跳过动画） */
    showAll() {
      this.stopType();
      this.setData({
        displayText: this.properties.text,
        isTyping: false,
      });
      this.triggerEvent("complete");
    },

    /** 设置速度（运行时调整，1-100） */
    setSpeed(speed: number) {
      const clamped = Math.max(1, Math.min(100, speed));
      this.setData({ _scopedSpeed: clamped });
    },

    /** 光标闪烁 */
    startCursorBlink() {
      this.stopCursorBlink();
      this._cursorTimer = setInterval(() => {
        this.setData({ cursorVisible: !this.data.cursorVisible });
      }, 500);
    },

    stopCursorBlink() {
      if (this._cursorTimer) {
        clearInterval(this._cursorTimer);
        this._cursorTimer = 0;
      }
    },

    /** 开始（手动触发，总是打断当前动画重新播放） */
    play() {
      // 先停止并重置状态，确保每次调用都是一次完整的重新播放
      this.stopType();
      this.setData({ displayText: "", isTyping: false });
      this.startType();
    },
  },
});

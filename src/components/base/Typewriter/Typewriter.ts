// components/base/Typewriter/Typewriter.ts
/**
 * UI 性能约定（见 优化.md §3.2）
 * - data 只保留 WXML 真正渲染的 displayText / isTyping
 * - 速度、打字标志、下标、全文、timer 全部放组件实例，不参与 setData 传输
 * - 光标闪烁交给 SCSS @keyframes，不再用 JS 定时器每 500ms setData
 * - setTimeout 递归 + 批量推进：总时长不变，setData 次数减半，运行中调速即时生效
 */
const BATCH_CHARS = 2;

Component({
  properties: {
    text: {
      type: String,
      value: "",
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
    isTyping: false,
  },
  lifetimes: {
    attached() {
      this._ensureInit();
    },
    ready() {
      const self = this as any;
      // 属性 observer 可能已启动动画，避免重复播放
      if (this.properties.autoStart && this.properties.text && !self._typing) {
        this.startType();
      }
      // 光标闪烁由 SCSS 动画承担，无需 JS 定时器
    },
    detached() {
      this.stopType();
    },
  },
  methods: {
    /** 惰性初始化实例字段：属性 observer 可能先于 attached 触发 */
    _ensureInit() {
      const self = this as any;
      if (self._timer === undefined) self._timer = 0;
      if (self._speed === undefined) self._speed = this.properties.speed || 100;
      if (self._typing === undefined) self._typing = false;
      if (self._index === undefined) self._index = 0;
      if (self._fullText === undefined) self._fullText = "";
    },

    onTextChange(newVal: string) {
      if (newVal && this.properties.autoStart) {
        this.resetAndStart();
      } else if (!newVal) {
        this.reset();
      }
    },

    /** speed 属性变化只更新逻辑层，不再 setData（该字段不参与渲染） */
    onSpeedChange(newVal: number) {
      (this as any)._speed = newVal;
    },

    /** 将 1-100 的 speed 映射为实际毫秒间隔（100最快≈50ms，1最慢≈350ms） */
    getInterval(): number {
      const speed = (this as any)._speed || this.properties.speed || 100;
      const clamped = Math.max(1, Math.min(100, speed));
      return Math.round(350 - clamped * 3);
    },

    /** 开始打字：一次 setData 启动，之后按批推进 */
    startType() {
      this._ensureInit();
      const self = this as any;
      const text = this.properties.text || "";
      if (!text) return;
      this.stopType();
      self._fullText = text;
      self._index = 0;
      self._typing = true;
      this.setData({ displayText: "", isTyping: true });

      const tick = () => {
        if (!self._typing) return;
        const delay = this.getInterval();
        // 最快档保持逐字节奏；较慢档一次推进多字，减少 setData 次数
        const batch = delay <= 60 ? 1 : BATCH_CHARS;
        self._index = Math.min(text.length, self._index + batch);
        if (self._index >= text.length) {
          this.stopType();
          self._typing = false;
          this.setData({ displayText: text, isTyping: false });
          this.triggerEvent("complete", { complete: true });
          return;
        }
        this.setData({ displayText: text.slice(0, self._index) });
        self._timer = setTimeout(tick, delay * batch);
      };
      const firstDelay = this.getInterval();
      self._timer = setTimeout(tick, firstDelay * (firstDelay <= 60 ? 1 : BATCH_CHARS));
    },

    /** 停止打字（只清 timer，不改渲染状态，供内部复用） */
    stopType() {
      const self = this as any;
      if (self._timer) {
        clearTimeout(self._timer);
        self._timer = 0;
      }
      self._typing = false;
    },

    /** 重置并重新开始：startType 内部已合并为一次 setData */
    resetAndStart() {
      this.startType();
    },

    /** 重置 */
    reset() {
      const self = this as any;
      this.stopType();
      self._index = 0;
      self._fullText = "";
      this.setData({ displayText: "", isTyping: false });
    },

    /** 立即显示全部文本（跳过动画） */
    showAll() {
      const self = this as any;
      this.stopType();
      self._index = (this.properties.text || "").length;
      this.setData({
        displayText: this.properties.text || "",
        isTyping: false,
      });
      this.triggerEvent("complete", { complete: true });
    },

    /** 设置速度（运行时调整，1-100）——不再触发渲染 */
    setSpeed(speed: number) {
      const clamped = Math.max(1, Math.min(100, speed));
      (this as any)._speed = clamped;
    },

    /** 兼容旧调用：光标闪烁已由 CSS 接管，无需启停定时器 */
    startCursorBlink() {},
    stopCursorBlink() {},

    /** 开始（手动触发，总是打断当前动画重新播放） */
    play() {
      this.startType();
    },
  },
});

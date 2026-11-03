import {
  Notification,
  NotificationLevel,
  offNotificationShow,
  onNotificationShow,
  hideNotification
 } from '@src/events/notifyEvents';

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 一次通知由 3 次 setData 降为 2 次：先填内容+复位动画态，再一次性切到显示态
 * - 所有 setTimeout 句柄挂在组件实例上，detached / 再次 show / hide 时统一清理，
 *   避免组件销毁后仍执行 setData（原实现只清 hideTimer）
 * - 入场/离场由 CSS transition 承担，不再嵌套 100ms + 16ms 两级定时器
 */
const ENTER_DELAY = 16;
const LEAVE_DURATION = 350;

Component({
  data: {
    title: '',
    message: '',
    levelType: 'info' as NotificationLevel,
    visible: false,
    animating: false,
    iconMap: {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️',
    } as Record<NotificationLevel, string>,
  },

  lifetimes: {
    attached() {
      const handler = (notification: Notification) => {
        this.show(notification);
      };
      (this as any)._onShowHandler = handler;
      onNotificationShow(handler);
    },

    detached() {
      this.clearAllTimers();
      const handler = (this as any)._onShowHandler as ((n: Notification) => void) | null;
      if (handler) {
        offNotificationShow(handler);
        (this as any)._onShowHandler = null;
      }
    },
  },

  methods: {
    show(notification: Notification) {
      const self = this as any;
      this.clearAllTimers();
      const { title = '', message, levelType = 'info', duration = 2500 } = notification;

      // 第 1 次 setData：容器先显示，卡片停在动画初始态（translateX(120%) / opacity 0）
      // 这样 CSS transition 才有可过渡的起始帧；同时一次性写入内容
      this.setData({ visible: true, animating: false, title, message, levelType });

      // 第 2 次 setData：下一帧仅切换动画 class，由 CSS 完成滑入
      self._enterTimer = setTimeout(() => {
        self._enterTimer = 0;
        this.setData({ animating: true });
      }, ENTER_DELAY);

      self._hideTimer = setTimeout(() => {
        self._hideTimer = 0;
        this.hide();
      }, duration + ENTER_DELAY);
    },

    hide() {
      const self = this as any;
      this.clearAllTimers();
      this.setData({ animating: false });
      self._leaveTimer = setTimeout(() => {
        self._leaveTimer = 0;
        this.setData({ visible: false });
      }, LEAVE_DURATION);
      hideNotification();
    },

    /** 统一清理三类定时器 */
    clearAllTimers() {
      const self = this as any;
      for (const key of ['_enterTimer', '_hideTimer', '_leaveTimer']) {
        if (self[key]) {
          clearTimeout(self[key]);
          self[key] = 0;
        }
      }
    },

    /** 兼容旧方法名 */
    clearTimer() {
      this.clearAllTimers();
    },
  },
});

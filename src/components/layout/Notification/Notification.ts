import { 
  Notification,
  NotificationLevel,
  offNotificationShow,
  onNotificationShow,
  hideNotification
 } from '../../../events/notifyEvents';

let _onShowHandler: ((notification: Notification) => void) | null = null;
let _hideTimer: ReturnType<typeof setTimeout> | null = null;

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
      _onShowHandler = (notification: Notification) => {
        this.show(notification);
      };
      onNotificationShow(_onShowHandler);
    },

    detached() {
      this.clearTimer();
      if (_onShowHandler) {
        offNotificationShow(_onShowHandler);
        _onShowHandler = null;
      }
    },
  },

  methods: {
    show(notification: Notification) {
      // 清除之前的定时器
      this.clearTimer();
      const { title = '', message, levelType = 'info', duration = 2500 } = notification;
      // 先隐藏并重置动画
      this.setData({ visible: false, animating: false, title: '', message: '', levelType: 'info' });
      // 下一帧触发入场动画
      setTimeout(() => {
        this.setData({ title, message, levelType, visible: true }, () => {
          // 再下一帧激活动画
          setTimeout(() => {
            this.setData({ animating: true });
          }, 16);
        });
      }, 100);
      // 自动隐藏
      _hideTimer = setTimeout(() => {
        this.hide();
      }, duration);
    },

    hide() {
      this.clearTimer();
      // 先移除动画 class 触发离场动画
      this.setData({ animating: false });
      // 动画结束后移除 DOM
      setTimeout(() => {
        this.setData({ visible: false });
      }, 350);
      hideNotification();
    },

    clearTimer() {
      if (_hideTimer) {
        clearTimeout(_hideTimer);
        _hideTimer = null;
      }
    },
  },
});

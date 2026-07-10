import events from "../utils/event";
enum NotificationEventType {
  SHOW = 'notify:show',
  HIDE = 'notify:hide',
}

/** 通知等级 */
export type NotificationLevel = 'success' | 'warning' | 'error' | 'info';

export type Notification= {
  title?: string;
  message: string;
  levelType?: NotificationLevel;
  duration?: number;
}

export function onNotificationShow(fn: (payload: Notification) => void): void {
  events.on(NotificationEventType.SHOW, fn);
}

export function offNotificationShow(fn: (payload: Notification) => void): void {
  events.off(NotificationEventType.SHOW, fn);
}

export function showNotification(payload: Notification): void {
  events.emit(NotificationEventType.SHOW, payload);
}

export function hideNotification(): void {
  events.emit(NotificationEventType.HIDE);
}

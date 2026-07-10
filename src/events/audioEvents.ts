import events from "../utils/event";
/**
 * Audio event bus — 跨组件音频事件通信
 * 
 * SettingSound 和 BackgroundMusic 通过此事件总线保持状态同步。
 * 音频播放状态（isPlaying）依赖共享的 InnerAudioContext 事件（onPlay/onPause/onStop），
 * 当前播放曲目信息（name/url）通过自定义事件同步。
 */
enum AudioEventType {
  MUSIC_CHANGED = 'music:changed',
  MUSIC_STOPPED = 'music:stopped',
  MUSIC_TOGGLE = 'music:toggle',
}

export function onAudioToggle(fn: (info: AppUI.Audio) => void): void {
  events.on(AudioEventType.MUSIC_TOGGLE, fn);
}

export function offAudioToggle(fn: (info: AppUI.Audio) => void): void {
  events.off(AudioEventType.MUSIC_TOGGLE, fn);
}

export function emitAudioToggle(info: AppUI.Audio): void {
  events.emit(AudioEventType.MUSIC_TOGGLE, info);
}

export function onAudioStopped(fn: () => void): void {
  events.on(AudioEventType.MUSIC_STOPPED, fn);
}

export function offAudioStopped(fn: () => void): void {
  events.off(AudioEventType.MUSIC_STOPPED, fn);
}

export function emitAudioStopped(info: AppUI.Audio|undefined=undefined): void {
  events.emit(AudioEventType.MUSIC_STOPPED, info);
}

export function onAudioChanged(fn: (music: AppUI.Audio) => void): void {
  events.on(AudioEventType.MUSIC_CHANGED, fn);
}

export function offAudioChanged(fn: (music: AppUI.Audio) => void): void {
  events.off(AudioEventType.MUSIC_CHANGED, fn);
}

export function emitAudioChanged(info: AppUI.Audio): void {
  events.emit(AudioEventType.MUSIC_CHANGED, info);
}

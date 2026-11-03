import { defaultAudioInfo } from '@src/config';
import * as storage from '@src/services/storage';
import { onAudioChanged, emitAudioToggle, onAudioStopped, offAudioStopped, offAudioChanged } from '@src/events/audioEvents';

/** 延迟获取 app 实例，避免模块顶层调用时尚未初始化 */
function getGlobalApp(): IAppOption {
  return getApp<IAppOption>();
}

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 所有回调引用挂在组件实例上：多实例不再互相覆盖，detached 精确解绑
 * - InnerAudioContext 改为会话级单例：页面切换只解绑监听，不再 destroy 重建
 *   （暂停/恢复由 App.onHide / onShow 负责，销毁由 App.onUnload 兜底）
 */
Component({
  data: {
    isPlaying: false
  },
  lifetimes: {
    attached() {
      const self = this as any;
      const h = (self._handlers = {} as Record<string, any>);
      const app = getGlobalApp();
      const options = app.globalData;

      // 初始化音频上下文（全局唯一，已存在则直接复用）
      if (!options.audio.Context) {
        const innerAudio = wx.createInnerAudioContext();
        innerAudio.src = options.audio.info.url;
        const storedLoop = storage.readLoopType();
        innerAudio.loop = storedLoop === defaultAudioInfo.loopType;
        innerAudio.autoplay = true;
        app.globalData.audio.Context = innerAudio;
        if (options.audio.info.url && !options.audio.info.url.startsWith('cloud://')) {
          innerAudio.play();
        }
      }

      const audio = app.globalData.audio.Context;
      // 一次 setData 同步全局播放状态
      this.setData({ isPlaying: app.globalData.audio.info.isPlaying || false });
      if (!audio) return;

      h.onPlay = () => {
        getGlobalApp().globalData.audio.info.isPlaying = true;
        this.setData({ isPlaying: true });
      };
      h.onPause = () => {
        getGlobalApp().globalData.audio.info.isPlaying = false;
        this.setData({ isPlaying: false });
      };
      h.onStop = () => {
        getGlobalApp().globalData.audio.info.isPlaying = false;
        this.setData({ isPlaying: false });
      };
      audio.onPlay(h.onPlay);
      audio.onPause(h.onPause);
      audio.onStop(h.onStop);

      h.onMusicChanged = (music: AppUI.Audio) => {
        if (music && music.isPlaying !== this.data.isPlaying) {
          this.setData({ isPlaying: music.isPlaying });
        }
      };
      onAudioChanged(h.onMusicChanged);

      h.onMusicStopped = () => {
        this.setData({ isPlaying: false });
      };
      onAudioStopped(h.onMusicStopped);
    },

    detached() {
      const self = this as any;
      const h = (self._handlers || {}) as Record<string, any>;
      if (h.onMusicChanged) offAudioChanged(h.onMusicChanged);
      if (h.onMusicStopped) offAudioStopped(h.onMusicStopped);

      const audio = getGlobalApp().globalData.audio?.Context;
      if (audio) {
        if (h.onPlay) audio.offPlay(h.onPlay);
        if (h.onPause) audio.offPause(h.onPause);
        if (h.onStop) audio.offStop(h.onStop);
      }
      self._handlers = null;
      // 不再销毁全局上下文：避免每次页面切换重建、重新缓冲并中断播放
    }
  },
  methods: {
    onToggleMusic() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (!audio) return;
      const info = app.globalData.audio.info;
      if (this.data.isPlaying) {
        audio.pause();
      } else {
        if (info?.url && audio.src !== info.url) {
          audio.src = info.url;
        }
        audio.play();
      }
      emitAudioToggle(app.globalData.audio.info);
    }
  }
});

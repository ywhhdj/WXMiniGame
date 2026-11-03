import { emitAudioChanged, emitAudioStopped, onAudioToggle, offAudioToggle } from '@src/events/audioEvents';
import { showNotification } from '@src/events/notifyEvents';
import { paths, defaultAudioInfo } from "@src/config";
import * as storage from "@src/services/storage";

/** 延迟获取 app 实例，避免模块顶层调用时尚未初始化 */
function getGlobalApp(): IAppOption {
  return getApp<IAppOption>();
}

/** 持久化播放模式到 globalData + Storage */
function setStoredLoopType(type: AppUI.LoopType): void {
  const app = getGlobalApp();
  (app.globalData.audio as Record<string, unknown>).loopType = type;
  storage.writeLoopType(type);
}

/** 根据播放模式同步 audio.loop 属性 */
function syncAudioLoop(audio: WechatMiniprogram.InnerAudioContext | null, loopType: AppUI.LoopType): void {
  if (audio) {
    audio.loop = (loopType === defaultAudioInfo.loopType);
  }
}

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 事件回调引用挂在组件实例上，多实例不再互相覆盖，detached 精确解绑
 * - attached 内 3 次 setData（loopType / musicList / currentMusic）合并为 1 次
 * - 音频上下文为会话级单例：detached 只 off 自身监听，不销毁
 */
const VALID_LOOP_TYPES: AppUI.LoopType[] = ["单曲循环", "列表循环", "随机播放"];

Component({
  data: {
    musicList: [] as AppUI.Audio[],
    currentMusic: null as AppUI.Audio | null,
    loopType: defaultAudioInfo.loopType
  },

  lifetimes: {
    attached() {
      const self = this as any;
      const h = (self._handlers = {} as Record<string, any>);
      const app = getGlobalApp();
      const globalData = app.globalData;
      if (!globalData?.audio) return;

      // 恢复播放模式
      let storedLoop = storage.readLoopType();
      if (!storedLoop || !(VALID_LOOP_TYPES as string[]).includes(storedLoop)) {
        storedLoop = defaultAudioInfo.loopType;
      }
      setStoredLoopType(storedLoop);

      const storedList = storage.readMusicList() as AppUI.Audio[] | undefined;
      const musicList: AppUI.Audio[] = storedList?.length ? storedList : paths.audios;

      const audio = globalData.audio.Context;
      const currentMusic = audio ? (globalData.audio.info || null) : null;

      // 一次 setData 完成挂载渲染
      this.setData({ loopType: storedLoop, musicList, currentMusic });

      if (audio) {
        syncAudioLoop(audio, storedLoop);
        h.onPlay = () => {
          if (this.data.currentMusic) this.setData({ 'currentMusic.isPlaying': true });
        };
        h.onPause = () => {
          if (this.data.currentMusic) this.setData({ 'currentMusic.isPlaying': false });
        };
        h.onStop = () => {
          if (this.data.currentMusic) this.setData({ 'currentMusic.isPlaying': false });
        };
        h.onEnded = () => { this._handleTrackEnded(); };
        audio.onPlay(h.onPlay);
        audio.onPause(h.onPause);
        audio.onStop(h.onStop);
        audio.onEnded(h.onEnded);
      }

      h.onMusicToggle = (info: AppUI.Audio) => {
        if (info) this.setData({ currentMusic: info });
      };
      onAudioToggle(h.onMusicToggle);
    },

    detached() {
      const self = this as any;
      const h = (self._handlers || {}) as Record<string, any>;
      if (h.onMusicToggle) offAudioToggle(h.onMusicToggle);
      const audio = getGlobalApp().globalData.audio?.Context;
      if (audio) {
        if (h.onPlay) audio.offPlay(h.onPlay);
        if (h.onPause) audio.offPause(h.onPause);
        if (h.onStop) audio.offStop(h.onStop);
        if (h.onEnded) audio.offEnded(h.onEnded);
      }
      self._handlers = null;
    }
  },

  methods: {
    // ==================== 播放模式逻辑 ====================

    /** 当前曲目自然播放结束后的自动切歌逻辑 */
    _handleTrackEnded() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (!audio) return;

      const loopType = app.globalData.audio.loopType;
      const list = this.data.musicList;
      const current = this.data.currentMusic;

      if (list.length === 0 || !current) return;

      if (loopType === defaultAudioInfo.loopType) {
        // 单曲循环：audio.loop = true 时 WeChat API 自动从头播放，无需额外操作
        return;
      }

      if (loopType === "列表循环") {
        const curIndex = list.findIndex(m => m.id === current.id);
        const nextIndex = (curIndex + 1) % list.length;
        this._switchToTrack(nextIndex);
      } else if (loopType === "随机播放") {
        const curIndex = list.findIndex(m => m.id === current.id);
        let randomIndex: number;
        if (list.length <= 1) {
          randomIndex = 0;
        } else {
          do {
            randomIndex = Math.floor(Math.random() * list.length);
          } while (randomIndex === curIndex);
        }
        this._switchToTrack(randomIndex);
      }
    },

    /** 切换到指定索引的曲目并播放 */
    _switchToTrack(index: number) {
      const app = getGlobalApp();
      const music = this.data.musicList[index];
      if (!music) return;
      const audio = app.globalData.audio.Context;
      if (!audio) return;

      audio.src = music.url;
      audio.play();
      const current: AppUI.Audio = {
        id: music.id,
        name: music.name,
        url: music.url,
        isPlaying: true
      };
      app.globalData.audio.info = current;
      this.setData({ currentMusic: current });
      emitAudioChanged(current);
    },

    handleTaggleLoopType() {
      const app = getGlobalApp();
      const loopType = this.data.loopType;
      let next: AppUI.LoopType;
      if (loopType === "单曲循环") {
        next = "列表循环";
      } else if (loopType === "列表循环") {
        next = "随机播放";
      } else {
        next = "单曲循环";
      }
      this.setData({ loopType: next });
      setStoredLoopType(next);

      const audio = app.globalData.audio.Context;
      syncAudioLoop(audio, next);
    },

    // ==================== 原有播放控制 ====================

    PlayMusic(e: WechatMiniprogram.BaseEvent) {
      const app = getGlobalApp();
      const index = e.currentTarget.dataset.index as number;
      const music = this.data.musicList[index];
      if (!music) return;
      const audio = app.globalData.audio.Context;
      if (!audio) return;

      syncAudioLoop(audio, app.globalData.audio.loopType);

      audio.src = music.url;
      audio.play();
      const current: AppUI.Audio = {
        id: music.id,
        name: music.name,
        url: music.url,
        isPlaying: true
      };
      app.globalData.audio.info = current;
      this.setData({ currentMusic: current });
      emitAudioChanged(current);
    },

    handlePlayPause() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (!audio) return;
      if (this.data.currentMusic?.isPlaying) {
        audio.pause();
      } else {
        if (!this.data.currentMusic && this.data.musicList.length) {
          const first = this.data.musicList[0];
          syncAudioLoop(audio, app.globalData.audio.loopType);
          audio.src = first.url;
          const info: AppUI.Audio = {
            id: first.id,
            name: first.name,
            url: first.url,
            isPlaying: true
          };
          app.globalData.audio.info = info;
          this.setData({ currentMusic: info });
          emitAudioChanged(info);
        }
        audio.play();
      }
    },

    handleStop() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (audio) audio.stop();
      if (this.data.currentMusic) {
        this.setData({ 'currentMusic.isPlaying': false });
        const info = app.globalData.audio.info;
        if (info) info.isPlaying = false;
        emitAudioStopped();
      }
    },

    handleDeleteMusic(e: WechatMiniprogram.BaseEvent) {
      const index = e.currentTarget.dataset.index as number;
      if (index === 0) {
        showNotification({ message: '无法删除第一首音乐', levelType: 'warning' });
        return;
      }
      const musicList = [...this.data.musicList];
      musicList.splice(index, 1);
      this.setData({ musicList });
      storage.writeMusicList(musicList);
    }
  }
});

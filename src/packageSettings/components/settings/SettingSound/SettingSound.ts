import { emitAudioChanged,emitAudioStopped,onAudioToggle,offAudioToggle } from '../../../../events/audioEvents';
import { showNotification } from '../../../../events/notifyEvents';
import { paths,defaultAudioInfo } from "../../../../config";
/** 延迟获取 app 实例，避免模块顶层调用时尚未初始化 */
function getGlobalApp(): IAppOption {
  return getApp<IAppOption>();
}

// 事件回调引用（模块级闭包，用于 attached/detached 生命周期管理）
let _onMusicToggle: ((info: AppUI.Audio) => void) | null = null;
// 音频内置事件回调引用（用于 detached 清理）
let _onPlayHandler: (() => void) | null = null;
let _onPauseHandler: (() => void) | null = null;
let _onStopHandler: (() => void) | null = null;
let _onEndedHandler: (() => void) | null = null;

/** 持久化播放模式到 globalData + Storage */
function setStoredLoopType(type: AppUI.LoopType): void {
  const app = getGlobalApp();
  (app.globalData.audio as Record<string, unknown>).loopType = type;
  wx.setStorageSync('loopType', type);
}

/** 根据播放模式同步 audio.loop 属性 */
function syncAudioLoop(audio: WechatMiniprogram.InnerAudioContext | null, loopType: AppUI.LoopType): void {
  if (audio) {
    audio.loop = (loopType === defaultAudioInfo.loopType);
  }
}

Component({
  data: {
    musicList: [] as AppUI.Audio[],
    currentMusic: null as AppUI.Audio | null,
    loopType: defaultAudioInfo.loopType
  },

  lifetimes: {
    attached() {
      const app = getGlobalApp();
      // 安全获取全局数据
      const globalData = app.globalData;
      if (!globalData?.audio) return;

      // 初始化播放模式（优先从 Storage 恢复）
      const VALID_LOOP_TYPES: AppUI.LoopType[] = ["单曲循环", "列表循环", "随机播放"];
      let storedLoop=wx.getStorageSync<AppUI.LoopType>('loopType')
      // wx.getStorageSync 首次返回空字符串 ""，需要判断是否为有效值
      if (!storedLoop || !(VALID_LOOP_TYPES as string[]).includes(storedLoop)) {
        storedLoop = defaultAudioInfo.loopType;
      }
      setStoredLoopType(storedLoop);
      this.setData({ loopType: storedLoop });

      // 初始化音乐列表（可从全局或本地存储读取）
      const storedList = wx.getStorageSync('musicList') as AppUI.Audio[] | undefined;
      const defaultList: AppUI.Audio[] =paths.audios;
      this.setData({ musicList: storedList?.length ? storedList : defaultList });

      // 同步全局播放状态
      const audio = globalData.audio.Context;
      if (audio) {
        const current = globalData.audio.info || null;
        this.setData({ currentMusic: current });

        // 初始化 audio.loop
        syncAudioLoop(audio, storedLoop);

        // 监听播放状态变化
        _onPlayHandler = () => {
          const cm = this.data.currentMusic;
          if (cm) {
            this.setData({ 'currentMusic.isPlaying': true });
          }
        };
        _onPauseHandler = () => {
          const cm = this.data.currentMusic;
          if (cm) {
            this.setData({ 'currentMusic.isPlaying': false });
          }
        };
        _onStopHandler = () => {
          const cm = this.data.currentMusic;
          if (cm) {
            this.setData({ 'currentMusic.isPlaying': false });
          }
        };
        _onEndedHandler = () => {
          this._handleTrackEnded();
        };
        audio.onPlay(_onPlayHandler);
        audio.onPause(_onPauseHandler);
        audio.onStop(_onStopHandler);
        audio.onEnded(_onEndedHandler);
      }
      // 监听 BackgroundMusic 的切换事件，同步当前曲目信息
      _onMusicToggle=(info: AppUI.Audio) => {
        if (info) {
          this.setData({ currentMusic: info });
        }
      }
      onAudioToggle(_onMusicToggle);
    },

    detached() {
      if (_onMusicToggle) {
        offAudioToggle(_onMusicToggle);
        _onMusicToggle = null;
      }
      const app = getGlobalApp();
      // 清理音频内置事件监听，防止组件重创建时累积
      const audio = app.globalData.audio?.Context;
      if (audio) {
        if (_onPlayHandler) { audio.offPlay(_onPlayHandler); _onPlayHandler = null; }
        if (_onPauseHandler) { audio.offPause(_onPauseHandler); _onPauseHandler = null; }
        if (_onStopHandler) { audio.offStop(_onStopHandler); _onStopHandler = null; }
        if (_onEndedHandler) { audio.offEnded(_onEndedHandler); _onEndedHandler = null; }
      }
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
        // 按顺序播放下一首，到末尾回第一首
        const curIndex = list.findIndex(m => m.id === current.id);
        const nextIndex = (curIndex + 1) % list.length;
        this._switchToTrack(nextIndex);
      } else if (loopType === "随机播放") {
        // 随机选一首（列表 >1 首时尽量不重复当前）
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

      // 同步 InnerAudioContext.loop
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

      // 切歌时同步 loop 属性
      syncAudioLoop(audio, app.globalData.audio.loopType);

      audio.src = music.url;
      audio.play();
      const current: AppUI.Audio = { 
        id:music.id,
        name: music.name, 
        url: music.url,
        isPlaying: true 
      };
      app.globalData.audio.info = current;
      this.setData({ currentMusic: current });
      // 通知 BackgroundMusic 曲目已切换
      emitAudioChanged(current);
    },

    handlePlayPause() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (!audio) return;
      if (this.data.currentMusic?.isPlaying) {
        audio.pause();
      } else {
        // 如果没有选中音乐，默认播放第一首
        if (!this.data.currentMusic && this.data.musicList.length) {
          const first = this.data.musicList[0];
          syncAudioLoop(audio, app.globalData.audio.loopType);
          audio.src = first.url;
          const info: AppUI.Audio = {
            id:first.id,
            name: first.name,
            url: first.url,
            isPlaying: true
          };
          app.globalData.audio.info = info;
          this.setData({ currentMusic: info });
          // 首次播放默认曲目，通知 BackgroundMusic
          emitAudioChanged(info);
        }
        audio.play();
      }
    },

    handleStop() {
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (audio) audio.stop();
      // 停止后重置状态
      if (this.data.currentMusic) {
        this.setData({ 'currentMusic.isPlaying': false });
        const info = app.globalData.audio.info;
        if (info) {
          info.isPlaying = false;
        }
        // 通知 BackgroundMusic 音乐已停止
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
      // 同步到存储
      wx.setStorageSync('musicList', musicList);
    }
  }
});

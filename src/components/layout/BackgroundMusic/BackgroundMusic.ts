import { defaultAudioInfo } from '../../../config';
import { onAudioChanged,emitAudioToggle,onAudioStopped ,offAudioStopped,offAudioChanged} from '../../../events/audioEvents';
/** 延迟获取 app 实例，避免模块顶层调用时尚未初始化 */
function getGlobalApp(): IAppOption {
  return getApp<IAppOption>();
}
// 事件回调引用（模块级闭包，用于 attached/detached 生命周期管理）
let _onMusicChanged: ((music: AppUI.Audio) => void) | null = null;
let _onMusicStopped: (() => void) | null = null;
// 音频内置事件回调引用（用于 detached 清理）
let _onPlayHandler: (() => void) | null = null;
let _onPauseHandler: (() => void) | null = null;
let _onStopHandler: (() => void) | null = null;

Component({
  data:{
    isPlaying:false
  },
  lifetimes: {
    attached() {
      const app = getGlobalApp();
      const options = app.globalData;
      // 初始化音频上下文
      if (!options.audio.Context) {
        const innerAudio = wx.createInnerAudioContext();
        innerAudio.src = options.audio.info.url; // 背景音乐路径
        // 根据存储的播放模式同步 loop 属性
        const storedLoop = wx.getStorageSync('loopType') as AppUI.LoopType | undefined;
        innerAudio.loop = (storedLoop === defaultAudioInfo.loopType || storedLoop === undefined);
        innerAudio.autoplay = true;
        app.globalData.audio.Context = innerAudio;
        // 如果 URL 已经是合法 HTTPS 地址（非 cloud://），手动触发放以确保播放
        if (options.audio.info.url && !options.audio.info.url.startsWith('cloud://')) {
          innerAudio.play();
        }
      }

      // 同步全局播放状态
      const globalPlaying = app.globalData.audio.info.isPlaying || false;
      this.setData({ isPlaying: globalPlaying });

      // 监听音频状态变化
      const audio = app.globalData.audio.Context;
      if(!audio) return;
      _onPlayHandler = () => {
        const app = getGlobalApp();
        app.globalData.audio.info.isPlaying = true;
        this.setData({ isPlaying: true });
      };
      _onPauseHandler = () => {
        const app = getGlobalApp();
        app.globalData.audio.info.isPlaying = false;
        this.setData({ isPlaying: false });
      };
      _onStopHandler = () => {
        const app = getGlobalApp();
        app.globalData.audio.info.isPlaying = false;
        this.setData({ isPlaying: false });
      };
      audio.onPlay(_onPlayHandler);
      audio.onPause(_onPauseHandler);
      audio.onStop(_onStopHandler);

      // 监听 SettingSound 曲目切换事件
      _onMusicChanged=(music: AppUI.Audio) => {
        // 曲目变化 — 本组件仅关注播放状态，曲目名等详细信息由 SettingSound 管理
        this.setData({ isPlaying: music.isPlaying });
      }
      onAudioChanged(_onMusicChanged);
      // 监听 SettingSound 停止事件
      _onMusicStopped=() => {
        this.setData({ isPlaying: false });
      }
      onAudioStopped(_onMusicStopped);
    },

    detached() {
      if (_onMusicChanged) {
        offAudioChanged(_onMusicChanged);
        _onMusicChanged = null;
      }
      if (_onMusicStopped) {
        offAudioStopped(_onMusicStopped);
        _onMusicStopped = null;
      }
      const app = getGlobalApp();
      const audio = app.globalData.audio.Context;
      if (audio) {
        // 清理内置事件监听，防止组件重创建时累积
        if (_onPlayHandler) { 
          audio.offPlay(_onPlayHandler); 
          _onPlayHandler = null; 
        }
        if (_onPauseHandler) { 
          audio.offPause(_onPauseHandler); 
          _onPauseHandler = null; 
        }
        if (_onStopHandler) { 
          audio.offStop(_onStopHandler); 
          _onStopHandler = null; 
        }
        audio.destroy();
        app.globalData.audio.Context = null;
      }
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
        // 确保播放的是 globalData 中的当前曲目
        if (info?.url && audio.src !== info.url) {
          audio.src = info.url;
        }
        audio.play();
      }
      // 通知 SettingSound 背景音乐组件发生了切换
      emitAudioToggle(app.globalData.audio.info);
    }
  }
})
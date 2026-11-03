import {
  CLOUD_ENV,
  AUDIO_CLOUD_FILE_IDS,
  AUDIO_LOCAL_PATHS,
  isEnvConfigured,
} from "./config/env";
import { defaultAudioInfo, defaultGameData, defaultTextSpeed, paths } from "./config";
import { showNotification } from "./events/notifyEvents";
import { getTempFileURL } from "./api/cloudSync";
import { flushPendingOps, loadSnapshot } from "./services/repository";

/** 是否由 onHide 主动暂停（回前台只恢复此类暂停，不打断用户手动暂停） */
let pausedByHide = false;

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 云端数据恢复成功不再弹通知：避免每次冷启动触发一次通知组件渲染 + 动画
 * - InnerAudioContext 会话级复用：切后台 pause / 回前台 play，统一在 onUnload 销毁
 *   （组件 detached 已不再 destroy，见 BackgroundMusic.ts）
 */
App<IAppOption>({
  globalData: {
    audio: defaultAudioInfo,
    userInfo: {
      gameData: defaultGameData,
      textSpeed: defaultTextSpeed,
      openid: "",
    },
  },

  onLaunch() {
    if (!wx.cloud) {
      showNotification({
        title: "环境提示",
        message: "当前基础库不支持云开发，请使用较新版本微信",
        levelType: "warning",
      });
      return;
    }
    if (!isEnvConfigured()) {
      showNotification({
        title: "环境提示",
        message: "云环境未配置，请在发布前执行 npm run inject:env",
        levelType: "warning",
      });
      return;
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      // 不把用户标识写入可检索的云开发日志
      traceUser: false,
    });
    this.parseCloudFilePath();
    void this.restoreCloudData();
  },

  /** 音频资源：本地内置优先（离线可用），云存储临时链接作为增强，失败静默回退 */
  parseCloudFilePath() {
    AUDIO_LOCAL_PATHS.forEach((local, i) => {
      if (paths.audios[i]) paths.audios[i].url = local;
    });
    if (paths.audios[0]) {
      this.globalData.audio.info.url = paths.audios[0].url;
    }
    const ctx = this.globalData.audio.Context;
    if (ctx) {
      ctx.src = this.globalData.audio.info.url;
    }
    void getTempFileURL(Array.from(AUDIO_CLOUD_FILE_IDS))
      .then((list) => {
        list.forEach((item, i) => {
          if (item.tempFileURL && paths.audios[i]) {
            paths.audios[i].url = item.tempFileURL;
            if (i === 0) this.globalData.audio.info.url = item.tempFileURL;
          }
        });
        const audio = this.globalData.audio.Context;
        if (audio && this.globalData.audio.info.url) {
          audio.src = this.globalData.audio.info.url;
        }
      })
      .catch(() => {
        // 已回退本地资源，无需提示
      });
  },

  /** 启动即恢复：不再依赖先取 openid（身份只在云函数侧使用） */
  async restoreCloudData(): Promise<void> {
    try {
      await loadSnapshot();
      // 成功静默：不打扰首屏，也不产生一次额外的通知渲染
      await flushPendingOps();
    } catch {
      showNotification({
        title: "数据加载",
        message: "云端数据加载失败，已使用本地数据",
        levelType: "warning",
      });
    }
  },

  /** 切后台：暂停正在播放的背景音乐（不销毁上下文） */
  onHide() {
    const audio = this.globalData.audio;
    const ctx = audio.Context;
    if (ctx && audio.info?.isPlaying) {
      pausedByHide = true;
      ctx.pause();
    }
  },

  /** 回前台：仅恢复由 onHide 主动暂停的播放 */
  onShow() {
    const ctx = this.globalData.audio.Context;
    if (ctx && pausedByHide) {
      pausedByHide = false;
      ctx.play();
    }
  },

  /** 显式销毁音频上下文：由「退出游戏」入口调用（App 本身没有 onUnload 生命周期） */
  destroyAudio() {
    const ctx = this.globalData.audio.Context;
    if (ctx) {
      try {
        ctx.stop();
        ctx.destroy();
      } catch {
        // 忽略销毁异常，交由系统回收
      }
      this.globalData.audio.Context = null;
    }
  },

  /** 兼容 IAppOption 中已有方法名 */
  async loadCloudData(): Promise<void> {
    await this.restoreCloudData();
  },
});

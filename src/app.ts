import { 
  loadGameDataFromCloud, 
  getUserOpenId,
  getTempFileURL
} from "./api/cloudSync";
import {
  envList,
  defaultAudioInfo,
  defaultGameData,
  defaultTextSpeed,
  paths
} from "./config";
import { showNotification } from "./events/notifyEvents";

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
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: envList.length > 0?envList[0]:"",
        traceUser: true,
      });
      this.parseCloudFilePath();
      getUserOpenId().then(res =>{
        if(res){
          console.log("[App] 获取用户openid成功", res);
          this.globalData.userInfo.openid = res;
          void this.loadCloudData()
        }
      });
    }
  },

  parseCloudFilePath() {
    paths.localAudios.forEach((localAudio,i)=>{
      paths.audios[i].url = localAudio;
      if (i === 0) {
        this.globalData.audio.info.url = localAudio;
      }
    })
    const ctx = this.globalData.audio.Context;
    if (ctx) {
      ctx.src = this.globalData.audio.info.url;
      ctx.play();
    }
    const audioUrls = paths.audios.map((a) => a.url);
    if (audioUrls.length > 0) {
      getTempFileURL(audioUrls).then((res: ICloud.GetTempFileURLResultItem[]) => {
        res.forEach((item, i) => {
          if (item.tempFileURL && paths.audios[i]) {
            paths.audios[i].url = item.tempFileURL;
            if (i === 0) {
              this.globalData.audio.info.url = item.tempFileURL;
            }
          }
        });
        const ctx = this.globalData.audio.Context;
        if (ctx) {
          ctx.src = this.globalData.audio.info.url;
          ctx.play();
        }
      }).catch();
    }
  },

  /** 从云端加载游戏数据并合并到 globalData */
  async loadCloudData() {
    try {
      const cloudData = await loadGameDataFromCloud();
      if (!cloudData || !cloudData.currentRole) return;
      const gd = this.globalData.userInfo.gameData;
      // 合并云端角色数据（仅当本地无活跃游戏时覆盖）
      if (!gd.currentRole || gd.gameAction === "save") {
        gd.currentRole = cloudData.currentRole;
      }
      // 合并角色存档
      if (cloudData.roles) {
        gd.roles = { ...cloudData.roles, ...gd.roles };
      }
      // 恢复存档列表到本地（备份用途）
      if (cloudData.saves && cloudData.saves.length > 0) {
        const localSaves = wx.getStorageSync("gameSaves") || [];
        if (!Array.isArray(localSaves) || localSaves.length === 0) {
          wx.setStorageSync("gameSaves", cloudData.saves);
        }
      }
      // 恢复成就
      if (cloudData.achievements && cloudData.achievements.length > 0) {
        const localAchievements: string[] =
          wx.getStorageSync("achievements") || [];
        const merged = [
          ...new Set([...localAchievements, ...cloudData.achievements]),
        ];
        wx.setStorageSync("achievements", merged);
      }
      // 恢复结局
      if (cloudData.endings && cloudData.endings.length > 0) {
        const localEndings: Array<{ sceneId: string; endingKey: string }> =
          wx.getStorageSync("endings") || [];
        const merged = [...localEndings];
        for (const ce of cloudData.endings) {
          if (
            !merged.some(
              (e) => e.sceneId === ce.sceneId && e.endingKey === ce.endingKey
            )
          ) {
            merged.push(ce);
          }
        }
        wx.setStorageSync("endings", merged);
      }
      showNotification({
        title:"数据加载",
        message:"数据同步成功",
        levelType:"success"
      });
    } catch (_err) {
      showNotification({
        title:"数据加载",
        message:"云端数据加载失败，使用本地数据",
        levelType:"warning"
      });
    }
  },
});

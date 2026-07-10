/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    audio: {
      info: AppUI.Audio,
      Context:WechatMiniprogram.InnerAudioContext | null,
      loopType:AppUI.LoopType
    }
    userInfo: {
      gameData:{
        gameAction:"save"|"load"|"new",
        currentRole:AppGame.Role|null,
        roles:Record<string,AppGame.Role>,
        plots:AppGame.Plots|null
      },
      textSpeed:number,
      wxInfo?:WechatMiniprogram.UserInfo,
      openid?:string,
    }
  },
  loadCloudData:()=>Promise<void>,
  parseCloudFilePath:()=>void,
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}
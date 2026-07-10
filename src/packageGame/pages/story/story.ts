import { defaultGameData } from "../../../config";
Page({
  data: {
    currentNodeId:null as string|null,
    gender: defaultGameData.currentRole?.gender as AppGame.GenderType,
    elements:defaultGameData.currentRole?.elements as AppGame.Elements,
    attributes:defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
    level:defaultGameData.currentRole?.level as AppGame.Level,
    age: defaultGameData.currentRole?.age as number,
    name:"",
    traits: [] as AppGame.TraitsItem[],
  },

  onLoad(options: {gender:AppGame.GenderType}) {
    this.initFromGlobalOrOptions(options);
  },

    onShow() {
      // 从存档页或天赋页返回后，若 gameAction 为 "load" 且有角色数据，重新渲染
      const app=getApp<IAppOption>();
      const gameAction = app.globalData.userInfo.gameData.gameAction;
      if((gameAction === "load" || gameAction === "new") && app.globalData.userInfo.gameData.currentRole){
        const r = app.globalData.userInfo.gameData.currentRole;
        this.setData({
          currentNodeId: r.currentNode,
          gender: r.gender,
          elements: r.elements,
          attributes: r.attributes,
          level: r.level,
          age: r.age,
          name: r.name,
          traits: r.traits || [],
        })
      }
    },

    initFromGlobalOrOptions(options: {gender:AppGame.GenderType}) {
      const app=getApp<IAppOption>();
      const gameAction = app.globalData.userInfo.gameData.gameAction;
      if((gameAction === "load" || gameAction === "new") && app.globalData.userInfo.gameData.currentRole){
        const r = app.globalData.userInfo.gameData.currentRole;
        this.setData({
          currentNodeId: r.currentNode,
          gender: r.gender,
          elements: r.elements,
          attributes: r.attributes,
          level: r.level,
          age: r.age,
          name: r.name,
          traits: r.traits || [],
        })
        return;
      }
      // 新游戏：从 globalData 读取（已由 talent 页设置）
      const role = app.globalData.userInfo.gameData.currentRole;
    this.setData({ 
      gender: options.gender,
      currentNodeId: role?.currentNode || defaultGameData.currentRole?.currentNode,
      elements: role?.elements || defaultGameData.currentRole?.elements as AppGame.Elements,
      attributes: role?.attributes || defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
      traits: role?.traits || [],
      name: role?.name || "",
      age: role?.age || 1,
      level: role?.level || defaultGameData.currentRole?.level as AppGame.Level,
    })
  }
})
import { defaultGameData } from "@src/config";
Page({
  data: {
    currentNodeId: null as string | null,
    gender: defaultGameData.currentRole?.gender as AppGame.GenderType,
    elements: defaultGameData.currentRole?.elements as AppGame.Elements,
    attributes: defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
    level: defaultGameData.currentRole?.level as AppGame.Level,
    age: defaultGameData.currentRole?.age as number,
    name: "",
    traits: [] as AppGame.TraitsItem[],
  },

  onLoad(options: { gender: AppGame.GenderType }) {
    (this as any)._pendingGender = options.gender;
  },

  onShow() {
    this.syncRoleFromGlobal();
  },

  /** 唯一的渲染入口：读档/新游戏与默认进入两条分支都只 setData 一次 */
  syncRoleFromGlobal() {
    const self = this as any;
    const app = getApp<IAppOption>();
    const gameAction = app.globalData.userInfo.gameData.gameAction;
    const role = app.globalData.userInfo.gameData.currentRole;

    if ((gameAction === "load" || gameAction === "new") && role) {
      this.setData({
        currentNodeId: role.currentNode,
        gender: role.gender,
        elements: role.elements,
        attributes: role.attributes,
        level: role.level,
        age: role.age,
        name: role.name,
        traits: role.traits || [],
      });
      return;
    }

    this.setData({
      gender: self._pendingGender,
      currentNodeId: role?.currentNode || defaultGameData.currentRole?.currentNode,
      elements: role?.elements || (defaultGameData.currentRole?.elements as AppGame.Elements),
      attributes: role?.attributes || (defaultGameData.currentRole?.attributes as AppGame.RoleAttributes),
      traits: role?.traits || [],
      name: role?.name || "",
      age: role?.age || 1,
      level: role?.level || (defaultGameData.currentRole?.level as AppGame.Level),
    });
  }
});

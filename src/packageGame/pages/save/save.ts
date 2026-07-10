import { defaultGameData } from "../../../config";
import { saveGameDataToCloud } from "../../../api/cloudSync";
import { showNotification } from "../../../events/notifyEvents";
const SAVE_KEY = "gameSaves";
const MAX_MANUAL_SAVE = 3;

/** 五行顺序 */
const ELEM_ORDER = ["gold","wood","water","fire","earth"] as const;

/** Elements Record → 排序数组 */
function elementsToArr(els: AppGame.Elements): AppUI.ElementDisplayItem[] {
  return ELEM_ORDER
    .filter(k => els[k])
    .map(k => ({ key: k, name: els[k].name, level: els[k].level, leveName: els[k].leveName }));
}

/** Attributes Record → 数组 */
function attrsToArr(attrs: AppGame.RoleAttributes): AppUI.AttrDisplayItem[] {
  if (!attrs) return [];
  return Object.entries(attrs).map(([k, v]) => ({ key: k, name: v.name, val: v.val }));
}

Page({
  data: {
    autoArchive: null as AppUI.ArchiveItem | null,
    autoElementsArr: [] as AppUI.ElementDisplayItem[],
    autoAttrsArr: [] as AppUI.AttrDisplayItem[],
    manualArchives: [] as AppUI.ArchiveItem[],
    manualElementsArrs: [] as AppUI.ElementDisplayItem[][],
    manualAttrsArrs: [] as AppUI.AttrDisplayItem[][],
    decos: ["🌸", "📖", "✧"],
    emptySlots: [] as number[],
    showModal: false,
    deleteTarget: null as AppUI.ArchiveItem | null,
  },

  onLoad() {
    this.loadManualArchives();
  },

  onShow() {
    this.buildAutoArchive();
  },

  // ==================== 自动存档 ====================

  /** 从当前 globalData 构建自动存档（始终为 slot 0） */
  buildAutoArchive() {
    const app = getApp<IAppOption>();
    const { currentRole, plots: gamePlot } = app.globalData.userInfo.gameData;
    if(!currentRole) return;
    const elements = currentRole.elements || defaultGameData.currentRole?.elements as AppGame.Elements;
    const attributes = currentRole.attributes || defaultGameData.currentRole?.attributes as AppGame.RoleAttributes;
    const auto: AppUI.ArchiveItem = {
      id: 0,
      avatar: currentRole.avatar,
      name: currentRole.name || "无名",
      gender: currentRole.gender,
      age: currentRole.age,
      level: currentRole.level || {level:0,name:"练气期"},
      elements,
      attributes,
      time: this.formatTime(),
      preview: this.buildPreview(currentRole, currentRole?.currentNode, gamePlot),
      currentNodeId: currentRole?.currentNode,
      tag: "自动存档",
    };
    this.setData({
      autoArchive: auto,
      autoElementsArr: elementsToArr(elements),
      autoAttrsArr: attrsToArr(attributes),
    });
  },

  // ==================== 手动存档 ====================

  /** 从本地存储读取手动存档列表 */
  loadManualArchives() {
    const raw = wx.getStorageSync(SAVE_KEY);
    const manualArchives: AppUI.ArchiveItem[] = Array.isArray(raw) ? raw : [];
    const elemsArrs = manualArchives.map(a => a.elements ? elementsToArr(a.elements) : []);
    const attrsArrs = manualArchives.map(a => a.attributes ? attrsToArr(a.attributes) : []);
    this.setData({ manualArchives, manualElementsArrs: elemsArrs, manualAttrsArrs: attrsArrs });
    this.updateEmptySlots();
  },

  /** 持久化手动存档列表 */
  saveManualArchives(manualArchives: AppUI.ArchiveItem[]) {
    wx.setStorageSync(SAVE_KEY, manualArchives);
    const elemsArrs = manualArchives.map(a => a.elements ? elementsToArr(a.elements) : []);
    const attrsArrs = manualArchives.map(a => a.attributes ? attrsToArr(a.attributes) : []);
    this.setData({ manualArchives, manualElementsArrs: elemsArrs, manualAttrsArrs: attrsArrs });
    this.updateEmptySlots();
  },

  /** 根据当前游戏数据生成存档预览 */
  buildPreview(currentRole: AppGame.Role | null, currentNodeId: string | null, gamePlot: AppGame.Plots | null):string{
    if (currentRole) {
      const node = (gamePlot?.nodes && currentNodeId) ? gamePlot.nodes[currentNodeId] : null;
      if (node && node.text && node.text.length > 0) {
        const currentLine = node.text[node.text.length - 1];
        if (currentLine) {
          return currentLine.length > 20 ? currentLine.slice(0, 20) + "…" : currentLine;
        }
      }
    };
    return "故事从这里开始…";
  },

  /** 更新空位（手动存档剩余槽位） */
  updateEmptySlots() {
    const current = this.data.manualArchives.length;
    const slots = Array.from(
      { length: Math.max(0, MAX_MANUAL_SAVE - current) },
      (_, i) => current + i + 1,
    );
    this.setData({ emptySlots: slots });
  },

  // ===== 事件处理 =====
  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onHelp() {
    showNotification({ message: "存档管理", levelType: "info" });
  },

  /** 读取存档 — 覆盖当前角色并跳转到故事界面 */
  onLoadArchive(e: WechatMiniprogram.CustomEvent) {
    const app = getApp<IAppOption>();
    const id = e.detail.saveId as number;

    // 自动存档（id=0）：当前数据即是最新，直接进入故事
    if (id === 0) {
      app.globalData.userInfo.gameData.gameAction = "load";
      wx.navigateTo({ url: "/packageGame/pages/story/story" });
      return;
    }

    // 手动存档
    const item = this.data.manualArchives.find((a) => a.id === id);
    if (!item) return;

    showNotification({ message: `📖 正在读取「${item.name || "存档"}」…`, levelType: "info" });

    // 尝试从全局 roles 获取完整角色数据（含 attributes、traits 等），否则从 ArchiveItem 构建
    const savedFullRole = app.globalData.userInfo.gameData.roles[String(id)];
    const savedRole: AppGame.Role = savedFullRole
      ? { ...savedFullRole }
      : {
          name: item.name,
          avatar: item.avatar,
          gender: item.gender,
          age: item.age,
          level: item.level,
          elements: item.elements || defaultGameData.currentRole?.elements as AppGame.Elements,
          attributes: defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
          currentNode: item.currentNodeId,
        };

    // 覆盖当前角色
    app.globalData.userInfo.gameData.currentRole = savedRole;
    app.globalData.userInfo.gameData.gameAction = "load";

    // 跳转到故事界面
    wx.navigateTo({ url: "/packageGame/pages/story/story" });
  },

  /** 新建手动存档 */
  onNewArchive() {
    if (this.data.manualArchives.length >= MAX_MANUAL_SAVE) {
      showNotification({ message: "📦 存档已满，请先删除一些吧", levelType: "warning" });
      return;
    }

    const app = getApp<IAppOption>();
    const { currentRole, plots: gamePlot } = app.globalData.userInfo.gameData;

    if (!currentRole || !currentRole.name) {
      showNotification({ message: "请先创建角色", levelType: "warning" });
      return;
    }

    const nextId = currentRole.currentNode || null;
    const id = Date.now();
    const newItem: AppUI.ArchiveItem = {
      id,
      avatar: currentRole.avatar,
      name: currentRole.name,
      gender: currentRole.gender,
      age: currentRole.age,
      level: currentRole.level || ({ level: 0, name: "练气期" } as AppGame.Level),
      elements: currentRole.elements || defaultGameData.currentRole?.elements as AppGame.Elements,
      attributes: currentRole.attributes || defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
      time: this.formatTime(),
      preview: this.buildPreview(currentRole, nextId, gamePlot),
      currentNodeId: nextId,
    };

    this.saveManualArchives([...this.data.manualArchives, newItem]);

    // 同时写入全局数据 roles，方便读档直接恢复
    app.globalData.userInfo.gameData.roles[String(id)] = { ...currentRole };

    // 同步到云端
    this.syncToCloud();

    showNotification({ message: "🎉 存档成功！", levelType: "success" });
  },

  /** 点击删除按钮 */
  onDeleteTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as number;
    const item = this.data.manualArchives.find((a) => a.id === id);
    if (item) {
      this.setData({ showModal: true, deleteTarget: item });
    }
  },

  onModalMask() {
    this.setData({ showModal: false });
  },

  onModalCancel() {
    this.setData({ showModal: false });
  },

  /** 确认删除 */
  onModalConfirm() {
    const target = this.data.deleteTarget;
    if (!target) return;
    const newList = this.data.manualArchives.filter((a) => a.id !== target.id);
    this.setData({ showModal: false, deleteTarget: null });
    this.saveManualArchives(newList);
    // 同步到云端
    this.syncToCloud();
    showNotification({ 
      message: `已删除「${target.name || "存档"}」`, levelType: "warning" 
    });
  },

  /** 将当前游戏数据和存档同步到云端 */
  syncToCloud() {
    const app = getApp<IAppOption>();
    const gd = app.globalData.userInfo.gameData;
    saveGameDataToCloud({
      currentRole: gd.currentRole,
      roles: gd.roles || {},
      saves: this.data.manualArchives.slice(),
      achievements: wx.getStorageSync("achievements") || [],
      endings: wx.getStorageSync("endings") || [],
    });
  },

  noop() {},

  // ===== 工具方法 =====
  formatTime(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

});
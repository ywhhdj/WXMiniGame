import { defaultGameData } from "@src/config";
import { showNotification } from "@src/events/notifyEvents";
import * as storage from "@src/services/storage";
import {
  getCurrentRole,
  getGameData,
  getPlots,
  setCurrentRole,
} from "@src/services/gameState";
import { saveCurrentState } from "@src/services/repository";
import type { SaveItem } from "@shared/index";

const MAX_MANUAL_SAVE = 3;
const ELEM_ORDER = ["gold", "wood", "water", "fire", "earth"] as const;

/** 16–19 位数字 ID：毫秒时间戳 ×1000 + 随机尾数，避免 Date.now() 碰撞且兼容 SaveCard 的 Number 绑定 */
function newSaveId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function elementsToArr(els: AppGame.Elements): AppUI.ElementDisplayItem[] {
  return ELEM_ORDER.filter((k) => els[k]).map((k) => ({
    key: k,
    name: els[k].name,
    level: els[k].level,
    leveName: els[k].leveName,
  }));
}

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

  buildAutoArchive() {
    const currentRole = getCurrentRole();
    const gamePlot = getPlots();
    if (!currentRole) return;
    const elements =
      currentRole.elements || (defaultGameData.currentRole?.elements as AppGame.Elements);
    const attributes =
      currentRole.attributes ||
      (defaultGameData.currentRole?.attributes as AppGame.RoleAttributes);
    const auto: AppUI.ArchiveItem = {
      id: 0,
      avatar: currentRole.avatar,
      name: currentRole.name || "无名",
      gender: currentRole.gender,
      age: currentRole.age,
      level: currentRole.level || { level: 0, name: "练气期" },
      elements,
      attributes,
      time: this.formatTime(),
      preview: this.buildPreview(currentRole, currentRole.currentNode, gamePlot),
      currentNodeId: currentRole.currentNode,
      tag: "自动存档",
    };
    this.setData({
      autoArchive: auto,
      autoElementsArr: elementsToArr(elements),
      autoAttrsArr: attrsToArr(attributes),
    });
  },

  /** 纯计算：空槽位数组，随主 setData 一次性写入，不再单独触发一次渲染 */
  _emptySlots(count: number): number[] {
    return Array.from(
      { length: Math.max(0, MAX_MANUAL_SAVE - count) },
      (_, i) => count + i + 1,
    );
  },

  /** 读取本地存档：storage 层已做结构校验与旧格式兼容 */
  loadManualArchives() {
    const manualArchives = storage.readSaves() as unknown as AppUI.ArchiveItem[];
    const elemsArrs = manualArchives.map((a) =>
      a.elements ? elementsToArr(a.elements) : [],
    );
    const attrsArrs = manualArchives.map((a) =>
      a.attributes ? attrsToArr(a.attributes) : [],
    );
    this.setData({
      manualArchives,
      manualElementsArrs: elemsArrs,
      manualAttrsArrs: attrsArrs,
      emptySlots: this._emptySlots(manualArchives.length),
    });
  },

  /** 持久化存档并触发云端保存：每条存档自带完整 role 快照，消除 saves/roles 双写不一致 */
  saveManualArchives(manualArchives: AppUI.ArchiveItem[], extra?: Record<string, unknown>) {
    const role = getCurrentRole();
    const saves: SaveItem[] = (manualArchives as unknown as SaveItem[]).map((item) => ({
      ...item,
      role: item.role ?? (role as unknown as SaveItem["role"]),
    }));
    storage.writeSaves(saves);
    const elemsArrs = manualArchives.map((a) =>
      a.elements ? elementsToArr(a.elements) : [],
    );
    const attrsArrs = manualArchives.map((a) =>
      a.attributes ? attrsToArr(a.attributes) : [],
    );
    // 一次 setData：列表、派生数组、空槽位与可选附加状态一并提交
    this.setData({
      manualArchives,
      manualElementsArrs: elemsArrs,
      manualAttrsArrs: attrsArrs,
      emptySlots: this._emptySlots(manualArchives.length),
      ...(extra || {}),
    });
    // 统一走数据门面（带版本号与冲突处理），失败自动进入离线队列
    void saveCurrentState();
  },

  buildPreview(
    currentRole: AppGame.Role | null,
    currentNodeId: string | null,
    gamePlot: AppGame.Plots | null,
  ): string {
    if (currentRole) {
      const node = gamePlot?.nodes && currentNodeId ? gamePlot.nodes[currentNodeId] : null;
      if (node && node.text && node.text.length > 0) {
        const line = node.text[node.text.length - 1];
        if (line) return line.length > 20 ? line.slice(0, 20) + "…" : line;
      }
    }
    return "故事从这里开始…";
  },

  /** 兼容旧方法名：正常情况下空槽位已随主 setData 一并写入 */
  updateEmptySlots() {
    this.setData({ emptySlots: this._emptySlots(this.data.manualArchives.length) });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onHelp() {
    showNotification({ message: "存档管理", levelType: "info" });
  },

  goToStory() {
    wx.navigateTo({ url: "/pages/story/story" });
  },

  onLoadArchive(e: WechatMiniprogram.CustomEvent) {
    const id = e.detail.saveId as number;
    if (id === 0) {
      getGameData().gameAction = "load";
      this.goToStory();
      return;
    }
    const item = this.data.manualArchives.find((a) => a.id === id) as
      | (AppUI.ArchiveItem & { role?: AppGame.Role })
      | undefined;
    if (!item) return;

    showNotification({
      message: `📖 正在读取「${item.name || "存档"}」…`,
      levelType: "info",
    });
    const savedRole: AppGame.Role = item.role
      ? ({ ...item.role } as AppGame.Role)
      : {
          name: item.name,
          avatar: item.avatar,
          gender: item.gender,
          age: item.age,
          level: item.level,
          elements: item.elements || (defaultGameData.currentRole?.elements as AppGame.Elements),
          attributes:
            item.attributes ||
            (defaultGameData.currentRole?.attributes as AppGame.RoleAttributes),
          currentNode: item.currentNodeId,
        };
    setCurrentRole(savedRole);
    getGameData().gameAction = "load";
    this.goToStory();
  },

  onNewArchive() {
    if (this.data.manualArchives.length >= MAX_MANUAL_SAVE) {
      showNotification({ message: "📦 存档已满，请先删除一些吧", levelType: "warning" });
      return;
    }
    const currentRole = getCurrentRole();
    const gamePlot = getPlots();
    if (!currentRole || !currentRole.name) {
      showNotification({ message: "请先创建角色", levelType: "warning" });
      return;
    }
    const nextId = currentRole.currentNode || null;
    const newItem = {
      id: newSaveId(),
      avatar: currentRole.avatar,
      name: currentRole.name,
      gender: currentRole.gender,
      age: currentRole.age,
      level: currentRole.level || ({ level: 0, name: "练气期" } as AppGame.Level),
      elements: currentRole.elements || (defaultGameData.currentRole?.elements as AppGame.Elements),
      attributes:
        currentRole.attributes ||
        (defaultGameData.currentRole?.attributes as AppGame.RoleAttributes),
      time: this.formatTime(),
      preview: this.buildPreview(currentRole, nextId, gamePlot),
      currentNodeId: nextId,
      role: { ...currentRole },
    } as unknown as AppUI.ArchiveItem;

    this.saveManualArchives([...this.data.manualArchives, newItem]);
    showNotification({ message: "🎉 存档成功！", levelType: "success" });
  },

  onDeleteTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as number;
    const item = this.data.manualArchives.find((a) => a.id === id);
    if (item) this.setData({ showModal: true, deleteTarget: item });
  },

  onModalMask() {
    this.setData({ showModal: false });
  },
  onModalCancel() {
    this.setData({ showModal: false });
  },

  onModalConfirm() {
    const target = this.data.deleteTarget;
    if (!target) return;
    const newList = this.data.manualArchives.filter((a) => a.id !== target.id);
    // 关闭弹窗与刷新列表合并为一次 setData
    this.saveManualArchives(newList, { showModal: false, deleteTarget: null });
    showNotification({
      message: `已删除「${target.name || "存档"}」`,
      levelType: "warning",
    });
  },

  /** 保留旧方法名以兼容 WXML 绑定 */
  syncToCloud() {
    void saveCurrentState();
  },

  noop() {},

  formatTime(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
});

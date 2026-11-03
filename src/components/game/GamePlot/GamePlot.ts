import { getLocalJSONFile } from "@src/utils/http";
import { showNotification } from "@src/events/notifyEvents";
import {
  paths,
  rolesInfo,
  defaultGameData,
  levels,
  attributes,
  traits
} from "@src/config";
import {
  emitAgeChanged,
  emitArtsChanged,
  emitLevelChanged,
  offNodeChanged,
  onNodeChanged,
  emitTraitsChanged
} from "@src/events/roleEvents";

interface ShowPlotItem {
  /** 稳定唯一 key，供 WXML wx:key 复用节点 */
  id: string;
  age: number;
  text: string[];
  isChoice?: boolean;
  isLevelUpNode?: boolean;
  attrs?: AppGame.PlotAttrs;
  traits?: AppGame.TraitsItem[];
}

/** 境界映射：年龄 -> Level 对象 */
const LEVEL_AGE_MAP: Record<number, AppGame.Level> = (() => {
  const map: Record<number, AppGame.Level> = {};
  for (const name of Object.keys(levels.roleLevel) as AppGame.LevelName[]) {
    const node = levels.roleLevel[name].node;
    map[node] = levels.roleLevel[name].level;
  }
  return map;
})();

/** 占位符替换表按性别缓存，避免每个节点都重复 Object.keys + 查表 */
const SPAN_KEYS = Object.keys(rolesInfo.plotsSpan);
const SPAN_CACHE = new Map<string, [string, string][]>();
function getSpanReplacements(gender: string): [string, string][] {
  let list = SPAN_CACHE.get(gender);
  if (!list) {
    list = [];
    for (const key of SPAN_KEYS) {
      const val = rolesInfo.plotsSpan[key] as Record<string, string> | undefined;
      if (val && val[gender]) list.push([key, val[gender]]);
    }
    SPAN_CACHE.set(gender, list);
  }
  return list;
}

function getSavedAge(): number {
  const app = getApp<IAppOption>();
  return app.globalData.userInfo.gameData.currentRole?.age || 1;
}

Component({
  properties: {
    gender: {
      type: String,
      value: defaultGameData.currentRole?.gender as AppGame.GenderType,
    },
    currentNodeId: {
      type: String,
      value: "",
    },
    level: {
      type: Object,
      value: defaultGameData.currentRole?.level as AppGame.Level,
    },
  },
  lifetimes: {
    attached() {
      const self = this as any;
      self._gamePlot = null;
      self._pendingNextNode = null;
      self._plotSeq = 0;
      const app = getApp<IAppOption>();
      const gd = app.globalData.userInfo.gameData;
      const initial: Record<string, unknown> = {
        gender: this.properties.gender ||
          (defaultGameData.currentRole?.gender as AppGame.GenderType),
      };
      if (
        (gd.gameAction === "load" || gd.gameAction === "new") &&
        gd.currentRole
      ) {
        initial.currentAge = gd.currentRole.age;
      }
      // 挂载只提交一次 setData
      this.setData(initial);

      const onNodeChangedHandler = () => {
        if (gd.currentRole) {
          gd.currentRole.currentNode = this.data.currentNodeId;
        }
      };
      // 回调引用挂在组件实例上，避免模块级单例在多页面实例间串扰
      self._onNodeChanged = onNodeChangedHandler;
      onNodeChanged(onNodeChangedHandler);
    },
    async ready() {
      const self = this as any;
      const app = getApp<IAppOption>();
      let gamePlot = app.globalData.userInfo.gameData.plots;
      if (!gamePlot) {
        gamePlot = await getLocalJSONFile<AppGame.Plots>(paths.gamePlotsFilePath);
        if (!gamePlot) {
          showNotification({ message: "读取剧情失败", levelType: "error" });
          return;
        }
        app.globalData.userInfo.gameData.plots = gamePlot;
      }
      // 剧情树留在逻辑层，不进入 data / 不触发视图层传输
      self._gamePlot = gamePlot;

      const gd = app.globalData.userInfo.gameData;
      if (gd.gameAction === "load" && gd.currentRole?.currentNode) {
        this.replayToNode(gd.currentRole.currentNode, gamePlot);
      } else {
        this.loadStartNode(gamePlot);
      }
    },
    detached() {
      const self = this as any;
      const app = getApp<IAppOption>();
      if (self._gamePlot) {
        app.globalData.userInfo.gameData.plots = self._gamePlot;
      }
      if (app.globalData.userInfo.gameData.currentRole) {
        app.globalData.userInfo.gameData.currentRole.currentNode = this.data.currentNodeId;
      }
      const handler = self._onNodeChanged as (() => void) | null;
      if (handler) {
        offNodeChanged(handler);
        self._onNodeChanged = null;
      }
      self._gamePlot = null;
    },
  },
  data: {
    scrollToId: "",
    gender: "girl" as AppGame.GenderType,
    attributes: attributes,
    currentChoiceText: "",
    currentAge: 1,
    showPlots: [] as ShowPlotItem[],
    currentNodeId: "",
    currentOptions: [] as AppGame.PlotOption[],
    ended: false,
  },
  methods: {
    /** 生成稳定 id（同一组件实例内单调递增） */
    _nextPlotId(prefix: string, index: number): string {
      const self = this as any;
      self._plotSeq = (self._plotSeq || 0) + 1;
      return `${prefix}-${index}-${self._plotSeq}`;
    },

    /**
     * 路径增量追加：优先只传新增的 1 项。
     * 兜底：若目标基础库不支持数组下标追加（同步抛错或回调里长度不符），
     * 自动回退为全量数组 setData，保证任何环境下功能都正确，只是性能收益退化。
     */
   /** 路径增量追加，并触发滚动 */
   _appendPlot(item: ShowPlotItem, extra: Record<string, unknown>) {
    const plotIndex = this.data.showPlots.length;
    // 计算最后一行文本的 ID
    const targetId = `item-${plotIndex}-${item.text.length - 1}`;

    const pathPayload: Record<string, unknown> = {
      [`showPlots[${plotIndex}]`]: item,
      scrollToId: "scroll-bottom",// 触发滚动
      ...extra,
    };
    
    const plainPayload = () => ({
      ...extra,
      showPlots: [...this.data.showPlots.slice(0, plotIndex), item],
      scrollToId: targetId,
    });

    try {
      this.setData(pathPayload, () => {
        if (this.data.showPlots.length !== plotIndex + 1) {
          this.setData(plainPayload());
        }
      });
    } catch {
      this.setData(plainPayload());
    }
  },

    /** 从 startNodes 开始加载第一个节点 */
    loadStartNode(gamePlot: AppGame.Plots) {
      const random = Math.random();
      const hasSecondNode = gamePlot.startNodes.length > 1;
      const startId =
        random < 0.8 || !hasSecondNode
          ? gamePlot.startNodes[0]
          : gamePlot.startNodes[1];
      if (!startId) {
        this.setData({ ended: true });
        return;
      }
      this.loadNode(startId, gamePlot);
    },

    /** 读档回放：从 startNode 沿 next 链遍历到 savedNodeId，一次构建完整列表 */
    replayToNode(targetNodeId: string, gamePlot: AppGame.Plots) {
      const startId = gamePlot.startNodes?.[0];
      if (!startId || !gamePlot.nodes) {
        this.setData({ ended: true });
        return;
      }

      const path: string[] = [];
      let curId: string | undefined = startId;
      const visited = new Set<string>();
      while (curId && !visited.has(curId)) {
        visited.add(curId);
        path.push(curId);
        if (curId === targetNodeId) break;
        const curNode: AppGame.Plot | undefined = gamePlot.nodes[curId];
        if (!curNode) break;
        curId = curNode.next;
      }
      const reachedTarget = path.includes(targetNodeId);

      const showPlots: ShowPlotItem[] = [];
      for (let i = 0; i < path.length; i++) {
        const node = gamePlot.nodes[path[i]];
        if (!node) continue;
        showPlots.push({
          id: `replay-${i}`,
          age: i + 1,
          text: this.replaceText(node.text),
        });
      }
      if (!reachedTarget && gamePlot.nodes[targetNodeId]) {
        const targetNode = gamePlot.nodes[targetNodeId];
        this.checkLevelUp(targetNode);
        showPlots.push({
          id: `replay-target-${showPlots.length}`,
          age: path.length + 1,
          text: this.replaceText(targetNode.text),
        });
      }

      const lastNodeId = reachedTarget ? targetNodeId : startId;
      const lastNode = gamePlot.nodes[lastNodeId];
      const finalAge = getSavedAge();
      const lastIsLevelUp = lastNode?.isLevelUpNode === true;

      // 回放：发射当前节点的属性和词条事件，让 GameRole 恢复状态
      if (lastNode) {
        if (lastNode.attrs) emitArtsChanged(lastNode.attrs);
        if (lastNode.traits && lastNode.traits.length > 0) {
          const resolvedTraits = lastNode.traits
            .map(name => traits[name])
            .filter(Boolean) as AppGame.TraitsItem[];
          if (resolvedTraits.length > 0) emitTraitsChanged(resolvedTraits);
        }
        const level = lastIsLevelUp ? LEVEL_AGE_MAP[finalAge] : null;
        if (level) emitLevelChanged(level);
      }

      this.setData({
        currentNodeId: lastNodeId,
        currentAge: finalAge,
        showPlots,
        scrollToId: "scroll-bottom", // 回放完毕自动定位底部
        currentOptions: (lastNode && lastNode.options && lastNode.options.length > 0)
          ? lastNode.options
          : [],
        ...(lastNode && lastNode.options && lastNode.options.length > 0
          ? { currentChoiceText: lastNode.text[lastNode.text.length - 1] }
          : {}),
      });
    },

    /** 遍历 text 替换占位符（如 ${gender} → 女/男） */
    replaceText(text: string[]): string[] {
      const app = getApp<IAppOption>();
      const gender =
        app.globalData.userInfo.gameData.currentRole?.gender || "girl";
      const replacements = getSpanReplacements(gender);
      if (replacements.length === 0) return text.slice();
      return text.map((el) => {
        let result = el;
        for (const [key, val] of replacements) {
          result = result.split(key).join(val);
        }
        return result;
      });
    },

    /**
     * 加载指定节点并追加到 showPlots。
     * ageOverride：点击「继续」时把新年龄一并合入本次 setData，省掉一次单独提交。
     */
    loadNode(nodeId: string, gamePlot?: AppGame.Plots, ageOverride?: number) {
      const self = this as any;
      const plot = gamePlot || self._gamePlot;
      if (!plot || !plot.nodes || !plot.nodes[nodeId]) {
        this.setData({ ended: true });
        return;
      }
      const node = plot.nodes[nodeId];
      const age = ageOverride !== undefined ? ageOverride : this.data.currentAge;
      // 年龄已合并进本次 setData，境界判断必须用合并后的年龄，不能读旧的 data
      const level = this.checkLevelUp(node, age);
      const index = this.data.showPlots.length;
      const newItem: ShowPlotItem = {
        id: this._nextPlotId("node", index),
        age,
        text: this.replaceText(node.text),
        isLevelUpNode: !!level,
      };
      if (node.attrs) {
        newItem.attrs = node.attrs;
        emitArtsChanged(node.attrs);
      }
      if (node.traits && node.traits.length > 0) {
        newItem.traits = node.traits.map((name:AppGame.TraitsName) => traits[name]).filter(Boolean) as AppGame.TraitsItem[];
        if (newItem.traits.length > 0) emitTraitsChanged(newItem.traits);
      }

      const extra: Record<string, unknown> = {
        currentNodeId: nodeId,
        currentOptions: (node.options && node.options.length > 0) ? node.options : [],
      };
      if (ageOverride !== undefined) extra.currentAge = age;
      if (node.options && node.options.length > 0) {
        extra.currentChoiceText = node.text[node.text.length - 1];
      }
      if (level) extra.level = level;
      this._appendPlot(newItem, extra);
    },

    /** 点击继续 - currentAge+1，加载下一节点（只产生一次 setData） */
    handleContinue() {
      const self = this as any;
      const gamePlot = self._gamePlot as AppGame.Plots | null;
      if (!gamePlot) return;

      let nextId: string | undefined;
      if (self._pendingNextNode) {
        nextId = self._pendingNextNode;
      } else {
        const currentNode = gamePlot.nodes?.[this.data.currentNodeId];
        if (!currentNode) return;
        nextId = currentNode.next;
      }
      if (!nextId) {
        this.setData({ ended: true });
        return;
      }
      const age = this.data.currentAge + 1;
      emitAgeChanged(age);
      self._pendingNextNode = null;
      this.loadNode(nextId, undefined, age);
    },

    /** 选择选项 - 追加选项文本，处理属性/词条，保存分支下一节点 */
    handleChoice(e: WechatMiniprogram.TouchEvent) {
      const self = this as any;
      const option = e.currentTarget.dataset.option as AppGame.PlotOption;
      if (!option || !self._gamePlot) return;

      const index = this.data.showPlots.length;
      const choiceItem: ShowPlotItem = {
        id: this._nextPlotId("choice", index),
        age: this.data.currentAge,
        text: option.text,
        isChoice: true,
      };
      if (option.attrs) {
        choiceItem.attrs = option.attrs;
        emitArtsChanged(option.attrs);
      }
      if (option.traits && option.traits.length > 0) {
        const resolvedTraits = option.traits.map(name => traits[name]).filter(Boolean) as AppGame.TraitsItem[];
        if (resolvedTraits.length > 0) {
          choiceItem.traits = resolvedTraits;
          emitTraitsChanged(resolvedTraits);
        }
      }
      self._pendingNextNode = option.next || null;
      this._appendPlot(choiceItem, { currentOptions: [] });
    },

    /** 等级突破判断 */
    checkLevelUp(node: AppGame.Plot, ageOverride?: number) {
      let level: AppGame.Level | null = null;
      if (node.isLevelUpNode === true) {
        const age = ageOverride !== undefined ? ageOverride : this.data.currentAge;
        level = LEVEL_AGE_MAP[age] || null;
        if (level) emitLevelChanged(level);
      }
      return level;
    },

    handleBack() {
      const self = this as any;
      if (self._gamePlot) {
        const app = getApp<IAppOption>();
        app.globalData.userInfo.gameData.plots = self._gamePlot;
      }
      wx.navigateBack();
    },
  },
});

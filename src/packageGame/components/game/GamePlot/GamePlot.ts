import { getLocalJSONFile } from "../../../../utils/http";
import { showNotification } from "../../../../events/notifyEvents";
import {
  paths,
  rolesInfo,
  defaultGameData,
  levels,
  attributes,
  traits
} from "../../../../config";
import {
  emitAgeChanged,
  emitArtsChanged,
  emitLevelChanged,
  offNodeChanged,
  onNodeChanged,
  emitTraitsChanged
} from "../../../../events/roleEvents";
interface ShowPlotItem {
  age: number;
  text: string[];
  isChoice?: boolean;
  isLevelUpNode?: boolean;
  attrs?: AppGame.PlotAttrs;
  traits?: AppGame.TraitsItem[];
}
let _onNodeChanged: (() => void) | null = null;

/** 境界映射：年龄 -> Level 对象，优化 switch-case */
const LEVEL_AGE_MAP: Record<number, AppGame.Level> = (() => {
  const map: Record<number, AppGame.Level> = {};
  for (const name of Object.keys(levels.roleLevel) as AppGame.LevelName[]) {
    const node = levels.roleLevel[name].node;
    map[node] = levels.roleLevel[name].level;
  }
  return map;
})();

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
      const app = getApp<IAppOption>();
      this.setData({
        textSpeed: app.globalData.userInfo.textSpeed,
        gender:
          this.properties.gender ||
          (defaultGameData.currentRole?.gender as AppGame.GenderType),
      });
      if (
        (app.globalData.userInfo.gameData.gameAction === "load" ||
         app.globalData.userInfo.gameData.gameAction === "new") &&
        app.globalData.userInfo.gameData.currentRole
      ) {
        this.setData({
          currentAge: app.globalData.userInfo.gameData.currentRole.age,
        });
      }
      _onNodeChanged = () => {
        if (app.globalData.userInfo.gameData.currentRole) {
          app.globalData.userInfo.gameData.currentRole.currentNode = this.data.currentNodeId;
        }
      };
      onNodeChanged(_onNodeChanged);
    },
    async ready() {
      const app = getApp<IAppOption>();
      let gamePlot = app.globalData.userInfo.gameData.plots;
      if (!gamePlot) {
        const filePath = paths.gamePlotsFilePath;
        gamePlot = await getLocalJSONFile<AppGame.Plots>(filePath);
        if (!gamePlot) {
          showNotification({ message: "读取剧情失败", levelType: "error" });
          return;
        }
        app.globalData.userInfo.gameData.plots = gamePlot;
      }
      this.setData({ gamePlot });
      // 判断是读档回放还是新游戏
      // "new": 新游戏(从 talent 页进入) → loadStartNode
      // "load": 读档 → replayToNode
      const gameAction = app.globalData.userInfo.gameData.gameAction;
      const savedNodeId =
        app.globalData.userInfo.gameData.currentRole?.currentNode;
      if (gameAction === "load" && savedNodeId) {
        this.replayToNode(savedNodeId, gamePlot);
      } else {
        this.loadStartNode(gamePlot);
      }
    },
    detached() {
      const app = getApp<IAppOption>();
      // 保存剧情数据和当前节点到 globalData
      if (this.data.gamePlot) {
        app.globalData.userInfo.gameData.plots = this.data.gamePlot;
      }
      if (app.globalData.userInfo.gameData.currentRole) {
        app.globalData.userInfo.gameData.currentRole.currentNode = this.data.currentNodeId;
      }
      // 清理事件监听
      if (_onNodeChanged) {
        offNodeChanged(_onNodeChanged);
        _onNodeChanged = null;
      }
    },
  },
  data: {
    gender: "girl" as AppGame.GenderType,
    attributes: attributes,
    textSpeed: 100,
    currentChoiceText: "",
    currentAge: 1,
    gamePlot: null as AppGame.Plots | null,
    showPlots: [] as ShowPlotItem[],
    currentNodeId: "",
    currentOptions: [] as AppGame.PlotOption[],
    ended: false,
    //当前全部属性
    currentAttrs: null as AppGame.PlotAttrs | null,
    /** 选项指定的下一节点（分支用） */
    _pendingNextNode: null as string | null,
    /** 当前段落所有打字机是否已完成 */
    // typingDone:true as boolean
  },
  methods: {
    /** 从 startNodes 开始加载第一个节点 */
    loadStartNode(gamePlot: AppGame.Plots) {
      //随机，80%是第一个节点，20%是第二个节点
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

    /** 读档回放：从 startNode 沿 next 链遍历到 savedNodeId，批量构建 showPlots */
    replayToNode(targetNodeId: string, gamePlot: AppGame.Plots) {
      const startId = gamePlot.startNodes?.[0];
      if (!startId || !gamePlot.nodes) {
        this.setData({ ended: true });
        return;
      }

      // 先尝试沿 startNode 的 next 链找到目标节点
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

      // 如果 next 链未到达目标，尝试从 targetNodeId 反向查找（直接显示目标节点）
      const reachedTarget = path.includes(targetNodeId);

      const showPlots: ShowPlotItem[] = [];
      // 年龄从1开始，每个节点对应一年
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i];
        const node = gamePlot.nodes[nodeId];
        if (!node) continue;
        showPlots.push({
          age: i + 1,
          text: this.replaceText(node.text),
        });
      }

      // 如果未到达目标节点，直接加载目标节点
      if (!reachedTarget && gamePlot.nodes[targetNodeId]) {
        const targetNode = gamePlot.nodes[targetNodeId];
        this.checkLevelUp(targetNode);
        showPlots.push({
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
        // 发射属性变更事件
        if (lastNode.attrs) {
          emitArtsChanged(lastNode.attrs);
        }
        // 发射词条变更事件
        if (lastNode.traits && lastNode.traits.length > 0) {
          const resolvedTraits = lastNode.traits
            .map(name => traits[name])
            .filter(Boolean) as AppGame.TraitsItem[];
          if (resolvedTraits.length > 0) {
            emitTraitsChanged(resolvedTraits);
          }
        }
        // 发射境界事件（仅当目标是境界突破节点时）
        const level = lastIsLevelUp ? LEVEL_AGE_MAP[finalAge] : null;
        if (level) {
          emitLevelChanged(level);
        }
      }

      // 合并一次 setData
      const setDataPayload: Record<string, unknown> = {
        currentNodeId: lastNodeId,
        currentAge: finalAge,
        showPlots,
      };

      if (lastNode && lastNode.options && lastNode.options.length > 0) {
        setDataPayload.currentChoiceText = lastNode.text[lastNode.text.length - 1];
        setDataPayload.currentOptions = lastNode.options;
        setDataPayload.isLevelUpNode = lastIsLevelUp;
      } else {
        setDataPayload.currentOptions = [];
        setDataPayload.isLevelUpNode = lastIsLevelUp;
      }

      this.setData(setDataPayload);
    },

    /** 遍历 text 替换占位符（如 ${gender} → 女/男） */
    replaceText(text: string[]): string[] {
      const span = rolesInfo.plotsSpan;
      const app = getApp<IAppOption>();
      const gender =
        app.globalData.userInfo.gameData.currentRole?.gender || "girl";
      const spanKeys = Object.keys(span);
      return text.map((el) => {
        let result = el;
        for (const key of spanKeys) {
          const val = span[key] as Record<string, string> | undefined;
          if (val && val[gender]) {
            result = result.split(key).join(val[gender]);
          }
        }
        return result;
      });
    },

    /** 加载指定节点并追加到 showPlots */
    loadNode(nodeId: string, gamePlot?: AppGame.Plots) {
      const plot = gamePlot || this.data.gamePlot;
      if (!plot || !plot.nodes || !plot.nodes[nodeId]) {
        this.setData({ ended: true });
        return;
      }
      const node = plot.nodes[nodeId];
      let newItem: ShowPlotItem;
      const level = this.checkLevelUp(node);
      if (level) {
        newItem = {
          age: this.data.currentAge,
          text: this.replaceText(node.text),
          isLevelUpNode: true,
        };
      } else {
        newItem = {
          age: this.data.currentAge,
          text: this.replaceText(node.text),
          isLevelUpNode: false,
        };
      }
      if (node.attrs) {
        newItem.attrs = node.attrs;
        emitArtsChanged(node.attrs);
      }
      if(node.traits && node.traits.length > 0){
        newItem.traits = node.traits.map(name => traits[name]).filter(Boolean) as AppGame.TraitsItem[];
        if(newItem.traits.length > 0){
          emitTraitsChanged(newItem.traits);
        }
      }
      // 合并一次 setData，避免连续两次触发渲染
      const updateData: Record<string, unknown> = {};
      if (node.options && node.options.length > 0) {
        Object.assign(updateData, {
          currentNodeId: nodeId,
          showPlots: [...this.data.showPlots, newItem],
          currentChoiceText: node.text[node.text.length - 1],
          currentOptions: node.options,
        });
      } else {
        Object.assign(updateData, {
          currentNodeId: nodeId,
          showPlots: [...this.data.showPlots, newItem],
          currentOptions: [],
        });
      }
      if (level) {
        updateData.level = level;
      }
      this.setData(updateData);
    },

    /** 每个 typewriter 完成时回调 */
    // onTypewriterComplete(e:WechatMiniprogram.CustomEvent){
    //   const isComplete=e.detail.complete;
    //   this.setData({
    //     typingDone:isComplete
    //   })
    // },

    /** 点击继续 - currentAge+1，加载下一节点 */
    handleContinue() {
      const { gamePlot, currentNodeId, _pendingNextNode } = this.data;
      if (!gamePlot) return;

      // 优先使用选项指定的下一节点（分支）
      let nextId: string | undefined;
      if (_pendingNextNode) {
        nextId = _pendingNextNode;
      } else {
        const currentNode = gamePlot.nodes?.[currentNodeId];
        if (!currentNode) return;
        nextId = currentNode.next;
      }

      if (!nextId) {
        this.setData({ ended: true });
        return;
      }
      const age = this.data.currentAge + 1;
      emitAgeChanged(age);
      this.setData({ currentAge: age, currentAttrs: null, _pendingNextNode: null });
      this.loadNode(nextId);
    },

    /** 选择选项 - 追加选项文本，处理属性/词条，加载下一节点 */
    handleChoice(e: WechatMiniprogram.TouchEvent) {
      const option = e.currentTarget.dataset.option as AppGame.PlotOption;
      if (!option) return;

      const { gamePlot } = this.data;
      if (!gamePlot) return;
      // 追加选项文本
      let choiceItem: ShowPlotItem;
      if (option.attrs) {
        choiceItem = {
          age: this.data.currentAge,
          text: option.text,
          isChoice: true,
          attrs: option.attrs,
        };
        emitArtsChanged(option.attrs);
      } else {
        choiceItem = {
          age: this.data.currentAge,
          text: option.text,
          isChoice: true,
        };
      }
      // 选项携带词条
      if (option.traits && option.traits.length > 0) {
        const resolvedTraits = option.traits.map(name => traits[name]).filter(Boolean) as AppGame.TraitsItem[];
        if (resolvedTraits.length > 0) {
          choiceItem.traits = resolvedTraits;
          emitTraitsChanged(resolvedTraits);
        }
      }

      // 保存选项指定的下一节点（用于分支）
      const nextNodeId = option.next || null;

      this.setData({
        currentOptions: [],
        showPlots: [...this.data.showPlots, choiceItem],
        _pendingNextNode: nextNodeId,
      });
    },
    //等级突破判断
    checkLevelUp(node: AppGame.Plot) {
      let level: AppGame.Level | null = null;
      if (node.isLevelUpNode === true) {
        level = LEVEL_AGE_MAP[this.data.currentAge] || null;
        if (level) {
          emitLevelChanged(level);
        }
      }
      return level;
    },
    handleBack() {
      if (this.data.gamePlot) {
        const app=getApp<IAppOption>();
        app.globalData.userInfo.gameData.plots = this.data.gamePlot;
      }
      wx.navigateBack();
    },
  },
});

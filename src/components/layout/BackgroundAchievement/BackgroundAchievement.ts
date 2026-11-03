import * as storage from "@src/services/storage";
import { syncAchievements, syncEndings } from "@src/services/repository";
import { getCurrentRole } from "@src/services/gameState";
import type { EndingRecord } from "@shared/index";

interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: () => boolean;
}

/** 只保留 WXML 真正渲染的字段（原实现把 check 函数和原始 endings 对象也塞进 data） */
interface AchievementView {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
}

interface SceneView {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  shortLabel: string;
  endingsList: { key: string; text: string; collected: boolean }[];
  hasAllEndings: boolean;
  collectedCount: number;
}

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 原 attached 连续 4 次 setData（loadEndings / updateProgress / initScenes / initAchievements）
 *   改为「一次读取 → 一次纯计算 → 一次 setData」
 * - 解锁判定由 Array.includes 改为 Set.has；列表不再携带函数与非渲染字段
 * - 进度在逻辑层算好，避免 WXML 里调用 Math（WXML 表达式不支持 Math）
 */
const SCENE_DEFS = [
  {
    id: "cultivation-start",
    title: "修仙启程",
    subtitle: "踏上仙途",
    icon: "⛰️",
    shortLabel: "升仙令在手，仙路从此开...",
    endings: {
      "C1-A2": { text: "拜入山门", emotion: "仙缘初启" },
      "C1-B2": { text: "错失机缘", emotion: "遗憾离场" },
    } as Record<string, { text: string; emotion: string }>,
  },
  {
    id: "first-tribulation",
    title: "初劫试炼",
    subtitle: "筑基之难",
    icon: "🔥",
    shortLabel: "气行圆满，突破在即...",
    endings: {
      "D1-A2": { text: "突破成功", emotion: "道心通明" },
      "D1-B2": { text: "突破失败", emotion: "再接再厉" },
    } as Record<string, { text: string; emotion: string }>,
  },
];

Component({
  data: {
    isMuted: false,
    showModal: false,
    scenes: [] as SceneView[],
    endings: [] as EndingRecord[],
    collectedEndings: 0,
    totalEndings: 20,
    progress: 0,
    achievements: [] as AchievementView[],
    collectedAchievements: 0,
    totalAchievements: 0,
    achievementProgress: 0,
    activeTab: "endings" as "endings" | "achievements",
  },

  lifetimes: {
    attached() {
      this.refreshAll();
    },
  },

  methods: {
    /** 全量刷新：一次读取 + 一次计算 + 一次 setData */
    refreshAll() {
      const endings = storage.readEndings();
      const scenes = this.buildScenes(endings);
      const progress = Math.round((endings.length / this.data.totalEndings) * 100);

      const unlockedIds = storage.readAchievements();
      const unlockedSet = new Set(unlockedIds);
      const achievements: AchievementView[] = this.buildAchievementDefs(endings.length).map((a) => ({
        id: a.id,
        title: a.title,
        desc: a.desc,
        icon: a.icon,
        unlocked: unlockedSet.has(a.id) || a.check(),
      }));
      const collected = achievements.filter((a) => a.unlocked).length;
      const newUnlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
      if (newUnlocked.length > unlockedIds.length) {
        storage.writeAchievements(newUnlocked);
        void syncAchievements(newUnlocked);
      }

      this.setData({
        endings,
        scenes,
        collectedEndings: endings.length,
        progress,
        achievements,
        collectedAchievements: collected,
        totalAchievements: achievements.length,
        achievementProgress: achievements.length
          ? Math.round((collected / achievements.length) * 100)
          : 0,
      });
    },

    buildScenes(endings: EndingRecord[]): SceneView[] {
      const app = getApp<IAppOption>();
      (app.globalData as Record<string, unknown>).scenes = SCENE_DEFS;
      return SCENE_DEFS.map((scene) => {
        const sceneEndings = endings.filter((e) => e.sceneId === scene.id);
        const endingsList = Object.entries(scene.endings).map(([key, ending]) => ({
          key,
          text: ending.text,
          collected: sceneEndings.some((e) => e.endingKey === key),
        }));
        return {
          id: scene.id,
          title: scene.title,
          subtitle: scene.subtitle,
          icon: scene.icon,
          shortLabel: scene.shortLabel,
          endingsList,
          hasAllEndings: sceneEndings.length === endingsList.length,
          collectedCount: sceneEndings.length,
        };
      });
    },

    buildAchievementDefs(endingsCount: number): AchievementDef[] {
      const role = getCurrentRole();
      return [
        { id: "first_step", title: "初入仙途", desc: "踏入修仙世界，获得升仙令", icon: "🌟",
          check: () => !!role && role.currentNode !== null && role.currentNode !== "node_1" },
        { id: "foundation", title: "筑基有成", desc: "成功突破到筑基期", icon: "🏔️",
          check: () => !!role && role.level.level >= 1 },
        { id: "golden_core", title: "金丹大成", desc: "成功突破到金丹期", icon: "💎",
          check: () => !!role && role.level.level >= 2 },
        { id: "age_10", title: "十年修仙", desc: "道历达到10年", icon: "⏳",
          check: () => !!role && role.age >= 10 },
        { id: "age_20", title: "廿载苦修", desc: "道历达到20年", icon: "🕐",
          check: () => !!role && role.age >= 20 },
        { id: "potential_50", title: "天赋异禀", desc: "潜力达到50以上", icon: "✨",
          check: () => !!role && role.attributes.potential.val >= 50 },
        { id: "wit_30", title: "慧根深种", desc: "悟性达到30以上", icon: "🧠",
          check: () => !!role && role.attributes.wit.val >= 30 },
        { id: "chance_30", title: "天命之子", desc: "机缘达到30以上", icon: "🍀",
          check: () => !!role && role.attributes.chance.val >= 30 },
        { id: "goodness_60", title: "心善如水", desc: "善恶值达到60以上", icon: "🙏",
          check: () => !!role && role.attributes.goodness.val >= 60 },
        { id: "evil_path", title: "亦正亦邪", desc: "善恶值低于20", icon: "😈",
          check: () => !!role && role.attributes.goodness.val < 20 },
        { id: "element_gold", title: "金灵初醒", desc: "金属性达到中级", icon: "⚔️",
          check: () => !!role && role.elements.gold.level >= 1 },
        { id: "element_water", title: "水灵初醒", desc: "水属性达到中级", icon: "💧",
          check: () => !!role && role.elements.water.level >= 1 },
        { id: "collector_5", title: "结局收集者", desc: "收集5个结局", icon: "📚",
          check: () => endingsCount >= 5 },
        { id: "collector_all", title: "全结局大师", desc: "收集全部结局", icon: "👑",
          check: () => endingsCount >= this.data.totalEndings },
      ];
    },

    /** 收集新结局：一次 setData 同步结局/场景/进度，不重复刷新成就列表 */
    addEnding(sceneId: string, endingKey: string) {
      const endings = storage.readEndings();
      if (endings.some((e) => e.sceneId === sceneId && e.endingKey === endingKey)) return;
      const next: EndingRecord[] = [...endings, { sceneId, endingKey }];
      storage.writeEndings(next);
      this.setData({
        endings: next,
        scenes: this.buildScenes(next),
        collectedEndings: next.length,
        progress: Math.round((next.length / this.data.totalEndings) * 100),
      });
      void syncEndings(next);
    },

    /** 兼容旧方法名（内部已统一由 refreshAll 承担） */
    loadEndings() { this.refreshAll(); },
    initScenes() { this.refreshAll(); },
    initAchievements() { this.refreshAll(); },
    updateProgress() { /* 由 refreshAll 统一计算 */ },

    showEndingModal() {
      this.setData({ showModal: true, activeTab: "endings" });
    },
    hideEndingModal() {
      this.setData({ showModal: false });
    },
    preventClose() {},
    switchTab(e: WechatMiniprogram.TouchEvent) {
      const tab = e.currentTarget.dataset.tab as "endings" | "achievements";
      this.setData({ activeTab: tab });
    },
  },
});

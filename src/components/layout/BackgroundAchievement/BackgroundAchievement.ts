
import { syncAchievementsToCloud, syncEndingsToCloud } from "../../../api/cloudSync";


/** 成就定义 */
interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** 检查是否已达成 */
  check: () => boolean;
}

Component({
  data: {
    isMuted: false,
    showModal: false,
    /** 结局收集 */
    scenes: [] as AppUI.SceneItem[],
    endings: [] as { sceneId: string; endingKey: string }[],
    collectedEndings: 0,
    totalEndings: 20,
    progress: 0,
    /** 成就系统 */
    achievements: [] as AchievementDef[],
    collectedAchievements: 0,
    totalAchievements: 0,
    /** tab 切换：endings / achievements */
    activeTab: "endings" as "endings" | "achievements",
  },
  lifetimes: {
    attached() {
      this.loadEndings();
      this.initScenes();
      this.initAchievements();
    },
    detached(){
      // 组件销毁时同步成就和结局到云端
      if (this.data.endings.length > 0) {
        syncEndingsToCloud(this.data.endings);
      }
      if (this.data.achievements.length > 0) {
        const unlockedIds = this.data.achievements
          .filter((a: AchievementDef & { unlocked?: boolean }) => a.unlocked)
          .map((a: AchievementDef) => a.id);
        if (unlockedIds.length > 0) {
          syncAchievementsToCloud(unlockedIds);
        }
      }
    }
  },
  methods: {
    // ==================== 结局收集 ====================

    loadEndings() {
      const endings = wx.getStorageSync("endings") || [];
      this.setData({ endings });
      this.updateProgress();
    },

    initScenes() {
      // 场景数据（简化版，完整数据从配置文件导入）
      const scenesData = [
        {
          id: "cultivation-start",
          title: "修仙启程",
          subtitle: "踏上仙途",
          icon: "⛰️",
          shortLabel: "升仙令在手，仙路从此开...",
          endings: {
            "C1-A2": { text: "拜入山门", emotion: "仙缘初启" },
            "C1-B2": { text: "错失机缘", emotion: "遗憾离场" },
          },
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
          },
        },
        // ... 其他场景
      ];

      // ⚠️ 将场景数据同步到 globalData，供 story/ending 页面使用
      const app = getApp<IAppOption>();
      (app.globalData as Record<string, unknown>).scenes = scenesData;

      const scenes = scenesData.map((scene) => {
        const sceneEndings = this.data.endings.filter(
          (e) => e.sceneId === scene.id
        );
        const endingsList = Object.entries(scene.endings).map(
          ([key, ending]) => ({
            key,
            text: ending ? ending.text : "" ,
            collected: sceneEndings.some((e) => e.endingKey === key),
          })
        );

        return {
          ...scene,
          hasAllEndings: sceneEndings.length === Object.keys(scene.endings).length,
          collectedCount: sceneEndings.length,
          endingsList,
        };
      });

      this.setData({ scenes });
    },

    updateProgress() {
      const collected = this.data.endings.length;
      const progress = Math.round((collected / this.data.totalEndings) * 100);
      this.setData({
        collectedEndings: collected,
        progress,
      });
    },

    // ==================== 成就系统 ====================

    initAchievements() {
      const app = getApp<IAppOption>();
      const role = app.globalData.userInfo.gameData.currentRole;

      const allAchievements: AchievementDef[] = [
        {
          id: "first_step",
          title: "初入仙途",
          desc: "踏入修仙世界，获得升仙令",
          icon: "🌟",
          check: () => !!role && role.currentNode !== null && role.currentNode !== "node_1",
        },
        {
          id: "foundation",
          title: "筑基有成",
          desc: "成功突破到筑基期",
          icon: "🏔️",
          check: () => !!role && role.level.level >= 1,
        },
        {
          id: "golden_core",
          title: "金丹大成",
          desc: "成功突破到金丹期",
          icon: "💎",
          check: () => !!role && role.level.level >= 2,
        },
        {
          id: "age_10",
          title: "十年修仙",
          desc: "道历达到10年",
          icon: "⏳",
          check: () => !!role && role.age >= 10,
        },
        {
          id: "age_20",
          title: "廿载苦修",
          desc: "道历达到20年",
          icon: "🕐",
          check: () => !!role && role.age >= 20,
        },
        {
          id: "potential_50",
          title: "天赋异禀",
          desc: "潜力达到50以上",
          icon: "✨",
          check: () => !!role && role.attributes.potential.val >= 50,
        },
        {
          id: "wit_30",
          title: "慧根深种",
          desc: "悟性达到30以上",
          icon: "🧠",
          check: () => !!role && role.attributes.wit.val >= 30,
        },
        {
          id: "chance_30",
          title: "天命之子",
          desc: "机缘达到30以上",
          icon: "🍀",
          check: () => !!role && role.attributes.chance.val >= 30,
        },
        {
          id: "goodness_60",
          title: "心善如水",
          desc: "善恶值达到60以上",
          icon: "🙏",
          check: () => !!role && role.attributes.goodness.val >= 60,
        },
        {
          id: "evil_path",
          title: "亦正亦邪",
          desc: "善恶值低于20",
          icon: "😈",
          check: () => !!role && role.attributes.goodness.val < 20,
        },
        {
          id: "element_gold",
          title: "金灵初醒",
          desc: "金属性达到中级",
          icon: "⚔️",
          check: () => !!role && role.elements.gold.level >= 1,
        },
        {
          id: "element_water",
          title: "水灵初醒",
          desc: "水属性达到中级",
          icon: "💧",
          check: () => !!role && role.elements.water.level >= 1,
        },
        {
          id: "collector_5",
          title: "结局收集者",
          desc: "收集5个结局",
          icon: "📚",
          check: () => this.data.endings.length >= 5,
        },
        {
          id: "collector_all",
          title: "全结局大师",
          desc: "收集全部结局",
          icon: "👑",
          check: () => this.data.endings.length >= this.data.totalEndings,
        },
      ];

      // 读取已解锁成就
      const unlockedIds: string[] = wx.getStorageSync("achievements") || [];

      const achievements = allAchievements.map((a) => {
        const unlocked = unlockedIds.includes(a.id) || a.check();
        return { ...a, unlocked };
      });

      // 保存新解锁的成就
      const newUnlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
      if (newUnlocked.length > unlockedIds.length) {
        wx.setStorageSync("achievements", newUnlocked);
      }

      const collectedAchievements = achievements.filter((a) => a.unlocked).length;
      this.setData({
        achievements,
        collectedAchievements,
        totalAchievements: achievements.length,
      });
    },

    // ==================== UI 交互 ====================

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
    }
  }
});

import { getRandomInitialTraits, traits, rolesInfo } from "../../../config";
import { showNotification } from "../../../events/notifyEvents";

/** 词条展示数据 */
interface TalentDisplay {
  id: string;
  name: string;
  desc: string;
  level: AppGame.TraitsItem["level"];
  rewardAttrs: { label: string; value: number }[];
  punishAttrs: { label: string; value: number }[];
  rewardElements: { label: string; value: number }[];
  punishElements: { label: string; value: number }[];
  hasEffect: boolean;
  selected: boolean;
}

/** 属性中文映射 */
const ATTR_NAME_MAP: Record<string, string> = {
  potential: "潜力", root: "根骨", wit: "悟性", chance: "机缘", goodness: "善恶",
};

/** 元素中文映射 */
const ELEMENT_NAME_MAP: Record<string, string> = {
  gold: "金", wood: "木", water: "水", fire: "火", earth: "土",
};

/** 元素等级名称 */
const ELEMENT_LEVEL_NAMES: AppGame.ElementAttrLevelNameType[] = ["初级", "中级", "高级", "至尊"];

/** 将 TraitsItem 转为展示用的 TalentDisplay */
function toTalentDisplay(trait: AppGame.TraitsItem): TalentDisplay {
  const rewardAttrs: { label: string; value: number }[] = [];
  const punishAttrs: { label: string; value: number }[] = [];
  const rewardElements: { label: string; value: number }[] = [];
  const punishElements: { label: string; value: number }[] = [];

  if (trait.attrs) {
    if (trait.attrs.reward) {
      for (const item of trait.attrs.reward) {
        rewardAttrs.push({ label: ATTR_NAME_MAP[item.type] || item.type, value: item.value });
      }
    }
    if (trait.attrs.punish) {
      for (const item of trait.attrs.punish) {
        punishAttrs.push({ label: ATTR_NAME_MAP[item.type] || item.type, value: item.value });
      }
    }
  }
  if (trait.elements) {
    if (trait.elements.reward) {
      const item = trait.elements.reward as { type: string; value: number };
      if (item && item.type) {
        rewardElements.push({ label: ELEMENT_NAME_MAP[item.type] || item.type, value: item.value });
      }
    }
    if (trait.elements.punish) {
      const item = trait.elements.punish as { type: string; value: number };
      if (item && item.type) {
        punishElements.push({ label: ELEMENT_NAME_MAP[item.type] || item.type, value: item.value });
      }
    }
  }
  const hasEffect =
    rewardAttrs.length > 0 || punishAttrs.length > 0 ||
    rewardElements.length > 0 || punishElements.length > 0;

  return {
    id: trait.id, name: trait.name, desc: trait.desc, level: trait.level,
    rewardAttrs, punishAttrs, rewardElements, punishElements,
    hasEffect, selected: false,
  };
}

/** 应用词条到属性和元素（不修改原对象） */
function applyTraitToStats(
  attrs: AppGame.RoleAttributes,
  elements: AppGame.Elements,
  trait: AppGame.TraitsItem,
): { attrs: AppGame.RoleAttributes; elements: AppGame.Elements } {
  const newAttrs = JSON.parse(JSON.stringify(attrs)) as AppGame.RoleAttributes;
  const newElements = JSON.parse(JSON.stringify(elements)) as AppGame.Elements;

  if (trait.attrs) {
    const sigKeys = Object.keys(trait.attrs) as AppGame.KeyType[];
    for (const k of sigKeys) {
      const list = trait.attrs[k];
      if (!list) continue;
      const sign = k === "reward" ? 1 : -1;
      for (const item of list) {
        const target = newAttrs[item.type];
        if (target) target.val += sign * item.value;
      }
    }
  }
  if (trait.elements) {
    for (const k of Object.keys(trait.elements) as AppGame.KeyType[]) {
      const el = trait.elements[k] as { type: AppGame.ElementAttrIdType; value: number } | undefined;
      if (!el || !newElements[el.type]) continue;
      const sign = k === "reward" ? 1 : -1;
      const newLv = Math.max(0, Math.min(3, newElements[el.type].level + sign * el.value)) as AppGame.ElementAttrLevelType;
      newElements[el.type].level = newLv;
      newElements[el.type].leveName = ELEMENT_LEVEL_NAMES[newLv];
    }
  }
  return { attrs: newAttrs, elements: newElements };
}

Page({
  data: {
    gender: "girl" as AppGame.GenderType,
    name: "",
    talents: [] as TalentDisplay[],
    selectedCount: 0,
    isConfirming: false,
  },

  onLoad(options: { gender?: AppGame.GenderType }) {
    const gender: AppGame.GenderType = options.gender || "girl";
    const nameList = rolesInfo.randomNames[gender];
    const randomName = nameList
      ? nameList[Math.floor(Math.random() * nameList.length)]
      : "无名";

    // 随机选取 5 个非剧情词条
    const rawTraits = getRandomInitialTraits(5);
    const talents = rawTraits.map(toTalentDisplay);

    this.setData({ gender, name: randomName, talents });
  },

  /** 点击词条 — 最多选一项，选中新的自动取消旧的 */
  onTalentTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const talents = this.data.talents.map((t) =>
      t.id === id ? { ...t, selected: !t.selected } : { ...t, selected: false },
    );
    const selectedCount = talents.filter((t) => t.selected).length;
    this.setData({ talents, selectedCount });
  },

  /** 确认选择 */
  onConfirm() {
    if (this.data.isConfirming) return;
    const selected = this.data.talents.filter((t) => t.selected);
    if (selected.length === 0) {
      showNotification({ message: "请至少选择一项天赋", levelType: "warning" });
      return;
    }

    this.setData({ isConfirming: true });

    const app = getApp<IAppOption>();
    const role = app.globalData.userInfo.gameData.currentRole;
    if (!role) {
      this.setData({ isConfirming: false });
      return;
    }

    // 从 traits 池中匹配选中的完整 TraitsItem
    const selectedTraits: AppGame.TraitsItem[] = [];
    for (const t of selected) {
      const match = (Object.values(traits) as AppGame.TraitsItem[]).find((item) => item.id === t.id);
      if (match) selectedTraits.push(match);
    }

    // 应用词条效果到角色属性
    let { attributes, elements } = role;
    for (const trait of selectedTraits) {
      const result = applyTraitToStats(attributes, elements, trait);
      attributes = result.attrs;
      elements = result.elements;
    }

    // 更新全局角色数据
    role.traits = selectedTraits;
    role.attributes = attributes;
    role.elements = elements;
    role.name = this.data.name;
    role.gender = this.data.gender;
    app.globalData.userInfo.gameData.gameAction = "new";

    // 跳转到故事页
    wx.redirectTo({
      url: `/packageGame/pages/story/story?gender=${this.data.gender}`,
    });
  },
});

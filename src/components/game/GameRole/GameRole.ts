import { defaultGameData, getRandomName, paths } from "@src/config";
import { saveCurrentState } from "@src/services/repository";
import {
  onAgeChanged, onArtsChanged, onLevelChanged,
  offAgeChanged, offLevelChanged, offArtsChanged, emitNodeChanged,
  onTraitsChanged, offTraitsChanged
} from "@src/events/roleEvents";

/** 弹窗内显示的影响项 */
interface TraitEffectItem {
  label: string;
  value: number;
  sign: '+' | '-';
}

/** 词条弹窗展示数据 */
interface TraitPopupData {
  id: string;
  name: string;
  desc: string;
  level: AppGame.TraitsItem['level'];
  rewardAttrs: TraitEffectItem[];
  punishAttrs: TraitEffectItem[];
  rewardElements: TraitEffectItem[];
  punishElements: TraitEffectItem[];
  hasEffect: boolean;
}

const ATTR_NAME_MAP: Record<string, string> = {
  potential: '潜力', root: '根骨', wit: '悟性', chance: '机缘', goodness: '善恶',
};
const ELEMENT_NAME_MAP: Record<string, string> = {
  gold: '金', wood: '木', water: '水', fire: '火', earth: '土',
};
const ELEMENT_LEVEL_NAMES: AppGame.ElementAttrLevelNameType[] = ['初级', '中级', '高级', '至尊'];

/** 构建弹窗展示数据 */
function buildTraitPopup(trait: AppGame.TraitsItem): TraitPopupData {
  const rewardAttrs: TraitEffectItem[] = [];
  const punishAttrs: TraitEffectItem[] = [];
  const rewardElements: TraitEffectItem[] = [];
  const punishElements: TraitEffectItem[] = [];

  if (trait.attrs) {
    if (trait.attrs.reward) {
      for (const item of trait.attrs.reward) {
        rewardAttrs.push({ label: ATTR_NAME_MAP[item.type] || item.type, value: item.value, sign: '+' });
      }
    }
    if (trait.attrs.punish) {
      for (const item of trait.attrs.punish) {
        punishAttrs.push({ label: ATTR_NAME_MAP[item.type] || item.type, value: item.value, sign: '-' });
      }
    }
  }
  if (trait.elements) {
    if (trait.elements.reward) {
      const item = trait.elements.reward as { type: string; value: number };
      if (item && item.type) {
        rewardElements.push({ label: ELEMENT_NAME_MAP[item.type] || item.type, value: item.value, sign: '+' });
      }
    }
    if (trait.elements.punish) {
      const item = trait.elements.punish as { type: string; value: number };
      if (item && item.type) {
        punishElements.push({ label: ELEMENT_NAME_MAP[item.type] || item.type, value: item.value, sign: '-' });
      }
    }
  }
  const hasEffect = rewardAttrs.length > 0 || punishAttrs.length > 0
    || rewardElements.length > 0 || punishElements.length > 0;
  return {
    id: trait.id, name: trait.name, desc: trait.desc, level: trait.level,
    rewardAttrs, punishAttrs, rewardElements, punishElements, hasEffect,
  };
}

/** 逐字段浅拷贝，替代 JSON 全量序列化 + 反序列化的双重开销 */
function cloneAttributes(src: AppGame.RoleAttributes): AppGame.RoleAttributes {
  const out = {} as Record<string, any>;
  for (const key of Object.keys(src)) out[key] = { ...(src as any)[key] };
  return out as unknown as AppGame.RoleAttributes;
}
function cloneElements(src: AppGame.Elements): AppGame.Elements {
  const out = {} as Record<string, any>;
  for (const key of Object.keys(src)) out[key] = { ...(src as any)[key] };
  return out as unknown as AppGame.Elements;
}

/**
 * UI 性能约定（见 优化.md §3.2）
 * - 4 个模块级回调引用改为组件实例字段：多实例不串扰，detached 精确解绑
 * - avatarMap / _unlockedTraitIds 等纯逻辑字段移出 data，不再随 setData 传输
 * - Set 去重替代 prevIds.includes / merged.some 的 O(n²) 查表
 * - 挂载、词条变更、展开切换各合并为一次 setData
 */
Component({
  properties: {
    gender: { type: String, value: defaultGameData.currentRole?.gender as AppGame.GenderType },
    attributes: { type: Object, value: defaultGameData.currentRole?.attributes as AppGame.RoleAttributes },
    level: { type: Object, value: defaultGameData.currentRole?.level as AppGame.Level },
    elements: { type: Object, value: defaultGameData.currentRole?.elements as AppGame.Elements },
    name: { type: String, value: "" },
    age: { type: Number, value: 1 },
    traits: { type: Array, value: [] as AppGame.TraitsItem[] },
  },
  lifetimes: {
    attached() {
      const self = this as any;
      const h = (self._handlers = {} as Record<string, any>);
      const app = getApp<IAppOption>();
      const genderKey = this.properties.gender ||
        (defaultGameData.currentRole?.gender as AppGame.GenderType);
      const name = this.properties.name || getRandomName(genderKey as AppGame.GenderType);
      const avatar = paths.avatars[genderKey as AppGame.GenderType];
      const savedTraits = (this.properties.traits && this.properties.traits.length > 0)
        ? this.properties.traits
        : (app.globalData.userInfo.gameData.currentRole?.traits || []);

      self._unlockedTraitIds = new Set<string>((savedTraits as AppGame.TraitsItem[]).map(t => t.id));
      // 一次 setData 完成挂载渲染（原实现挂载后还会再 _refreshTraits 一次）
      this.setData({
        name,
        avatar,
        allTraits: savedTraits as AppGame.TraitsItem[],
        displayTraits: this._visibleTraits(savedTraits as AppGame.TraitsItem[], false),
      });

      h.onAgeChanged = (age: number) => { this.setData({ age }); };
      onAgeChanged(h.onAgeChanged);

      h.onLevelChanged = (level: AppGame.Level) => { this.setData({ level }); };
      onLevelChanged(h.onLevelChanged);

      h.onArtsChanged = (arts: AppGame.PlotAttrs) => {
        const updated = cloneAttributes(this.data.attributes);
        const keys = Object.keys(arts) as (keyof AppGame.PlotAttrs)[];
        keys.forEach((el) => {
          const items = arts[el];
          if (!items) return;
          const sign = el === 'reward' ? 1 : -1;
          items.forEach(item => {
            const target = (updated as any)[item.type];
            if (target) target.val += sign * item.value;
          });
        });
        this.setData({ attributes: updated });
      };
      onArtsChanged(h.onArtsChanged);

      h.onTraitsChanged = (incoming: AppGame.TraitsItem[]) => {
        const { allTraits, showAllTraits, attributes, elements } = this.data;
        const oldIds = new Set<string>(self._unlockedTraitIds as Set<string>);
        const merged = this._mergeTraits(allTraits, incoming);
        const novelTraits = incoming.filter(t => !oldIds.has(t.id));
        if (novelTraits.length === 0) {
          this.setData({ allTraits: merged, displayTraits: this._visibleTraits(merged, showAllTraits) });
          return;
        }
        const updatedAttrs = cloneAttributes(attributes);
        const updatedElements = cloneElements(elements);
        for (const trait of novelTraits) {
          if (trait.attrs) {
            const sigKeys = Object.keys(trait.attrs) as AppGame.KeyType[];
            for (const k of sigKeys) {
              const list = trait.attrs[k];
              if (!list) continue;
              const sign = k === 'reward' ? 1 : -1;
              for (const item of list) {
                const target = (updatedAttrs as any)[item.type];
                if (target) target.val += sign * item.value;
              }
            }
          }
          if (trait.elements) {
            const sigKeys = Object.keys(trait.elements) as AppGame.KeyType[];
            for (const k of sigKeys) {
              const el = trait.elements[k] as { type: AppGame.ElementAttrIdType; value: number } | undefined;
              if (!el || !(updatedElements as any)[el.type]) continue;
              const sign = k === 'reward' ? 1 : -1;
              const newLv = Math.max(0, Math.min(3, (updatedElements as any)[el.type].level + sign * el.value));
              (updatedElements as any)[el.type].level = newLv as AppGame.ElementAttrLevelType;
              (updatedElements as any)[el.type].leveName = ELEMENT_LEVEL_NAMES[newLv];
            }
          }
        }
        // 一次 setData 更新全部受影响字段
        this.setData({
          allTraits: merged,
          displayTraits: this._visibleTraits(merged, showAllTraits),
          attributes: updatedAttrs,
          elements: updatedElements,
        });
      };
      onTraitsChanged(h.onTraitsChanged);
    },
    detached() {
      const self = this as any;
      const h = (self._handlers || {}) as Record<string, any>;
      const app = getApp<IAppOption>();
      if (app.globalData.userInfo.gameData.currentRole) {
        const r = app.globalData.userInfo.gameData.currentRole;
        r.gender = this.properties.gender as AppGame.GenderType;
        r.name = this.data.name;
        r.avatar = this.data.avatar;
        r.elements = this.data.elements;
        r.level = this.data.level as AppGame.Level;
        r.attributes = this.data.attributes;
        r.age = this.data.age;
        r.traits = this.data.allTraits;
      }
      if (h.onAgeChanged) offAgeChanged(h.onAgeChanged);
      if (h.onArtsChanged) offArtsChanged(h.onArtsChanged);
      if (h.onLevelChanged) offLevelChanged(h.onLevelChanged);
      if (h.onTraitsChanged) offTraitsChanged(h.onTraitsChanged);
      self._handlers = null;
      self._unlockedTraitIds = null;
    },
  },
  data: {
    name: "",
    avatar: "",
    elementMap: paths.elements,
    allTraits: [] as AppGame.TraitsItem[],
    displayTraits: [] as AppGame.TraitsItem[],
    showAllTraits: false,
    // WXML 使用 maxCollapsedTraits 与 elementMap，保留在 data
    maxCollapsedTraits: 5,
    showTraitPopup: false,
    popupTrait: null as TraitPopupData | null,
  },
  methods: {
    /** 纯函数：根据展开状态计算展示列表，不触发 setData */
    _visibleTraits(list: AppGame.TraitsItem[], expanded: boolean): AppGame.TraitsItem[] {
      return expanded ? list : (list || []).slice(0, this.data.maxCollapsedTraits);
    },

    /** 兼容旧方法名 */
    _syncDisplayTraits() {
      this.setData({ displayTraits: this._visibleTraits(this.data.allTraits, this.data.showAllTraits) });
    },
    _refreshTraits() {
      this.setData({ displayTraits: this._visibleTraits(this.data.allTraits, this.data.showAllTraits) });
    },

    /** 切换词条展开/收起：一次 setData */
    onToggleTraits() {
      const next = !this.data.showAllTraits;
      this.setData({
        showAllTraits: next,
        displayTraits: this._visibleTraits(this.data.allTraits, next),
      });
    },

    /** 合并已有词条和新词条，去重（Set），不再内部 setData */
    _mergeTraits(existing: AppGame.TraitsItem[], incoming: AppGame.TraitsItem[]): AppGame.TraitsItem[] {
      const self = this as any;
      const ids: Set<string> = (self._unlockedTraitIds as Set<string>) || new Set<string>();
      const known = new Set<string>(existing.map(t => t.id));
      const merged: AppGame.TraitsItem[] = [...existing];
      for (const item of incoming) {
        if (!known.has(item.id)) {
          merged.push(item);
          known.add(item.id);
          ids.add(item.id);
        }
      }
      self._unlockedTraitIds = ids;
      return merged;
    },

    /** 点击词条，弹窗展示详情 */
    onTraitTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const trait = this.data.allTraits.find((t) => t.id === id);
      if (!trait) return;
      this.setData({ showTraitPopup: true, popupTrait: buildTraitPopup(trait) });
    },

    /** 关闭词条弹窗 */
    onClosePopup() {
      this.setData({ showTraitPopup: false, popupTrait: null });
    },

    /** 阻止弹窗内容区冒泡 */
    noop() {},

    saveGlob() {
      const app = getApp<IAppOption>();
      if (app.globalData.userInfo.gameData.currentRole) {
        const r = app.globalData.userInfo.gameData.currentRole;
        r.avatar = this.data.avatar;
        r.name = this.data.name;
        r.age = this.data.age;
        r.level = this.data.level as AppGame.Level;
        r.attributes = this.data.attributes;
        r.elements = this.data.elements;
        r.traits = this.data.allTraits;
        emitNodeChanged();
      }
      this._syncGameToCloud();
    },
    /** 统一走数据门面：由 services/repository 构造带版本号的干净快照 */
    _syncGameToCloud() {
      void saveCurrentState();
    },
    goToSave() {
      wx.navigateTo({ url: "/pages/save/save" });
    },
    onSave() {
      const app = getApp<IAppOption>();
      app.globalData.userInfo.gameData.gameAction = "save";
      this.saveGlob();
      this.goToSave();
    },
    onLoad() {
      const app = getApp<IAppOption>();
      app.globalData.userInfo.gameData.gameAction = "load";
      this.saveGlob();
      this.goToSave();
    },
  },
});

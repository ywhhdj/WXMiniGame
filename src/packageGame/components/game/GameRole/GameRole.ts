import { defaultGameData, getRandomName, paths } from "../../../../config";
import { saveGameDataToCloud } from "../../../../api/cloudSync";
import { 
  onAgeChanged,onArtsChanged,onLevelChanged,offAgeChanged,offLevelChanged,offArtsChanged,emitNodeChanged,
  onTraitsChanged,offTraitsChanged 
} from "../../../../events/roleEvents";
let _onAgeChanged: ((age: number) => void) | null = null;
let _onArtsChanged: ((arts: AppGame.PlotAttrs) => void) | null = null;
let _onLevelChanged: ((level: AppGame.Level) => void) | null = null;
let _onTraitsChanged: ((traits: AppGame.TraitsItem[]) => void) | null = null;

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

/** 七彩名称映射 */
const ATTR_NAME_MAP: Record<string, string> = {
  potential: '潜力', root: '根骨', wit: '悟性', chance: '机缘', goodness: '善恶',
};
const ELEMENT_NAME_MAP: Record<string, string> = {
  gold: '金', wood: '木', water: '水', fire: '火', earth: '土',
};

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
    id: trait.id,
    name: trait.name,
    desc: trait.desc,
    level: trait.level,
    rewardAttrs,
    punishAttrs,
    rewardElements,
    punishElements,
    hasEffect,
  };
}

/** 元素等级 → 名称 */
const ELEMENT_LEVEL_NAMES: AppGame.ElementAttrLevelNameType[] = ['初级', '中级', '高级', '至尊'];

Component({
  properties: {
    gender: {
      type: String,
      value: defaultGameData.currentRole?.gender as AppGame.GenderType,
    },
    attributes: {
      type: Object,
      value: defaultGameData.currentRole?.attributes as AppGame.RoleAttributes,
    },
    level: {
      type: Object,
      value: defaultGameData.currentRole?.level as AppGame.Level,
    },
    elements: {
      type: Object,
      value: defaultGameData.currentRole?.elements as AppGame.Elements,
    },
    name: {
      type: String,
      value: "",
    },
    age: {
      type: Number,
      value: 1,
    },
    traits: {
      type: Array,
      value: [] as AppGame.TraitsItem[],
    },
  },
  lifetimes: {
    attached() {
      const app = getApp<IAppOption>();
      const genderKey = this.properties.gender ||
      (defaultGameData.currentRole?.gender as AppGame.GenderType);
      let name = "";
      if (this.properties.name) {
        name = this.properties.name;
      } else {
        name=getRandomName(genderKey);
      }
      const avatar = this.data.avatarMap[genderKey];
      // 从属性或全局数据恢复词条
      const savedTraits = (this.properties.traits && this.properties.traits.length > 0)
        ? this.properties.traits
        : (app.globalData.userInfo.gameData.currentRole?.traits || []);
      this.setData({
        name,
        avatar,
        allTraits: savedTraits as AppGame.TraitsItem[],
        _unlockedTraitIds: (savedTraits as AppGame.TraitsItem[]).map(t => t.id),
      });
      _onAgeChanged=(age:number)=>{
        this.setData({ age });
      }
      onAgeChanged(_onAgeChanged);
      _onLevelChanged=(level:AppGame.Level)=>{
        this.setData({ level });
      }
      onLevelChanged(_onLevelChanged);
      _onArtsChanged=(arts:AppGame.PlotAttrs)=>{
        const updated = { ...this.data.attributes };
        const keys=Object.keys(arts) as (keyof AppGame.PlotAttrs)[];
        keys.forEach((el)=>{
            const items = arts[el];
            if (!items) return;
            const sign = el === 'reward' ? 1 : -1;
            items.forEach(item=>{
                const target = updated[item.type];
                if (target) {
                    target.val += sign * item.value;
                }
            });
        });
        this.setData({ attributes: updated });
      }
      onArtsChanged(_onArtsChanged);
      _onTraitsChanged=(incoming:AppGame.TraitsItem[])=>{
        const { allTraits, _unlockedTraitIds, attributes, elements } = this.data;
        // 记录旧 ID 集合，用于过滤新增词条（必须在 _mergeTraits 前捕获）
        const oldIds = new Set(_unlockedTraitIds);
        // 去重合并（内部会 setData 更新 _unlockedTraitIds）
        const merged = this._mergeTraits(allTraits, incoming, _unlockedTraitIds);
        // 只对新增词条应用效果
        const novelTraits = incoming.filter(t => !oldIds.has(t.id));
        if (novelTraits.length === 0) {
            this.setData({ allTraits: merged });
            this._refreshTraits();
            return;
        }
        // 深拷贝 attributes 和 elements
        const updatedAttrs = JSON.parse(JSON.stringify(attributes)) as AppGame.RoleAttributes;
        const updatedElements = JSON.parse(JSON.stringify(elements)) as AppGame.Elements;
        for (const trait of novelTraits) {
            // 属性变化
            if (trait.attrs) {
                const sigKeys = Object.keys(trait.attrs) as AppGame.KeyType[];
                for (const k of sigKeys) {
                    const list = trait.attrs[k];
                    if (!list) continue;
                    const sign = k === 'reward' ? 1 : -1;
                    for (const item of list) {
                        const target = updatedAttrs[item.type];
                        if (target) target.val += sign * item.value;
                    }
                }
            }
            // 元素变化
            if (trait.elements) {
                const sigKeys = Object.keys(trait.elements) as AppGame.KeyType[];
                for (const k of sigKeys) {
                    const el = trait.elements[k] as { type: AppGame.ElementAttrIdType; value: number } | undefined;
                    if (!el || !updatedElements[el.type]) continue;
                    const sign = k === 'reward' ? 1 : -1;
                    const newLv = Math.max(0, Math.min(3, updatedElements[el.type].level + sign * el.value));
                    updatedElements[el.type].level = newLv as AppGame.ElementAttrLevelType;
                    updatedElements[el.type].leveName = ELEMENT_LEVEL_NAMES[newLv];
                }
            }
        }
        this.setData({
            allTraits: merged,
            attributes: updatedAttrs,
            elements: updatedElements,
        });
        this._refreshTraits();
      }
      onTraitsChanged(_onTraitsChanged);
      this._refreshTraits();
    },
    detached() {
      const app = getApp<IAppOption>();
      if (app.globalData.userInfo.gameData.currentRole) {
        app.globalData.userInfo.gameData.currentRole.gender = this.properties.gender;
        app.globalData.userInfo.gameData.currentRole.name = this.data.name;
        app.globalData.userInfo.gameData.currentRole.avatar = this.data.avatar;
        app.globalData.userInfo.gameData.currentRole.elements = this.data.elements;
        app.globalData.userInfo.gameData.currentRole.level = this.data.level;
        app.globalData.userInfo.gameData.currentRole.attributes = this.data.attributes;
        app.globalData.userInfo.gameData.currentRole.age = this.data.age;
        app.globalData.userInfo.gameData.currentRole.traits = this.data.allTraits;
      }
      //清理
      if (_onAgeChanged) {
        offAgeChanged(_onAgeChanged);
        _onAgeChanged = null;
      }
      if (_onArtsChanged) {
        offArtsChanged(_onArtsChanged);
        _onArtsChanged = null;
      }
      if (_onLevelChanged) {
        offLevelChanged(_onLevelChanged);
        _onLevelChanged = null;
      }
      if (_onTraitsChanged) {
        offTraitsChanged(_onTraitsChanged);
        _onTraitsChanged = null;
      }
    },
  },
  data: {
    name: "",
    avatar: "",
    avatarMap: paths.avatars,
    elementMap: paths.elements,
    // 词条数据（平铺数组）
    allTraits: [] as AppGame.TraitsItem[],
    displayTraits: [] as AppGame.TraitsItem[],
    showAllTraits: false,
    _unlockedTraitIds: [] as string[],
    /** 收起状态最多展示的词条数 */
    maxCollapsedTraits: 5,
    // 弹窗
    showTraitPopup: false,
    popupTrait: null as TraitPopupData | null,
  },
  methods: {
    /** 同步 displayTraits：根据当前展开状态截取 */
    _syncDisplayTraits() {
      const { showAllTraits, allTraits, maxCollapsedTraits } = this.data;
      this.setData({
        displayTraits: showAllTraits
          ? allTraits
          : (allTraits || []).slice(0, maxCollapsedTraits),
      });
    },

    /** 全量刷新展示列表（外部设置 allTraits 后调用） */
    _refreshTraits() {
      const { showAllTraits, allTraits, maxCollapsedTraits } = this.data;
      this.setData({
        displayTraits: showAllTraits ? allTraits : (allTraits || []).slice(0, maxCollapsedTraits),
      });
    },

    /** 切换词条展开/收起 */
    onToggleTraits() {
      this.setData({ showAllTraits: !this.data.showAllTraits });
      this._syncDisplayTraits();
    },

    /** 合并已有词条和新词条，去重，记录已解锁 ID */
    _mergeTraits(existing: AppGame.TraitsItem[], incoming: AppGame.TraitsItem[], prevIds: string[]): AppGame.TraitsItem[] {
      const merged: AppGame.TraitsItem[] = [...existing];
      const newIds: string[] = [];
      for (const item of incoming) {
        if (!prevIds.includes(item.id) && !merged.some((t) => t.id === item.id)) {
          merged.push(item);
          newIds.push(item.id);
        }
      }
      if (newIds.length > 0) {
        this.setData({ _unlockedTraitIds: [...prevIds, ...newIds] });
      }
      return merged;
    },

    /** 点击词条，弹窗展示详情 */
    onTraitTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const { allTraits } = this.data;
      const trait = allTraits.find((t) => t.id === id);
      if (!trait) return;
      const popup = buildTraitPopup(trait);
      this.setData({ showTraitPopup: true, popupTrait: popup });
    },

    /** 关闭词条弹窗 */
    onClosePopup() {
      this.setData({ showTraitPopup: false, popupTrait: null });
    },

    /** 阻止弹窗内容区冒泡 */
    noop() {},

    saveGlob(){
      const app = getApp<IAppOption>();
      if(app.globalData.userInfo.gameData.currentRole){
        app.globalData.userInfo.gameData.currentRole.avatar=this.data.avatar;
        app.globalData.userInfo.gameData.currentRole.name=this.data.name;
        app.globalData.userInfo.gameData.currentRole.age=this.data.age;
        app.globalData.userInfo.gameData.currentRole.level=this.data.level;
        app.globalData.userInfo.gameData.currentRole.attributes=this.data.attributes;
        app.globalData.userInfo.gameData.currentRole.elements=this.data.elements;
        app.globalData.userInfo.gameData.currentRole.traits=this.data.allTraits;
        emitNodeChanged();
      }
      // 同步游戏数据到云端
      this._syncGameToCloud();
    },
    /** 将当前游戏数据同步到云端 */
    _syncGameToCloud(){
      const app = getApp<IAppOption>();
      const gd = app.globalData.userInfo.gameData;
      saveGameDataToCloud({
        currentRole: gd.currentRole,
        roles: gd.roles || {},
        saves: wx.getStorageSync("gameSaves") || [],
        achievements: wx.getStorageSync("achievements") || [],
        endings: wx.getStorageSync("endings") || [],
      });
    },
    goToSave() {
      wx.navigateTo({ url: "/packageGame/pages/save/save" });
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

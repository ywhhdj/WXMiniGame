declare namespace AppGame {
  type ElementAttrIdType = "gold" | "wood" | "water" | "fire" | "earth";
  type ElementAttrType = "金" | "木" | "水" | "火" | "土";
  type ElementAttrLevelType = 0 | 1 | 2 | 3;
  type ElementAttrLevelNameType = "初级" | "中级" | "高级" | "至尊";
  type Elements = Record<
    ElementAttrIdType,
    {
      name: ElementAttrType;
      level: ElementAttrLevelType;
      leveName: ElementAttrLevelNameType;
    }
  >;
  type RoleAttrName = "潜力" | "根骨" | "悟性" | "机缘" | "善恶";
  type RoleAttrId = "potential" | "root" | "wit" | "chance" | "goodness";
  type RoleAttr = {
    val: number;
    name: RoleAttrName;
  };
  type LevelName = "练气期" | "筑基期" | "金丹期" | "元婴期" | "化神期";
  type Level = {
    level: 0 | 1 | 2 | 3 | 4;
    name: LevelName;
  };
  type RoleAttributes = Record<RoleAttrId, RoleAttr>;
  type GenderType = "girl" | "boy";
  type Role = {
    currentNode: string | null;
    gender: GenderType;
    name: string;
    elements: Elements;
    level: Level;
    avatar: string;
    age: number;
    attributes: RoleAttributes;
    traits?: Traits;
  };
  //是奖励还是惩罚
  type KeyType = "reward" | "punish";
  type PlotAttrs = Record<
    KeyType,
    {
      type: RoleAttrId;
      value: number;
    }[]
  >;
  type TraitsName =
    | "吾辈楷模"
    | "后天木灵"
    | "头铁"
    | "至尊骨"
    | "虚若怀谷"
    | "懒惰"
    | "高山景行"
    | "英姿飒爽"
    | "大道之音"
    | "微澜雨上"
    | "柔弱"
    | "生龙活虎"
    | "十级美颜";
  type TraitsItem = {
    id: string;
    name: TraitsName;
    desc: string;
    level: 0 | 1 | 2 | 3; //0:负面级 1:中性 2:正面级 3:极致
    attrs?: PlotAttrs; //词条增长属性
    elements?: Record<
      KeyType,
      {
        type: ElementAttrIdType;
        value: number;
      }
    >; //词条增长元素
  };
  type Traits = TraitsItem[];
  type PlotOption = {
    id: string;
    text: string[];
    choice: string;
    attrs?: PlotAttrs;
    next?: string;
    traits?: TraitsName[];
  };
  type PlotWords = {
    id: string;
    name: string;
    attrs: PlotAttrs;
  };
  type Plot = {
    id: string;
    text: string[];
    next?: string;
    isLevelUpNode?: boolean;
    options?: PlotOption[];
    attrs?: PlotAttrs;
    traits: TraitsName[];
  };
  type Plots = {
    names: Record<GenderType, string>;
    nodes: Record<string, Plot>;
    startNodes: string[];
    levelUp: Record<
      LevelName,
      {
        successNode: string;
        failNode: string;
        upNode: string;
      }
    >;
  };
}

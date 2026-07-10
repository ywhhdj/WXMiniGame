declare namespace AppUI{
  type LoopType="单曲循环"|"列表循环"|"随机播放"
  type BgImageType="night"
  //|"day"|"cloudy"|"rainy"|"snowy"|"thunder"
  type Audio={
    id:string,
    url:string,
    isPlaying:boolean,
    name:string
  }
  type SceneItem ={
    id: string
    title: string
    subtitle: string
    icon: string
    shortLabel: string
    hasAllEndings: boolean
    collectedCount: number
    endingsList: Array<{key: string; text: string; collected: boolean}>
  }
  type ArchiveItem ={
    id: number;
    name: string;
    gender: AppGame.GenderType;
    avatar:string;
    age: number;
    level: AppGame.Level;
    elements: AppGame.Elements;
    attributes: AppGame.RoleAttributes;
    time: string;
    preview: string;
    currentNodeId: string | null;
    tag?: string;
  }

  /** 五行元素展示项 */
  type ElementDisplayItem = {
    key: string;
    name: string;
    level: number;
    leveName: string;
  }

  /** 角色属性展示项 */
  type AttrDisplayItem = {
    key: string;
    name: string;
    val: number;
  }
}
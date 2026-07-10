const envList:string[] = [
  "cloud1-d5g13xntx36481a06"
];
const isMac = false;
const paths={
  icons:{
    close:"/assets/images/icons/close.svg",
    sound_off:"/assets/images/icons/sound_off.svg",
    sound_on:"/assets/images/icons/sound_on.svg",
    sound:"/assets/images/icons/sound.svg",
    delete:"/assets/images/icons/delete.svg",
    play:"/assets/images/icons/play.svg",
    pause:"/assets/images/icons/pause.svg",
    stop:"/assets/images/icons/stop.svg",
    music:"/assets/images/icons/music.svg",
    round:"/assets/images/icons/round.svg",
    loop:"/assets/images/icons/loop.svg",
    once_loop:"/assets/images/icons/once_loop.svg",
    achievement:"/assets/images/icons/achievement.svg",
    speed:"/assets/images/icons/speed.svg",
    text:"/assets/images/icons/text.svg"
  } as Record<
  "close"|"sound_off"|"sound_on" |"sound"|"delete"|"play"|"pause"|"stop"|"music"|"round" |"loop" |"once_loop"|"achievement"|"speed"|"text"
  ,string>,
  avatars:{
    girl: "/assets/images/roles/girl.webp",
    boy: "/assets/images/roles/boy.webp",
  } as Record<AppGame.GenderType, string>,
  elements: {
    gold: "/assets/images/elements/gold.webp",
    wood: "/assets/images/elements/wood.webp",
    water: "/assets/images/elements/water.webp",
    fire: "/assets/images/elements/fire.webp",
    earth: "/assets/images/elements/earth.webp",
  } as Record<AppGame.ElementAttrIdType, string>,
  BgImages:{
    "index":"/assets/images/bg/index.webp",
    "story":"/assets/images/bg/story.webp",
    "night":"/assets/images/bg/settings.webp"
  } as Record<AppUI.BgImageType,string>,
  audios: [
    {
      url: "cloud://cloud1-d5g13xntx36481a06.636c-cloud1-d5g13xntx36481a06-1438972521/夏·烟火.mp3",
      name: "夏·烟火",
      isPlaying: true,
      id: "music_1"
    },{
      url: "cloud://cloud1-d5g13xntx36481a06.636c-cloud1-d5g13xntx36481a06-1438972521/穿越时空的思念钢琴版.m4a",
      name: "穿越时空的思念",
      isPlaying: false,
      id: "music_2"
    }
  ] as AppUI.Audio[],
  localAudios:[
    "/assets/audios/夏·烟火.mp3",
    "/assets/audios/穿越时空的思念钢琴版.m4a"
  ],
  gamePlotsFilePath:"/assets/data/game_plots.json"
}
const defaultAudioInfo:IAppOption["globalData"]["audio"]= {
  Context: null,
  info:paths.audios[0],
  loopType: "单曲循环",
}
const defaultGameData:IAppOption["globalData"]["userInfo"]["gameData"] = {
  gameAction: "save",
  currentRole: {
    gender: "girl",
    name: "",
    avatar:"/assets/images/roles/girl.webp",
    currentNode:"node_1",
    elements: {
      gold:{
        name: "金",
        level: 0,
        leveName:"初级"
      },
      wood:{
        name: "木",
        level: 0,
        leveName:"初级"
      },
      water:{
        name: "水",
        level: 0,
        leveName:"初级"
      },
      fire:{
        name: "火",
        level: 0,
        leveName:"初级"
      },
      earth:{
        name: "土",
        level: 0,
        leveName:"初级"
      }
    },
    age:1,
    level:{
      level:0,
      name:"练气期"
    },
    attributes:{
      potential:{
        val:30,
        name:"潜力"
      },
      root:{
        val:10,
        name:"根骨"
      },
      wit:{
        val:12,
        name:"悟性"
      },
      chance:{
        val:13,
        name:"机缘"
      },
      goodness:{
        val:20,
        name:"善恶"
      }
    }
  },
  roles: {},
  plots: null,
}
const defaultTextSpeed = 100;

const rolesInfo={
  plotsSpan:{
    "${gender}":{
      girl:"女",
      boy:"男"
    } as Record<AppGame.GenderType,string>
  } as Record<string,any>,
  randomNames:{
    girl: ["林芯甜", "苏溪", "元月","阙酥惠","端木庐","宣端秀","郝萌"],
    boy: ["林源", "陈德", "源生","马浩轩","欧阳铭","习好","公孙黎"],
  } as Record<AppGame.GenderType, string[]>,
}

export function getRandomName(gender:AppGame.GenderType){
  const names=rolesInfo.randomNames[gender]
  return names[Math.floor(Math.random()*names.length)]
}

const levels={
  roleLevel:{
    "练气期": {
      level:{ level: 0, name: "练气期" },
      node:0
    },
    "筑基期": {
      level:{ level: 1, name: "筑基期" },
      node:12
    },
    "金丹期": {
      level:{ level: 2, name: "金丹期" },
      node:22
    },
    "元婴期": {
      level:{ level: 3, name: "元婴期" },
      node:33
    },
    "化神期":{
      level:{ level: 4, name: "化神期" },
      node:44
    }
  } as Record<AppGame.LevelName,{
    level: AppGame.Level,
    node:number
  }>,
  // elementLevel:{
  //   "初级":0,
  // }
}
const attributes={
  "potential":"潜力",
  "root":"根骨",
  "wit":"悟性",
  "chance":"机缘",
  "goodness":"善恶"
} as Record<AppGame.RoleAttrId,AppGame.RoleAttrName>

const traits={
  "十级美颜":{
    id:"trait_0",
    desc:"美貌是无敌的，但美貌也是有极限的。",
    name:"十级美颜",
    level:2,
    attrs:{
      reward:[
        {
        type:"root",
        value:1
      },{
        type:"chance",
        value:2
      }
    ]
    }
  },
  "大道之音":{
    id  :"trait_1",
    desc:"天地之间传出来的大道之音，听者可感悟天地秩序。",
    name:"大道之音",
    level:2,
    elements:{
      reward:{
        type:"fire",
        value:2
      }
    }
  },
  "至尊骨":{
    id:"trait_2",
    desc:"至高至上，谁与争锋。",
    name:"至尊骨",
    level:3,
    attrs:{
      reward:[
        {
        type:"root",
        value:4
      },{
        type:"wit",
        value:4
      },
      {
        type:"potential",
        value:4
      }
    ]
    }
  },
  "吾辈楷模":{
    id:"trait_3",
    desc:"桂冠选手，年轻一代人，后无古人的最强者。",
    name:"吾辈楷模",
    level:2,
    attrs:{
      reward:[
        {
        type:"potential",
        value:2
      },
      {
        type:"root",
        value:2
      }
    ]
    }
  },
  "头铁":{
    id:"trait_4",
    desc:"手无寸铁，但是头铁。",
    name:"头铁",
    level:1,
    attrs:{
      reward:[
        {
        type:"chance",
        value:1
      },
      {
        type:"potential",
        value:1
      }
    ]
    }
  },
  "后天木灵": {
    id:"trait_5",
    desc:"后天木灵，后天的木灵",
    name:"后天木灵",
    level:1,
    elements:{
      reward:{
       type:"wood",
       value:1
      }
    }
  },
  "生龙活虎":{
    id:"trait_6",
    desc:"生龙活虎，生龙活虎",
    name:"生龙活虎",
    level:1,
    attrs:{
      reward:[
        {
        type:"root",
        value:1
      }
    ]
    }
  },
  "柔弱":{
    id:"trait_7",
    desc:"柔弱似水，柔弱似水",
    name:"柔弱",
    level:0,
    attrs:{
      punish:[
        {
        type:"root",
        value:1
      }
    ]
    }
  },
  "微澜雨上":{
    id:"trait_8",
    desc:"微澜雨上，微澜雨上",
    name:"微澜雨上",
    level:1,
    elements:{
      reward:{
        type:"water",
        value:1
      }
    }
  },
  "虚若怀谷":{
    id:"trait_9",
    desc:"虚若怀谷，虚若怀谷",
    name:"虚若怀谷",
    level:0,
    attrs:{
      punish:[
        {
        type:"wit",
        value:1
      }
    ]
    }
  },
  "懒惰":{
    id:"trait_10",
    desc:"懒惰如麻，懒惰如麻",
    name:"懒惰",
    level:0,
    attrs:{
      punish:[
        {
        type:"chance",
        value:1
        }
      ]
    }
  },
  "高山景行":{
    id:"trait_11",
    desc:"行为正大光明，比喻崇高的德行。",
    name:"高山景行",
    level:2,
    attrs:{
      reward:[
        {
        type:"chance",
        value:2
      }
    ]
    },
    elements:{
      reward:{
        type:"earth",
        value:1
      }
    }
  },
  "英姿飒爽":{
    id:"trait_12",
    desc:"英气逼人，飒爽如风，天生有领袖之姿。",
    name:"英姿飒爽",
    level:1,
    attrs:{
      reward:[
        { type:"potential", value:2 },
        { type:"root", value:1 }
      ]
    }
  }
} as Record<AppGame.TraitsName,AppGame.TraitsItem>

/** 剧情词条 — 不在随机选取中出现 */
const STORY_TRAIT_NAMES: AppGame.TraitsName[] = ["吾辈楷模","头铁","后天木灵","至尊骨"]

/**
 * 从非剧情词条中随机选取指定数量的天赋词条
 * @param count 选取数量，默认 5
 * @param exclude 额外排除的词条名称
 */
export function getRandomInitialTraits(count = 5, exclude: AppGame.TraitsName[] = []): AppGame.TraitsItem[] {
  const excludeSet = new Set<AppGame.TraitsName>([...STORY_TRAIT_NAMES, ...exclude])
  const pool: AppGame.TraitsItem[] = []
  for (const name of Object.keys(traits) as AppGame.TraitsName[]) {
    if (!excludeSet.has(name) && traits[name]) {
      pool.push(traits[name])
    }
  }
  // Fisher-Yates 部分洗牌，取前 count 个
  const n = Math.min(count, pool.length)
  for (let i = pool.length - 1; i > pool.length - 1 - n; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(pool.length - n)
}

export function parseLevel(name: AppGame.LevelName): AppGame.Level {
  return levels.roleLevel[name].level || { level: 0, name: "练气期" };
}

export function getLevelNode(name: AppGame.LevelName):number{
  return levels.roleLevel[name].node;
}

export {
  envList,
  isMac,
  defaultAudioInfo,
  defaultGameData,
  defaultTextSpeed,
  paths,
  rolesInfo,
  attributes,
  levels,
  traits
}

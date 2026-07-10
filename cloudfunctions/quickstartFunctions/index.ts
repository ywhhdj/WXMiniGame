import {
  init,
  database,
  DYNAMIC_CURRENT_ENV,
  getWXContext,
  openapi,
  uploadFile,
} from "wx-server-sdk";
import { Event, Response, GameData } from "./types";

init({
  env: DYNAMIC_CURRENT_ENV,
});
const db = database();
// 获取openid
const getOpenId = async (): Promise<
  Response<{
    openid: string | undefined;
    appid: string | undefined;
    unionid: string | undefined;
  }>
> => {
  const wxContext = getWXContext();
  const data = {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
  if (data.openid) {
    return {
      success: true,
      data: data,
    };
  } else {
    return {
      success: false,
      errMsg: "无法获取用户身份",
    };
  }
};

// 获取小程序二维码
const getMiniProgramCode = async (): Promise<Response> => {
  // 获取小程序二维码的buffer
  const resp = await openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return {
    success: true,
    data: upload.fileID,
  };
};
const getData= async (table:string,id:string) => {
  return await db.collection(table).where({ _id: id }).get();
};

const updateData= async (table:string,id:string,data: any): Promise<void> => {
  await db.collection(table).doc(id).update({ data: data });
};

const addData = async (table:string,data: any): Promise<void> => {
  await db.collection(table).add({ data: data });
};

// ==================== 用户游戏数据云存储 ====================
const USER_DATA_COLLECTION = "Users";

/** 保存用户游戏数据（upsert 模式） */
const saveGameData = async (event: Event): Promise<Response> => {
  const { currentRole, roles, saves, achievements, endings } = (event.data ||
    {}) as GameData;
  const openidRes = await getOpenId();
  if (!openidRes.success || !openidRes.data || !openidRes.data.openid) {
    return openidRes;
  }
  const openid = openidRes.data.openid;
  try {
    // 查询是否已有该用户的数据
    const existing = await getData(USER_DATA_COLLECTION,openid);
    const updateGameData: GameData = {
      currentRole: currentRole || null,
      roles: roles || {},
      saves: saves || [],
      achievements: achievements || [],
      endings: endings || [],
      updatedAt: new Date().toISOString(),
    };
    if (existing.data && existing.data.length > 0) {
      await updateData(USER_DATA_COLLECTION,existing.data[0]._id,updateGameData);
    } else {
      await addData(USER_DATA_COLLECTION,{
        _id: openid,
        ...updateGameData
      });
    }
    return {
      success: true,
      data: "ok",
    };
  } catch (e) {
    return {
      success: false,
      errMsg: String(e),
    };
  }
};

/** 加载用户游戏数据 */
const loadGameData = async (): Promise<Response> => {
  const openidRes = await getOpenId();
  if (!openidRes.success || !openidRes.data || !openidRes.data.openid) {
    return openidRes;
  }
  const openid = openidRes.data.openid;
  try {
    const result = await getData(USER_DATA_COLLECTION,openid);
    if (result.data && result.data.length > 0) {
      const doc = result.data[0] as Record<string, unknown>;
      return {
        success: true,
        data: {
          currentRole: doc.currentRole || null,
          roles: doc.roles || {},
          saves: doc.saves || [],
          achievements: doc.achievements || [],
          endings: doc.endings || [],
        } as GameData,
      };
    }
    return { success: true, data: null };
  } catch (e) {
    return { success: false, errMsg: String(e) };
  }
};

/** 同步成就数据 */
const syncAchievements = async (event: Event) => {
  const { achievements } = (event.data || {}) as { achievements?: string[] };
  const openidRes = await getOpenId();
  if (!openidRes.success || !openidRes.data || !openidRes.data.openid) {
    return openidRes;
  }
  const openid = openidRes.data.openid;
  if (!openid || !achievements) {
    return {
      success: false,
      errMsg: "参数不完整",
    };
  }
  try {
    const existing = await getData(USER_DATA_COLLECTION,openid);
    if (existing.data && existing.data.length > 0) {
      await updateData(USER_DATA_COLLECTION,existing.data[0]._id,{
        achievements,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addData(USER_DATA_COLLECTION,{
        _id: openid,
        achievements,
        updatedAt: new Date().toISOString()
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: String(e) };
  }
};

/** 同步结局数据 */
const syncEndings = async (event: Event) => {
  const { endings } = (event.data || {}) as {
    endings?: { sceneId: string; endingKey: string }[];
  };
  const openidRes = await getOpenId();
  if (!openidRes.success || !openidRes.data || !openidRes.data.openid) {
    return openidRes;
  }
  const openid = openidRes.data.openid;
  if (!openid || !endings) {
    return {
      success: false,
      errMsg: "参数不完整",
    };
  }
  try {
    const existing = await  getData(USER_DATA_COLLECTION,openid);
    if (existing.data && existing.data.length > 0) {
      await updateData(USER_DATA_COLLECTION,existing.data[0]._id,{
        endings,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addData(USER_DATA_COLLECTION,{
        _id: openid,
        endings,
        updatedAt: new Date().toISOString()
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: String(e) };
  }
};

export const main = async (
  event: Event,
  _context: unknown
): Promise<Response> => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "saveGameData":
      return await saveGameData(event);
    case "loadGameData":
      return await loadGameData();
    case "syncAchievements":
      return await syncAchievements(event);
    case "syncEndings":
      return await syncEndings(event);
    default:
      return {
        success: false,
        errMsg: `Unknown event type: ${event.type}`,
      };
  }
};

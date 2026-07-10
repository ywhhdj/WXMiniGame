import { showNotification } from "../events/notifyEvents";
import send from "../utils/http";
enum CloudEventType {
  SaveGameData = "saveGameData",
  LoadGameData = "loadGameData",
  SyncAchievements = "syncAchievements",
  SyncEndings = "syncEndings",
  OpenId = "getOpenId",
}

export async function getUserOpenId(): Promise<string|null>{
  try {
    const result = await send<API.OpenIdResponse>({
      type: CloudEventType.OpenId,
    });
    if(result.success && result.data){
      return result.data.openid;
    }
  } catch (err) {}
  return null;
}

export async function saveGameDataToCloud(
  data: API.CloudGameData
): Promise<boolean> {
  try {
    const result = await send<API.CloudGameData>({
      type: CloudEventType.SaveGameData,
      data: data,
    });
    if (result && result.success) {
      console.log("[CloudSync] 游戏数据已保存到云端");
      return true;
    }
    console.warn("[CloudSync] 保存失败:", result?.errMsg);
    return false;
  } catch (err) {
    console.warn("[CloudSync] 云端保存异常，使用本地存储:", err);
    return false;
  }
}

export async function loadGameDataFromCloud(): Promise<API.CloudGameData | null> {
  try {
    const result = await send<API.CloudGameData>({
      type: CloudEventType.LoadGameData,
    });
    if (result && result.success && result.data) {
      console.log("[CloudSync] 游戏数据已从云端加载");
      return result.data;
    }
  } catch (err) {
    showNotification({
      title:"数据加载",
      message:"云端加载异常，使用本地数据",
      levelType:"warning"
    })
  }
  return null;
}

export async function syncAchievementsToCloud(
  achievements: string[]
): Promise<void> {
  try {
    await send<void>({
      type: CloudEventType.SyncAchievements,
      data: ({ achievements } as unknown) as Record<string, unknown>,
    });
  } catch (_err) {}
}

export async function syncEndingsToCloud(
  endings: { sceneId: string; endingKey: string }[]
): Promise<void> {
  try {
    await send<void>({
      type: CloudEventType.SyncEndings,
      data: ({ endings } as unknown) as Record<string, unknown>,
    });
  } catch (_err) {}
}

export async function getTempFileURL(
  fileList: string[]
): Promise<ICloud.GetTempFileURLResultItem[]> {
  return new Promise(
    (
      resolve: (res: ICloud.GetTempFileURLResultItem[]) => void,
      reject: () => void
    ) => {
      wx.cloud.getTempFileURL({
        fileList,
        success: (res) => {
          resolve(res.fileList || []);
        },
        fail: (err) => {
          reject();
        },
      });
    }
  );
}

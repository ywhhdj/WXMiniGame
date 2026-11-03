/**
 * @deprecated 兼容层：新代码统一使用 services/repository 与 services/cloud。
 * 保留旧函数名，避免历史分支一次性改动过大；实现已改为走新数据门面。
 */
import * as repository from "@src/services/repository";
import { showNotification } from "@src/events/notifyEvents";

/** 身份不再下发客户端：openid 只在云函数侧通过 getWXContext 获取 */
export async function getUserOpenId(): Promise<string | null> {
  return null;
}

export async function saveGameDataToCloud(
  _data?: API.CloudGameData,
): Promise<boolean> {
  const result = await repository.saveCurrentState();
  return result.ok;
}

export async function loadGameDataFromCloud(): Promise<API.CloudGameData | null> {
  const result = await repository.loadSnapshot();
  if (!result.snapshot) return null;
  const s = result.snapshot;
  return {
    currentRole: s.currentRole as unknown as AppGame.Role | null,
    roles: {},
    saves: s.saves as unknown as AppUI.ArchiveItem[],
    achievements: s.achievements,
    endings: s.endings,
  };
}

export async function syncAchievementsToCloud(achievements: string[]): Promise<void> {
  await repository.syncAchievements(achievements);
}

export async function syncEndingsToCloud(
  endings: { sceneId: string; endingKey: string }[],
): Promise<void> {
  await repository.syncEndings(endings);
}

/** 私有云存储文件换取临时链接；失败由调用方回退到本地资源 */
export async function getTempFileURL(
  fileList: string[],
): Promise<ICloud.GetTempFileURLResultItem[]> {
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList,
      success: (res: any) => resolve(res.fileList || []),
      fail: () => {
        showNotification({
          title: "资源加载",
          message: "云端音频暂不可用，已切换本地资源",
          levelType: "info",
        });
        resolve([]);
      },
    });
  });
}

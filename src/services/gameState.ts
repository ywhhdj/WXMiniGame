import * as storage from "./storage";
import { SCHEMA_VERSION, GameSnapshot, Role, SaveItem } from "@shared/index";

/** 全局状态的唯一访问入口：页面不再直接 getApp().globalData... */
export function getGameData(): IAppOption["globalData"]["userInfo"]["gameData"] {
  return getApp<IAppOption>().globalData.userInfo.gameData;
}
export function getCurrentRole(): AppGame.Role | null {
  return getGameData().currentRole;
}
export function setCurrentRole(role: AppGame.Role | null): void {
  getGameData().currentRole = role;
}
export function getPlots(): AppGame.Plots | null {
  return getGameData().plots;
}
export function setPlots(plots: AppGame.Plots | null): void {
  getGameData().plots = plots;
}

function normalizeRole(r: AppGame.Role): Role {
  return {
    currentNode: r.currentNode ?? null,
    gender: r.gender,
    name: r.name,
    avatar: r.avatar,
    age: r.age,
    level: r.level,
    elements: r.elements,
    attributes: r.attributes,
    traits: (r.traits ?? []) as Role["traits"],
  } as unknown as Role;
}

/** 由当前全局状态 + 本地存储构造可落库的干净快照 */
export function buildSnapshotFromLocal(version: number): GameSnapshot {
  const gd = getGameData();
  // storage.readSaves() 已保证每条存档携带完整 role 快照（兼容旧版扁平存档）
  const saves: SaveItem[] = storage.readSaves().map((s) => ({ ...s, role: s.role }));
  return {
    schemaVersion: SCHEMA_VERSION,
    version,
    currentRole: gd.currentRole ? normalizeRole(gd.currentRole) : null,
    saves,
    achievements: storage.readAchievements(),
    endings: storage.readEndings(),
    updatedAt: new Date().toISOString(),
  };
}

/** 云端快照合并到本地：角色按需覆盖，存档仅本地为空时恢复，成就/结局取并集 */
export function applyCloudSnapshot(snapshot: GameSnapshot): void {
  const gd = getGameData();
  if (snapshot.currentRole && (!gd.currentRole || gd.gameAction === "save")) {
    gd.currentRole = snapshot.currentRole as unknown as AppGame.Role;
  }
  const localSaves = storage.readSaves();
  if (localSaves.length === 0 && snapshot.saves.length > 0) {
    storage.writeSaves(snapshot.saves);
  }
  const achievements = Array.from(
    new Set([...storage.readAchievements(), ...snapshot.achievements]),
  );
  storage.writeAchievements(achievements);
  const endings = [...storage.readEndings()];
  for (const e of snapshot.endings) {
    if (!endings.some((x) => x.sceneId === e.sceneId && x.endingKey === e.endingKey)) {
      endings.push(e);
    }
  }
  storage.writeEndings(endings);
}

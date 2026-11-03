import { callGame } from "./cloud";
import * as storage from "./storage";
import { applyCloudSnapshot, buildSnapshotFromLocal } from "./gameState";
import {
  ERROR_CODES,
  EndingRecord,
  GameSnapshot,
  LoadResult,
  SaveResult,
  SyncResult,
} from "@shared/index";

let currentVersion = 0;

export function getVersion(): number {
  return currentVersion;
}
export function setVersion(v: number): void {
  if (Number.isInteger(v) && v >= 0) currentVersion = v;
}

export interface LoadOutcome {
  snapshot: GameSnapshot | null;
  version: number;
  code?: string;
}
export interface SaveOutcome {
  ok: boolean;
  version: number;
  code?: string;
  serverSnapshot?: GameSnapshot | null;
}

/** 云端优先；成功即写入本地缓存并合并到全局状态；失败时回退本地缓存 */
export async function loadSnapshot(): Promise<LoadOutcome> {
  const resp = await callGame<LoadResult>("loadSnapshot");
  if (!resp.success) {
    const cached = storage.readLocalSnapshot();
    if (cached) {
      setVersion(cached.version);
      applyCloudSnapshot(cached.snapshot);
    }
    return { snapshot: cached?.snapshot ?? null, version: currentVersion, code: resp.code };
  }
  const data = resp.data ?? { snapshot: null, version: 0 };
  const version = typeof data.version === "number" ? data.version : 0;
  setVersion(version);
  if (data.snapshot) {
    storage.writeLocalSnapshot(data.snapshot, version);
    applyCloudSnapshot(data.snapshot);
  }
  return { snapshot: data.snapshot, version };
}

/** 从当前全局状态构造快照并保存（页面统一入口） */
export async function saveCurrentState(): Promise<SaveOutcome> {
  return saveSnapshot(buildSnapshotFromLocal(currentVersion), currentVersion);
}

export async function saveSnapshot(
  snapshot: GameSnapshot,
  expectedVersion: number,
): Promise<SaveOutcome> {
  const resp = await callGame<SaveResult>("saveSnapshot", { snapshot, expectedVersion });
  if (resp.success) {
    const version = resp.version ?? expectedVersion + 1;
    setVersion(version);
    storage.writeLocalSnapshot(snapshot, version);
    storage.clearPending();
    return { ok: true, version };
  }
  if (resp.code === ERROR_CODES.CONFLICT) {
    const server = (resp.data as GameSnapshot | null) ?? null;
    const version = resp.version ?? 0;
    setVersion(version);
    if (server) {
      storage.writeLocalSnapshot(server, version);
      applyCloudSnapshot(server);
    }
    return { ok: false, version, code: resp.code, serverSnapshot: server };
  }
  // 网络类失败进入离线队列，校验类失败不入队（重试也不会成功）
  if (resp.code === ERROR_CODES.INTERNAL || resp.code === ERROR_CODES.RATE_LIMITED) {
    storage.appendPending({ snapshot, expectedVersion });
  }
  return { ok: false, version: expectedVersion, code: resp.code };
}

/** 网络恢复后重放最后一条待提交快照；冲突时以服务端为准并清空队列 */
export async function flushPendingOps(): Promise<void> {
  const ops = storage.readPending();
  if (ops.length === 0) return;
  const last = ops[ops.length - 1];
  const result = await saveSnapshot(last.snapshot, currentVersion);
  if (!result.ok && result.code === ERROR_CODES.CONFLICT) {
    storage.clearPending();
  }
}

export async function syncAchievements(ids: string[]): Promise<boolean> {
  const resp = await callGame<SyncResult<string[]>>("syncAchievements", { ids });
  if (resp.success) {
    storage.writeAchievements(resp.data?.items ?? ids);
    if (typeof resp.version === "number") setVersion(resp.version);
  }
  return resp.success;
}

export async function syncEndings(endings: EndingRecord[]): Promise<boolean> {
  const resp = await callGame<SyncResult<EndingRecord[]>>("syncEndings", { endings });
  if (resp.success) {
    storage.writeEndings(resp.data?.items ?? endings);
    if (typeof resp.version === "number") setVersion(resp.version);
  }
  return resp.success;
}

/** 隐私合规：清除云端 + 本地全部游戏数据 */
export async function clearMyData(): Promise<boolean> {
  const resp = await callGame<{ cleared: boolean }>("clearMyData");
  if (resp.success) {
    storage.clearAll();
    setVersion(0);
  }
  return resp.success;
}

import {
  ACHIEVEMENT_IDS,
  ENDING_KEY_RE,
  LIMITS,
  SCENE_IDS,
  SAVE_ID_RE,
  payloadBytes,
  EndingRecord,
  GameSnapshot,
  Role,
  SaveItem,
} from "@shared/index";

export const STORAGE_KEYS = {
  SAVES: "gameSaves",
  ACHIEVEMENTS: "achievements",
  ENDINGS: "endings",
  SNAPSHOT: "game_snapshot_cache",
  VERSION: "game_snapshot_version",
  PENDING: "game_pending_ops",
  LOOP_TYPE: "loopType",
  MUSIC_LIST: "musicList",
} as const;

export type LoopType = "单曲循环" | "列表循环" | "随机播放";
const LOOP_TYPES: LoopType[] = ["单曲循环", "列表循环", "随机播放"];

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = wx.getStorageSync(key);
    if (v === "" || v === undefined || v === null) return fallback;
    return v as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): boolean {
  try {
    if (payloadBytes(value) > LIMITS.MAX_PAYLOAD_BYTES) {
      console.warn("[storage] 数据过大，拒绝写入", key);
      return false;
    }
    wx.setStorageSync(key, value);
    return true;
  } catch {
    return false;
  }
}

/** 旧版本存档（AppUI.ArchiveItem，无 role 快照、id 为 13 位）平滑升级为 SaveItem */
function normalizeSave(v: unknown): SaveItem | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, any>;
  let id: number = s.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return null;
  if (!SAVE_ID_RE.test(String(id))) {
    id = Math.floor(id) * 1000 + Math.floor(Math.random() * 1000);
  }
  const role: Role = s.role ?? {
    currentNode: typeof s.currentNodeId === "string" ? s.currentNodeId : null,
    gender: s.gender === "boy" ? "boy" : "girl",
    name: typeof s.name === "string" ? s.name : "无名",
    avatar: typeof s.avatar === "string" ? s.avatar : "/assets/images/roles/girl.webp",
    age: typeof s.age === "number" ? s.age : 1,
    level: s.level ?? { level: 0, name: "练气期" },
    elements: s.elements,
    attributes: s.attributes,
    traits: Array.isArray(s.traits) ? s.traits : [],
  };
  if (!role.elements || !role.attributes || !role.level) return null;
  return {
    id,
    name: typeof s.name === "string" ? s.name : "无名",
    gender: s.gender === "boy" ? "boy" : "girl",
    avatar: typeof s.avatar === "string" ? s.avatar : "/assets/images/roles/girl.webp",
    age: typeof s.age === "number" ? s.age : 1,
    level: s.level,
    elements: s.elements,
    attributes: s.attributes,
    time: typeof s.time === "string" ? s.time : "",
    preview: typeof s.preview === "string" ? s.preview : "",
    currentNodeId: typeof s.currentNodeId === "string" ? s.currentNodeId : null,
    ...(typeof s.tag === "string" ? { tag: s.tag } : {}),
    role,
  };
}

export function readSaves(): SaveItem[] {
  const raw = safeGet<unknown>(STORAGE_KEYS.SAVES, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, LIMITS.MAX_SAVES)
    .map(normalizeSave)
    .filter((x): x is SaveItem => x !== null);
}
export function writeSaves(items: SaveItem[]): boolean {
  return safeSet(STORAGE_KEYS.SAVES, items.slice(0, LIMITS.MAX_SAVES));
}

export function readAchievements(): string[] {
  const raw = safeGet<unknown>(STORAGE_KEYS.ACHIEVEMENTS, []);
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter(
        (x): x is string =>
          typeof x === "string" && (ACHIEVEMENT_IDS as readonly string[]).includes(x),
      ),
    ),
  ).slice(0, LIMITS.MAX_ACHIEVEMENTS);
}
export function writeAchievements(ids: string[]): boolean {
  return safeSet(
    STORAGE_KEYS.ACHIEVEMENTS,
    Array.from(new Set(ids)).slice(0, LIMITS.MAX_ACHIEVEMENTS),
  );
}

export function readEndings(): EndingRecord[] {
  const raw = safeGet<unknown>(STORAGE_KEYS.ENDINGS, []);
  if (!Array.isArray(raw)) return [];
  const out: EndingRecord[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const sceneId = r.sceneId;
    const endingKey = r.endingKey;
    if (
      typeof sceneId === "string" &&
      (SCENE_IDS as readonly string[]).includes(sceneId) &&
      typeof endingKey === "string" &&
      ENDING_KEY_RE.test(endingKey)
    ) {
      if (!out.some((x) => x.sceneId === sceneId && x.endingKey === endingKey)) {
        out.push({ sceneId, endingKey });
      }
    }
  }
  return out.slice(0, LIMITS.MAX_ENDINGS);
}
export function writeEndings(items: EndingRecord[]): boolean {
  return safeSet(STORAGE_KEYS.ENDINGS, items.slice(0, LIMITS.MAX_ENDINGS));
}

export function readLoopType(): LoopType {
  const v = safeGet<unknown>(STORAGE_KEYS.LOOP_TYPE, "");
  return typeof v === "string" && (LOOP_TYPES as string[]).includes(v)
    ? (v as LoopType)
    : "单曲循环";
}
export function writeLoopType(v: LoopType): boolean {
  return safeSet(STORAGE_KEYS.LOOP_TYPE, v);
}

export function readMusicList(): unknown[] {
  const v = safeGet<unknown>(STORAGE_KEYS.MUSIC_LIST, []);
  return Array.isArray(v) ? v.slice(0, 32) : [];
}
export function writeMusicList(v: unknown[]): boolean {
  return safeSet(STORAGE_KEYS.MUSIC_LIST, v.slice(0, 32));
}

export interface CachedSnapshot {
  snapshot: GameSnapshot;
  version: number;
}
export function readLocalSnapshot(): CachedSnapshot | null {
  const v = safeGet<unknown>(STORAGE_KEYS.SNAPSHOT, null);
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (!c.snapshot || typeof c.snapshot !== "object") return null;
  return {
    snapshot: c.snapshot as GameSnapshot,
    version: typeof c.version === "number" ? c.version : 0,
  };
}
export function writeLocalSnapshot(snapshot: GameSnapshot, version: number): boolean {
  return safeSet(STORAGE_KEYS.SNAPSHOT, { snapshot, version });
}

export interface PendingOp {
  snapshot: GameSnapshot;
  expectedVersion: number;
  ts: number;
}
export function readPending(): PendingOp[] {
  const v = safeGet<unknown>(STORAGE_KEYS.PENDING, []);
  return Array.isArray(v) ? (v as PendingOp[]).slice(-LIMITS.MAX_PENDING) : [];
}
export function appendPending(op: Omit<PendingOp, "ts">): void {
  const list = [...readPending(), { ...op, ts: Date.now() }].slice(-LIMITS.MAX_PENDING);
  safeSet(STORAGE_KEYS.PENDING, list);
}
export function clearPending(): void {
  safeSet(STORAGE_KEYS.PENDING, []);
}

export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      wx.removeStorageSync(key);
    } catch {
      // 忽略单个 key 清理失败
    }
  }
}

import { database } from "wx-server-sdk";
import {
  ACHIEVEMENT_IDS,
  COLLECTIONS,
  ENDING_KEY_RE,
  LIMITS,
  SCENE_IDS,
  SCHEMA_VERSION,
  SAVE_ID_RE,
  payloadBytes,
  validateRole,
  validateSnapshot,
  type EndingRecord,
  type GameSnapshot,
  type LegacyGameData,
  type LoadResult,
  type Role,
  type SaveItem,
  type SaveResult,
  type SyncResult,
  type UserDoc,
} from "./shared";
import { ConflictError } from "./errors";

const db = database();
const users = () => db.collection(COLLECTIONS.USERS);

export interface AuditEntry {
  openidHash: string;
  action: string;
  code: string;
  requestId: string;
  costMs: number;
}

/** 审计日志只写、不参与主流程一致性；写入失败不影响业务 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.collection(COLLECTIONS.AUDIT).add({
      data: {
        ...entry,
        ts: new Date(),
        expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  } catch {
    // 审计写失败不抛错给客户端
  }
}

function emptySnapshot(): GameSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    currentRole: null,
    saves: [],
    achievements: [],
    endings: [],
    updatedAt: new Date().toISOString(),
  };
}

function toSnapshot(doc: UserDoc): GameSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: typeof doc.version === "number" ? doc.version : 0,
    currentRole: doc.currentRole ?? null,
    saves: Array.isArray(doc.saves) ? doc.saves : [],
    achievements: Array.isArray(doc.achievements) ? doc.achievements : [],
    endings: Array.isArray(doc.endings) ? doc.endings : [],
    updatedAt: doc.updatedAt ?? "",
  };
}

async function readUser(openid: string): Promise<UserDoc | null> {
  try {
    const res = await users().doc(openid).get();
    return res && res.data ? (res.data as UserDoc) : null;
  } catch {
    return null;
  }
}

function normalizeLegacyRole(item: Record<string, any>): Role | null {
  return validateRole({
    currentNode:
      typeof item.currentNode === "string"
        ? item.currentNode
        : typeof item.currentNodeId === "string"
          ? item.currentNodeId
          : null,
    gender: item.gender === "boy" ? "boy" : "girl",
    name: typeof item.name === "string" ? item.name : "无名",
    avatar:
      typeof item.avatar === "string" ? item.avatar : "/assets/images/roles/girl.webp",
    age: typeof item.age === "number" ? item.age : 1,
    level: item.level ?? { level: 0, name: "练气期" },
    elements: item.elements,
    attributes: item.attributes,
    traits: Array.isArray(item.traits) ? item.traits : [],
  });
}

/** 旧 Users 集合 → 新快照；清洗失败则返回 null，由客户端降级到本地数据 */
export function migrateLegacy(raw: unknown): GameSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as LegacyGameData & Record<string, unknown>;
  const currentRole = r.currentRole ? normalizeLegacyRole(r.currentRole as Record<string, any>) : null;

  const saves: SaveItem[] = [];
  if (Array.isArray(r.saves)) {
    for (const s of r.saves.slice(0, LIMITS.MAX_SAVES)) {
      if (!s || typeof s !== "object") continue;
      const item = s as Record<string, any>;
      const role = normalizeLegacyRole(item);
      if (!role) continue;
      const id =
        typeof item.id === "number" && SAVE_ID_RE.test(String(item.id))
          ? item.id
          : Date.now() * 1000 + Math.floor(Math.random() * 1000);
      saves.push({
        id,
        name: typeof item.name === "string" ? item.name : "无名",
        gender: item.gender === "boy" ? "boy" : "girl",
        avatar:
          typeof item.avatar === "string" ? item.avatar : "/assets/images/roles/girl.webp",
        age: typeof item.age === "number" ? item.age : 1,
        level: item.level ?? { level: 0, name: "练气期" },
        elements: item.elements,
        attributes: item.attributes,
        time: typeof item.time === "string" ? item.time : "",
        preview: typeof item.preview === "string" ? item.preview : "",
        currentNodeId:
          typeof item.currentNodeId === "string" ? item.currentNodeId : null,
        role,
      });
    }
  }

  const achievements = Array.isArray(r.achievements)
    ? r.achievements
        .filter(
          (a): a is string =>
            typeof a === "string" && (ACHIEVEMENT_IDS as readonly string[]).includes(a),
        )
        .slice(0, LIMITS.MAX_ACHIEVEMENTS)
    : [];
  const endings: EndingRecord[] = Array.isArray(r.endings)
    ? r.endings
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({
          sceneId: String(e.sceneId ?? ""),
          endingKey: String(e.endingKey ?? ""),
        }))
        .filter(
          (e) =>
            (SCENE_IDS as readonly string[]).includes(e.sceneId) &&
            ENDING_KEY_RE.test(e.endingKey),
        )
        .slice(0, LIMITS.MAX_ENDINGS)
    : [];

  const checked = validateSnapshot({
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    currentRole,
    saves,
    achievements,
    endings,
    updatedAt: new Date().toISOString(),
  });
  if (!checked.ok) {
    console.warn(JSON.stringify({ evt: "migrate_legacy_rejected", code: checked.code }));
    return null;
  }
  return checked.value;
}

async function readLegacy(openid: string): Promise<GameSnapshot | null> {
  try {
    const res = await db
      .collection(COLLECTIONS.LEGACY_USERS)
      .where({ _id: openid })
      .get();
    if (!res.data || res.data.length === 0) return null;
    return migrateLegacy(res.data[0]);
  } catch {
    return null;
  }
}

/** 读：新集合优先，迁移期兼容读旧集合（只读，不改写） */
export async function loadSnapshot(openid: string): Promise<LoadResult> {
  const doc = await readUser(openid);
  if (doc) return { snapshot: toSnapshot(doc), version: doc.version || 0 };
  const legacy = await readLegacy(openid);
  if (legacy) return { snapshot: legacy, version: 0 };
  return { snapshot: null, version: 0 };
}

/** 写：单文档聚合 + version CAS，一次原子更新完成，无跨集合中间态 */
export async function saveSnapshot(
  openid: string,
  snapshot: GameSnapshot,
  expectedVersion: number,
): Promise<SaveResult> {
  const now = new Date().toISOString();
  const next: GameSnapshot = {
    ...snapshot,
    schemaVersion: SCHEMA_VERSION,
    version: expectedVersion + 1,
    updatedAt: now,
  };
  // 大小校验已在 validateSaveRequest 完成，此处不再重复抛错（避免边界请求被误判为内部错误）
  const existing = await readUser(openid);
  if (!existing) {
    try {
      await users().add({ data: { _id: openid, openid, createdAt: now, ...next } });
      return { version: next.version };
    } catch {
      // 并发创建：落到下面的 CAS 分支
    }
  }

  const res = await users()
    .where({ _id: openid, version: expectedVersion })
    .update({ data: next });
  if (res.stats && res.stats.updated === 1) {
    return { version: next.version };
  }
  const latest = await readUser(openid);
  throw new ConflictError(latest?.version ?? 0, latest ? toSnapshot(latest) : null);
}

/** 成就 / 结局：单调并集（只增不减），避免客户端回退或伪造删除 */
export async function mergeAchievements(
  openid: string,
  ids: string[],
): Promise<SyncResult<string[]>> {
  const doc = await readUser(openid);
  const base = doc?.version ?? 0;
  const items = Array.from(new Set([...(doc?.achievements ?? []), ...ids])).slice(
    0,
    LIMITS.MAX_ACHIEVEMENTS,
  );
  const version = base + 1;
  const now = new Date().toISOString();
  if (!doc) {
    await users().add({
      data: {
        _id: openid,
        openid,
        createdAt: now,
        ...emptySnapshot(),
        achievements: items,
        version,
        updatedAt: now,
      },
    });
    return { items, version };
  }
  const res = await users()
    .where({ _id: openid, version: base })
    .update({ data: { achievements: items, version, updatedAt: now } });
  if (!res.stats || res.stats.updated !== 1) {
    const latest = await readUser(openid);
    throw new ConflictError(latest?.version ?? 0, latest ? toSnapshot(latest) : null);
  }
  return { items, version };
}

export async function mergeEndings(
  openid: string,
  incoming: EndingRecord[],
): Promise<SyncResult<EndingRecord[]>> {
  const doc = await readUser(openid);
  const base = doc?.version ?? 0;
  const merged: EndingRecord[] = [...(doc?.endings ?? [])];
  for (const e of incoming) {
    if (!merged.some((x) => x.sceneId === e.sceneId && x.endingKey === e.endingKey)) {
      merged.push(e);
    }
  }
  const items = merged.slice(0, LIMITS.MAX_ENDINGS);
  const version = base + 1;
  const now = new Date().toISOString();
  if (!doc) {
    await users().add({
      data: {
        _id: openid,
        openid,
        createdAt: now,
        ...emptySnapshot(),
        endings: items,
        version,
        updatedAt: now,
      },
    });
    return { items, version };
  }
  const res = await users()
    .where({ _id: openid, version: base })
    .update({ data: { endings: items, version, updatedAt: now } });
  if (!res.stats || res.stats.updated !== 1) {
    const latest = await readUser(openid);
    throw new ConflictError(latest?.version ?? 0, latest ? toSnapshot(latest) : null);
  }
  return { items, version };
}

export async function getProfile(openid: string): Promise<{
  hasData: boolean;
  schemaVersion: number;
  updatedAt: string | null;
}> {
  const doc = await readUser(openid);
  return {
    hasData: !!doc,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: doc?.updatedAt ?? null,
  };
}

/** 隐私合规：用户主动清除自己的云端数据 */
export async function clearMyData(openid: string): Promise<void> {
  try {
    await users().doc(openid).remove();
  } catch {
    // 文档不存在视为已清除
  }
}

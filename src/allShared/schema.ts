/**
 * 零依赖手写校验器：小程序端与云函数端共用。
 * 核心原则：**绝不 spread 客户端对象**，逐字段读取后构造全新的干净对象。
 * 由此同时挡住：任意字段注入、数据库更新操作符注入、原型污染、超长 payload。
 */
import {
  ACHIEVEMENT_IDS,
  ATTR_IDS,
  ATTR_NAMES,
  AVATAR_PREFIXES,
  ELEMENT_IDS,
  ELEMENT_LEVEL_NAMES,
  ELEMENT_NAMES,
  ENDING_KEY_RE,
  ERROR_CODES,
  GENDERS,
  LEVEL_NAMES,
  LIMITS,
  NODE_ID_RE,
  SAVE_ID_RE,
  SCENE_IDS,
  SCHEMA_VERSION,
  TRAIT_IDS,
} from "./constants";
import type {
  ElementAttr,
  Elements,
  EndingRecord,
  GameSnapshot,
  Level,
  Role,
  RoleAttr,
  RoleAttributes,
  SaveItem,
  TraitItem,
} from "./types";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const fail = (code: string, message?: string): { ok: false; code: string; message: string } => ({
  ok: false,
  code,
  message: message || code,
});
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** 纯 JS 计算 UTF-8 字节长度（小程序端没有 Buffer） */
export function utf8ByteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i)!;
    if (c <= 0x7f) n += 1;
    else if (c <= 0x7ff) n += 2;
    else if (c <= 0xffff) n += 3;
    else {
      n += 4;
      i++;
    }
  }
  return n;
}

export function payloadBytes(input: unknown): number {
  try {
    return utf8ByteLength(JSON.stringify(input) ?? "");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/**
 * 递归检查键名与结构规模：
 * - 以 $ 开头 / 含 . / 含控制字符 / 原型链关键字 → 拒绝（防操作符注入与原型污染）
 * - 深度与节点数上限 → 防深度嵌套导致栈溢出与解析放大
 */
export function findUnsafeKey(input: unknown): string | null {
  let nodes = 0;
  const walk = (v: unknown, depth: number): string | null => {
    if (depth > LIMITS.MAX_OBJECT_DEPTH) return "MAX_DEPTH";
    if (++nodes > LIMITS.MAX_OBJECT_NODES) return "MAX_NODES";
    if (Array.isArray(v)) {
      for (const item of v) {
        const r = walk(item, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (v && typeof v === "object") {
      for (const key of Object.keys(v as Record<string, unknown>)) {
        if (
          key.startsWith("$") ||
          key.includes(".") ||
          CONTROL_RE.test(key) ||
          UNSAFE_KEYS.has(key)
        ) {
          return key;
        }
        const r = walk((v as Record<string, unknown>)[key], depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(input, 0);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** 清洗字符串：限长 + 去控制字符；不合法返回 null */
function str(v: unknown, max: number, allowEmpty = true): string | null {
  if (typeof v !== "string") return null;
  if (v.length > max) return null;
  if (!allowEmpty && v.length === 0) return null;
  return CONTROL_RE.test(v) ? null : v;
}

function int(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}

function assertSize(input: unknown): { ok: false; code: string; message: string } | null {
  const bytes = payloadBytes(input);
  return bytes > LIMITS.MAX_PAYLOAD_BYTES ? fail(ERROR_CODES.PAYLOAD_TOO_LARGE) : null;
}

function assertSafe(input: unknown): { ok: false; code: string; message: string } | null {
  const bad = findUnsafeKey(input);
  return bad ? fail(ERROR_CODES.FORBIDDEN_FIELD) : null;
}

/** 通用入口检查：大小 + 危险键，所有 handler 第一行调用 */
export function checkEnvelope(input: unknown): ValidationResult<unknown> {
  const size = assertSize(input);
  if (size) return size;
  const safe = assertSafe(input);
  if (safe) return safe;
  return ok(input);
}

function validateLevel(v: unknown): Level | null {
  if (!isPlainObject(v)) return null;
  const level = int(v.level, 0, 4);
  const name = oneOf(v.name, LEVEL_NAMES);
  if (level === null || !name) return null;
  return { level: level as Level["level"], name };
}

function validateElements(v: unknown): Elements | null {
  if (!isPlainObject(v)) return null;
  const out = {} as Elements;
  for (let i = 0; i < ELEMENT_IDS.length; i++) {
    const id = ELEMENT_IDS[i];
    const raw = v[id];
    if (!isPlainObject(raw)) return null;
    const level = int(raw.level, 0, 3);
    const name = oneOf(raw.name, ELEMENT_NAMES);
    const leveName = oneOf(raw.leveName, ELEMENT_LEVEL_NAMES);
    if (level === null || !name || !leveName) return null;
    out[id] = { level: level as ElementAttr["level"], name, leveName } as ElementAttr;
  }
  return out;
}

function validateAttributes(v: unknown): RoleAttributes | null {
  if (!isPlainObject(v)) return null;
  const out = {} as RoleAttributes;
  for (let i = 0; i < ATTR_IDS.length; i++) {
    const id = ATTR_IDS[i];
    const raw = v[id];
    if (!isPlainObject(raw)) return null;
    const val = int(raw.val, LIMITS.MIN_ATTR_VALUE, LIMITS.MAX_ATTR_VALUE);
    const name = oneOf(raw.name, ATTR_NAMES);
    if (val === null || !name) return null;
    out[id] = { val, name } as RoleAttr;
  }
  return out;
}

function validateTrait(v: unknown): TraitItem | null {
  if (!isPlainObject(v)) return null;
  const id = oneOf(v.id, TRAIT_IDS);
  if (!id) return null;
  const name = str(v.name, LIMITS.MAX_ROLE_STRING);
  const desc = str(v.desc, LIMITS.MAX_DESC);
  const level = int(v.level, 0, 3);
  if (name === null || desc === null || level === null) return null;
  const out: TraitItem = { id, name, desc, level: level as TraitItem["level"] };

  // 只保留合法结构的奖励/惩罚效果，丢弃一切未知键
  const cleanEffectList = (raw: unknown): { type: string; value: number }[] =>
    Array.isArray(raw)
      ? (raw
          .filter(isPlainObject)
          .map((e) => ({ type: e.type, value: int(e.value, -999, 999) }))
          .filter((e) => typeof e.type === "string" && e.value !== null)
          .slice(0, 16) as { type: string; value: number }[])
      : [];

  if (isPlainObject(v.attrs)) {
    const attrs: NonNullable<TraitItem["attrs"]> = {};
    const reward = cleanEffectList(v.attrs.reward);
    const punish = cleanEffectList(v.attrs.punish);
    if (reward.length) attrs.reward = reward as NonNullable<NonNullable<TraitItem["attrs"]>["reward"]>;
    if (punish.length) attrs.punish = punish as NonNullable<NonNullable<TraitItem["attrs"]>["punish"]>;
    if (Object.keys(attrs).length) out.attrs = attrs;
  }
  if (isPlainObject(v.elements)) {
    const elements: NonNullable<TraitItem["elements"]> = {};
    for (const kind of ["reward", "punish"] as const) {
      const raw = v.elements[kind];
      if (!isPlainObject(raw)) continue;
      const t = str(raw.type, 16, false);
      const val = int(raw.value, -999, 999);
      if (t !== null && val !== null) {
        elements[kind] = { type: t, value: val } as NonNullable<NonNullable<TraitItem["elements"]>[typeof kind]>;
      }
    }
    if (Object.keys(elements).length) out.elements = elements;
  }
  return out;
}

export function validateRole(v: unknown): Role | null {
  if (!isPlainObject(v)) return null;
  const gender = oneOf(v.gender, GENDERS);
  const name = str(v.name, LIMITS.MAX_ROLE_STRING);
  const avatar = str(v.avatar, LIMITS.MAX_AVATAR);
  const age = int(v.age, 1, LIMITS.MAX_AGE);
  const level = validateLevel(v.level);
  const elements = validateElements(v.elements);
  const attributes = validateAttributes(v.attributes);
  if (!gender || name === null || avatar === null || age === null || !level || !elements || !attributes) {
    return null;
  }
  if (!AVATAR_PREFIXES.some((p) => (avatar as string).startsWith(p))) return null;
  const currentNode =
    v.currentNode === null || v.currentNode === undefined
      ? null
      : typeof v.currentNode === "string" && NODE_ID_RE.test(v.currentNode)
        ? v.currentNode
        : undefined;
  if (currentNode === undefined) return null;
  const traitsRaw = v.traits;
  const traits: TraitItem[] = [];
  if (Array.isArray(traitsRaw)) {
    if (traitsRaw.length > LIMITS.MAX_TRAITS) return null;
    for (const t of traitsRaw) {
      const clean = validateTrait(t);
      if (!clean) return null;
      traits.push(clean);
    }
  }
  return { currentNode, gender, name, avatar, age, level, elements, attributes, traits };
}

export function validateSaveItem(v: unknown): SaveItem | null {
  if (!isPlainObject(v)) return null;
  const id = int(v.id, 1, Number.MAX_SAFE_INTEGER);
  if (id === null || !SAVE_ID_RE.test(String(id))) return null;
  const name = str(v.name, LIMITS.MAX_ROLE_STRING);
  const gender = oneOf(v.gender, GENDERS);
  const avatar = str(v.avatar, LIMITS.MAX_AVATAR);
  const age = int(v.age, 1, LIMITS.MAX_AGE);
  const level = validateLevel(v.level);
  const elements = validateElements(v.elements);
  const attributes = validateAttributes(v.attributes);
  const time = str(v.time, 32);
  const preview = str(v.preview, LIMITS.MAX_PREVIEW);
  const role = validateRole(v.role);
  if (
    name === null || !gender || avatar === null || age === null || !level ||
    !elements || !attributes || time === null || preview === null || !role
  ) {
    return null;
  }
  const currentNodeId =
    v.currentNodeId === null || v.currentNodeId === undefined
      ? null
      : typeof v.currentNodeId === "string" && NODE_ID_RE.test(v.currentNodeId)
        ? v.currentNodeId
        : undefined;
  if (currentNodeId === undefined) return null;
  const out: SaveItem = {
    id, name, gender, avatar, age, level, elements, attributes,
    time, preview, currentNodeId, role,
  };
  const tag = str(v.tag, 16);
  if (tag !== null && tag.length > 0) out.tag = tag;
  return out;
}

export function validateAchievementIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > LIMITS.MAX_ACHIEVEMENTS) return null;
  const out: string[] = [];
  for (const item of v) {
    const id = oneOf(item, ACHIEVEMENT_IDS);
    if (!id) return null;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function validateEndings(v: unknown): EndingRecord[] | null {
  if (!Array.isArray(v) || v.length > LIMITS.MAX_ENDINGS) return null;
  const out: EndingRecord[] = [];
  for (const item of v) {
    if (!isPlainObject(item)) return null;
    const sceneId = oneOf(item.sceneId, SCENE_IDS);
    const endingKey = str(item.endingKey, 16, false);
    if (!sceneId || endingKey === null || !ENDING_KEY_RE.test(endingKey)) return null;
    if (!out.some((e) => e.sceneId === sceneId && e.endingKey === endingKey)) {
      out.push({ sceneId, endingKey });
    }
  }
  return out;
}

/** 校验并构造完整快照（version / updatedAt 由调用方覆盖为服务端值） */
export function validateSnapshot(input: unknown): ValidationResult<GameSnapshot> {
  const env = checkEnvelope(input);
  if (!env.ok) return env;
  if (!isPlainObject(input)) return fail(ERROR_CODES.INVALID_PAYLOAD);
  let currentRole: Role | null = null;
  if (input.currentRole !== null && input.currentRole !== undefined) {
    const r = validateRole(input.currentRole);
    if (!r) return fail(ERROR_CODES.INVALID_PAYLOAD);
    currentRole = r;
  }
  const savesRaw = input.saves ?? [];
  if (!Array.isArray(savesRaw) || savesRaw.length > LIMITS.MAX_SAVES) {
    return fail(ERROR_CODES.QUOTA_EXCEEDED);
  }
  const saves: SaveItem[] = [];
  for (const s of savesRaw) {
    const item = validateSaveItem(s);
    if (!item) return fail(ERROR_CODES.INVALID_PAYLOAD);
    saves.push(item);
  }
  const achievements = validateAchievementIds(input.achievements ?? []);
  const endings = validateEndings(input.endings ?? []);
  if (achievements === null || endings === null) return fail(ERROR_CODES.INVALID_PAYLOAD);
  return ok({
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    currentRole,
    saves,
    achievements,
    endings,
    updatedAt: "",
  });
}

export function validateSaveRequest(input: unknown): ValidationResult<{ snapshot: GameSnapshot; expectedVersion: number }> {
  const env = checkEnvelope(input);
  if (!env.ok) return env;
  if (!isPlainObject(input)) return fail(ERROR_CODES.INVALID_PAYLOAD);
  const expectedVersion = int(input.expectedVersion, 0, Number.MAX_SAFE_INTEGER);
  if (expectedVersion === null) return fail(ERROR_CODES.INVALID_PAYLOAD);
  const snap = validateSnapshot(input.snapshot);
  if (!snap.ok) return snap;
  return ok({ snapshot: snap.value, expectedVersion });
}

export function validateSyncAchievementsRequest(input: unknown): ValidationResult<string[]> {
  const env = checkEnvelope(input);
  if (!env.ok) return env;
  if (!isPlainObject(input)) return fail(ERROR_CODES.INVALID_PAYLOAD);
  const ids = validateAchievementIds(input.ids);
  return ids === null ? fail(ERROR_CODES.INVALID_PAYLOAD) : ok(ids);
}

export function validateSyncEndingsRequest(input: unknown): ValidationResult<EndingRecord[]> {
  const env = checkEnvelope(input);
  if (!env.ok) return env;
  if (!isPlainObject(input)) return fail(ERROR_CODES.INVALID_PAYLOAD);
  const endings = validateEndings(input.endings);
  return endings === null ? fail(ERROR_CODES.INVALID_PAYLOAD) : ok(endings);
}

/** 日志脱敏：只保留结构与规模，不输出用户内容与身份 */
export function summarizeForLog(input: unknown): Record<string, unknown> {
  return {
    bytes: payloadBytes(input),
    type: Array.isArray(input) ? "array" : typeof input,
  };
}

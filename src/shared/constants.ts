/**
 * 前后端共享常量 —— 唯一真源。
 * 小程序端与云函数端通过 scripts/sync-shared.js 保持三份副本完全一致，禁止分别硬编码。
 */
export const CLOUD_FUNCTION_GAME = "game";
export const CLOUD_FUNCTION_QRCODE = "getMiniProgramCode";

/** 集合名：禁止把集合名作为客户端参数传入（旧实现 getData(table,...) 已废弃） */
export const COLLECTIONS = {
  USERS: "game_users",
  LEGACY_USERS: "Users",
  AUDIT: "game_audit_logs",
  RATE: "game_rate_limits",
} as const;

export const SCHEMA_VERSION = 2;

export const LIMITS = {
  /** 单次请求体上限（UTF-8 字节），前后端各校验一次 */
  MAX_PAYLOAD_BYTES: 64 * 1024,
  MAX_ROLE_STRING: 32,
  MAX_AVATAR: 256,
  MAX_DESC: 256,
  MAX_PREVIEW: 128,
  MAX_TEXT: 2000,
  MAX_NODE_ID: 64,
  MAX_SAVES: 3,
  MAX_ACHIEVEMENTS: 64,
  MAX_ENDINGS: 64,
  MAX_TRAITS: 16,
  MAX_AGE: 200,
  MAX_ATTR_VALUE: 9999,
  MIN_ATTR_VALUE: -9999,
  MAX_ARRAY_ITEMS: 64,
  MAX_OBJECT_DEPTH: 8,
  MAX_OBJECT_NODES: 2000,
  /** 客户端离线队列上限 */
  MAX_PENDING: 8,
} as const;

/** 主业务函数允许的动作，router 之外一律拒绝 */
export const ACTIONS = [
  "loadSnapshot",
  "saveSnapshot",
  "syncAchievements",
  "syncEndings",
  "getProfile",
  "clearMyData",
] as const;
export type Action = (typeof ACTIONS)[number];

export const RATE_LIMITS: Record<Action, { windowMs: number; max: number }> = {
  loadSnapshot: { windowMs: 60_000, max: 60 },
  saveSnapshot: { windowMs: 60_000, max: 20 },
  syncAchievements: { windowMs: 60_000, max: 10 },
  syncEndings: { windowMs: 60_000, max: 10 },
  getProfile: { windowMs: 60_000, max: 30 },
  clearMyData: { windowMs: 60_000, max: 3 },
};

/** 二维码独立函数的配额（按天） */
export const QR_RATE = { windowMs: 24 * 60 * 60 * 1000, max: 3 };
export const ALLOWED_QR_PATHS = ["pages/index/index"] as const;

export const GENDERS = ["girl", "boy"] as const;
export const ELEMENT_IDS = ["gold", "wood", "water", "fire", "earth"] as const;
export const ELEMENT_NAMES = ["金", "木", "水", "火", "土"] as const;
export const ELEMENT_LEVEL_NAMES = ["初级", "中级", "高级", "至尊"] as const;
export const ATTR_IDS = ["potential", "root", "wit", "chance", "goodness"] as const;
export const ATTR_NAMES = ["潜力", "根骨", "悟性", "机缘", "善恶"] as const;
export const LEVEL_NAMES = ["练气期", "筑基期", "金丹期", "元婴期", "化神期"] as const;
export const TRAIT_IDS = Array.from({ length: 13 }, (_, i) => `trait_${i}`);

/** 成就白名单：与 miniprogram/components/layout/BackgroundAchievement 中定义一一对应 */
export const ACHIEVEMENT_IDS = [
  "first_step",
  "foundation",
  "golden_core",
  "age_10",
  "age_20",
  "potential_50",
  "wit_30",
  "chance_30",
  "goodness_60",
  "evil_path",
  "element_gold",
  "element_water",
  "collector_5",
  "collector_all",
] as const;

/** 结局场景白名单（新增场景须同步此表） */
export const SCENE_IDS = ["cultivation-start", "first-tribulation"] as const;
/** 结局 key 格式：C1-A2 / D1-B2 ... */
export const ENDING_KEY_RE = /^[A-Z]\d-[A-Z]\d$/;
/** 剧情节点 id / 存档 id */
export const NODE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** 手动存档 id：毫秒时间戳 ×1000 + 随机尾数，保持 Number 类型以兼容 SaveCard 绑定 */
export const SAVE_ID_RE = /^\d{16,19}$/;
export const AVATAR_PREFIXES = ["/assets/", "cloud://"] as const;

export const ERROR_CODES = {
  INVALID_ACTION: "E1001_INVALID_ACTION",
  UNAUTHORIZED: "E1002_UNAUTHORIZED",
  INVALID_PAYLOAD: "E1003_INVALID_PAYLOAD",
  PAYLOAD_TOO_LARGE: "E1004_PAYLOAD_TOO_LARGE",
  FORBIDDEN_FIELD: "E1005_FORBIDDEN_FIELD",
  QUOTA_EXCEEDED: "E1006_QUOTA_EXCEEDED",
  NOT_FOUND: "E2001_NOT_FOUND",
  CONFLICT: "E3001_CONFLICT",
  RATE_LIMITED: "E4001_RATE_LIMITED",
  INTERNAL: "E5001_INTERNAL",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 对外固定文案：任何情况下都不把内部异常原文回传客户端 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  E1001_INVALID_ACTION: "不支持的操作",
  E1002_UNAUTHORIZED: "无法验证用户身份",
  E1003_INVALID_PAYLOAD: "提交的数据不合法",
  E1004_PAYLOAD_TOO_LARGE: "提交的数据过大",
  E1005_FORBIDDEN_FIELD: "提交的数据包含不允许的字段",
  E1006_QUOTA_EXCEEDED: "数据数量超出限制",
  E2001_NOT_FOUND: "暂无数据",
  E3001_CONFLICT: "数据在其他设备上已更新",
  E4001_RATE_LIMITED: "操作过于频繁，请稍后再试",
  E5001_INTERNAL: "服务暂时不可用",
};

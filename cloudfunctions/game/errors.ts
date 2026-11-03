import { ERROR_MESSAGES, type CloudResponse, type ErrorCode } from "./shared";

export interface LogContext {
  requestId: string;
  action: string;
  code: string;
  costMs: number;
  openidHash?: string;
}

export function newRequestId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 仅用于日志脱敏的非加密哈希（FNV-1a），不输出 openid 明文 */
export function openidHash(input: string): string {
  const fnv = (s: string, seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(input, 0x811c9dc5) + fnv(input, 0x9e3779b9);
}

export function success<T>(data: T, requestId: string, version?: number): CloudResponse<T> {
  return {
    success: true,
    code: "OK",
    data,
    ...(version === undefined ? {} : { version }),
    requestId,
  };
}

/** 对外只返回语义化错误码与固定文案，绝不回传异常原文 */
export function failure(
  code: string,
  requestId: string,
  extra?: { data?: unknown; version?: number; message?: string },
): CloudResponse {
  const fixed = ERROR_MESSAGES[code as ErrorCode] ?? "请求失败";
  return {
    success: false,
    code,
    message: extra?.message ?? fixed,
    ...(extra?.data === undefined ? {} : { data: extra.data }),
    ...(extra?.version === undefined ? {} : { version: extra.version }),
    requestId,
  };
}

export class ConflictError extends Error {
  constructor(
    public readonly version: number,
    public readonly snapshot: unknown,
  ) {
    super("version conflict");
    this.name = "ConflictError";
  }
}

/** 日志只记录结构信息，异常 message/stack 可能含集合名与内部路径，一律不落地 */
export function logError(ctx: LogContext, err?: unknown): void {
  console.error(
    JSON.stringify({
      ...ctx,
      errType: err instanceof Error ? err.name : typeof err,
    }),
  );
}

import { database } from "wx-server-sdk";
import { COLLECTIONS, ERROR_MESSAGES, type CloudResponse, type ErrorCode } from "./shared";

const db = database();

export function newRequestId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 日志脱敏：不输出 openid 明文 */
export function openidHash(input: string): string {
  const fnv = (seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x9e3779b9);
}

export function ok<T>(data: T, requestId: string): CloudResponse<T> {
  return { success: true, code: "OK", data, requestId };
}

export function fail(code: string, requestId: string): CloudResponse {
  return {
    success: false,
    code,
    message: ERROR_MESSAGES[code as ErrorCode] ?? "请求失败",
    requestId,
  };
}

export function logQrError(
  ctx: { requestId: string; openidHash: string; code: string },
  err?: unknown,
): void {
  console.error(
    JSON.stringify({
      ...ctx,
      errType: err instanceof Error ? err.name : typeof err,
    }),
  );
}

export async function writeQrAudit(entry: {
  openidHash: string;
  code: string;
  requestId: string;
  costMs: number;
}): Promise<void> {
  try {
    await db.collection(COLLECTIONS.AUDIT).add({
      data: {
        ...entry,
        action: "getMiniProgramCode",
        ts: new Date(),
        expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  } catch {
    // 审计写失败不影响主流程
  }
}

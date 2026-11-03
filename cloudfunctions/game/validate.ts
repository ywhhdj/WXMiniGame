import { ACTIONS, type Action } from "./shared";
import { newRequestId } from "./errors";

export function parseAction(v: unknown): Action | null {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v)
    ? (v as Action)
    : null;
}

/** 客户端可携带 requestId 便于排查，但必须清洗，避免注入超长/异常字符进入日志 */
export function parseRequestId(v: unknown): string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : newRequestId();
}

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

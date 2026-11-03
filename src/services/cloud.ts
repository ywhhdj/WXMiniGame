import {
  ACTIONS,
  CLOUD_FUNCTION_GAME,
  ERROR_CODES,
  LIMITS,
  payloadBytes,
  Action,
  CloudResponse,
} from "@shared/index";

const TIMEOUT_MS = 8000;
/** 只有幂等读操作允许自动重试，写操作绝不重试（避免重复提交） */
const RETRYABLE: readonly Action[] = ["loadSnapshot", "getProfile"];

function newRequestId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class CloudError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CloudError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** 兼容云函数返回字符串或对象两种形态，解析失败一律视为内部错误 */
function normalizeResult<T>(raw: unknown): CloudResponse<T> | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.success !== "boolean" || typeof r.code !== "string") return null;
  return r as unknown as CloudResponse<T>;
}

/**
 * 统一云调用：action 白名单、本地大小预检、超时、幂等读重试、统一错误码。
 * 日志只打印 action 与错误码，不打印 payload（可能含用户数据）与身份标识。
 */
export async function callGame<T = unknown>(
  action: Action,
  data?: unknown,
  opts?: { timeoutMs?: number },
): Promise<CloudResponse<T>> {
  if (!(ACTIONS as readonly string[]).includes(action)) {
    throw new CloudError(ERROR_CODES.INVALID_ACTION);
  }
  const payload: Record<string, unknown> = {
    action,
    data: data ?? {},
    requestId: newRequestId(),
  };
  if (payloadBytes(payload) > LIMITS.MAX_PAYLOAD_BYTES) {
    throw new CloudError(ERROR_CODES.PAYLOAD_TOO_LARGE);
  }
  const attempts = RETRYABLE.includes(action) ? 2 : 1;
  const requestId = payload.requestId as string;

  for (let i = 0; i < attempts; i++) {
    try {
      const res: any = await withTimeout(
        wx.cloud.callFunction({ name: CLOUD_FUNCTION_GAME, data: payload }),
        opts?.timeoutMs ?? TIMEOUT_MS,
      );
      const result = normalizeResult<T>(res && res.result);
      if (result) return result;
    } catch {
      // 不记录原始错误对象：可能包含请求上下文
    }
    if (i + 1 < attempts) continue;
    console.warn("[cloud] 调用失败", action, ERROR_CODES.INTERNAL);
    return {
      success: false,
      code: ERROR_CODES.INTERNAL,
      message: "网络异常，请稍后重试",
      requestId,
    };
  }
  return { success: false, code: ERROR_CODES.INTERNAL, requestId };
}

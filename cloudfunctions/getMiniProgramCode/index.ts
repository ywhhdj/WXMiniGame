import {
  init,
  DYNAMIC_CURRENT_ENV,
  getWXContext,
  openapi,
  uploadFile,
} from "wx-server-sdk";
import { ALLOWED_QR_PATHS, ERROR_CODES } from "./shared";
import {
  fail,
  ok,
  newRequestId,
  openidHash,
  logQrError,
  writeQrAudit,
} from "./utils";
import { checkQrRateLimit } from "./ratelimit";
import type { CloudResponse } from "./shared";

init({ env: DYNAMIC_CURRENT_ENV });

/**
 * 独立函数：只在自己身上挂 wxacode.get 权限，按天限流，cloudPath 随机化防覆盖。
 * 不在主业务函数里暴露，避免任何人刷 openapi 影响存档链路。
 */
export const main = async (event: unknown): Promise<CloudResponse> => {
  const started = Date.now();
  const requestId = newRequestId();
  const ctx = getWXContext();
  const openid = ctx.OPENID;
  const hash = openid ? openidHash(openid) : "anonymous";
  const record = async (code: string): Promise<void> => {
    await writeQrAudit({
      openidHash: hash,
      code,
      requestId,
      costMs: Date.now() - started,
    });
  };

  if (!openid || typeof openid !== "string") {
    await record(ERROR_CODES.UNAUTHORIZED);
    return fail(ERROR_CODES.UNAUTHORIZED, requestId);
  }
  const allowed = await checkQrRateLimit(openid);
  if (!allowed) {
    await record(ERROR_CODES.RATE_LIMITED);
    return fail(ERROR_CODES.RATE_LIMITED, requestId);
  }

  const e = (event && typeof event === "object" ? event : {}) as Record<string, unknown>;
  const data = (e.data && typeof e.data === "object" ? e.data : {}) as Record<string, unknown>;
  const path = typeof data.path === "string" ? data.path : "pages/index/index";
  if (!(ALLOWED_QR_PATHS as readonly string[]).includes(path)) {
    await record(ERROR_CODES.INVALID_PAYLOAD);
    return fail(ERROR_CODES.INVALID_PAYLOAD, requestId);
  }

  try {
    const resp = await openapi.wxacode.get({ path });
    const cloudPath = `qrcode/${hash}/${requestId}.png`;
    const uploaded = await uploadFile({ cloudPath, fileContent: resp.buffer });
    await record("OK");
    return ok({ fileID: uploaded.fileID }, requestId);
  } catch (err) {
    logQrError({ requestId, openidHash: hash, code: ERROR_CODES.INTERNAL }, err);
    await record(ERROR_CODES.INTERNAL);
    return fail(ERROR_CODES.INTERNAL, requestId);
  }
};

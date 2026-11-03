import { getWXContext } from "wx-server-sdk";
import { openidHash } from "./errors";

export interface Identity {
  openid: string;
  openidHash: string;
  appid: string | undefined;
}

/**
 * 唯一可信身份来源：微信上下文 OPENID。
 * 客户端传入的任何 openid / _openid 一律忽略；可选 APPID_ALLOWLIST 环境变量做跨应用校验。
 */
export function getIdentity(): Identity | null {
  const ctx = getWXContext();
  const openid = ctx.OPENID;
  if (
    !openid ||
    typeof openid !== "string" ||
    openid.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(openid)
  ) {
    return null;
  }
  const allow = (process.env.APPID_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length > 0 && ctx.APPID && !allow.includes(ctx.APPID)) {
    return null;
  }
  return { openid, openidHash: openidHash(openid), appid: ctx.APPID };
}

import { database } from "wx-server-sdk";
import { COLLECTIONS } from "./shared";

const db = database();
const _ = db.command;

function keyOf(openid: string, action: string, window: number): string {
  const s = `${openid}|${action}|${window}`;
  const fnv = (seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x9e3779b9);
}

/**
 * 基于 game_rate_limits 集合的原子计数限流（_.inc），以窗口哈希为 _id，expireAt 由 TTL 索引清理。
 * 限流组件自身异常时 fail-open 并告警，避免限流故障拖垮主业务。
 */
export async function checkRateLimit(
  openid: string,
  action: string,
  cfg: { windowMs: number; max: number },
): Promise<boolean> {
  const window = Math.floor(Date.now() / cfg.windowMs);
  const key = keyOf(openid, action, window);
  const expireAt = new Date((window + 1) * cfg.windowMs);
  const col = db.collection(COLLECTIONS.RATE);
  try {
    let current: { count?: number } | null = null;
    try {
      const res = await col.doc(key).get();
      current = res && res.data ? (res.data as { count?: number }) : null;
    } catch {
      current = null;
    }
    if (!current) {
      try {
        await col.add({ data: { _id: key, count: 1, expireAt } });
      } catch {
        // 并发创建同一窗口：另一个实例已建立计数，本次视为通过
      }
      return true;
    }
    if ((current.count ?? 0) >= cfg.max) return false;
    await col.doc(key).update({ data: { count: _.inc(1), expireAt } });
    return true;
  } catch (err) {
    console.warn(
      JSON.stringify({
        evt: "ratelimit_failopen",
        action,
        errType: err instanceof Error ? err.name : typeof err,
      }),
    );
    return true;
  }
}

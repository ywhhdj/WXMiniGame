import { database } from "wx-server-sdk";
import { COLLECTIONS, QR_RATE } from "./shared";

const db = database();
const _ = db.command;

function keyOf(openid: string, window: number): string {
  const s = `${openid}|getMiniProgramCode|${window}`;
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

export async function checkQrRateLimit(openid: string): Promise<boolean> {
  const window = Math.floor(Date.now() / QR_RATE.windowMs);
  const key = keyOf(openid, window);
  const expireAt = new Date((window + 1) * QR_RATE.windowMs);
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
        // 并发创建同一窗口
      }
      return true;
    }
    if ((current.count ?? 0) >= QR_RATE.max) return false;
    await col.doc(key).update({ data: { count: _.inc(1), expireAt } });
    return true;
  } catch (err) {
    console.warn(
      JSON.stringify({
        evt: "qr_ratelimit_failopen",
        errType: err instanceof Error ? err.name : typeof err,
      }),
    );
    return true;
  }
}

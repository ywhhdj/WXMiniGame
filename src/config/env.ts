/**
 * 环境配置：云环境 ID 与云存储文件 ID 的唯一落点。
 * 发布前用 `npm run inject:env` 按环境注入；`.env.local` 不入库。
 * 注意：云环境 ID 不是密钥（客户端必然可见），但必须集中管理以便多环境隔离与审计。
 */
/* ENV:BEGIN */
export const CLOUD_ENV = "";
export const AUDIO_CLOUD_FILE_IDS = [
  undefined,
  undefined,
] as const;
export const APPID_ALLOWLIST: readonly string[] = [];
/* ENV:END */

/** 随包内置的音频：离线可用，云存储临时链接失败时的回退资源 */
export const AUDIO_LOCAL_PATHS = [
  "/assets/audios/夏·烟火.mp3",
  "/assets/audios/穿越时空的思念钢琴版.m4a",
] as const;

export function isEnvConfigured(): boolean {
  return typeof CLOUD_ENV === "string" && CLOUD_ENV.length > 0;
}

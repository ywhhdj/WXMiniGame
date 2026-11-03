import { success } from "../errors";
import { clearMyData, getProfile } from "../repository";
import type { CloudResponse, ProfileResult } from "@shared/index";

export async function handleProfile(
  openid: string,
  requestId: string,
): Promise<CloudResponse<ProfileResult>> {
  return success(await getProfile(openid), requestId);
}

/** 隐私合规入口：仅删除当前 openid 的文档，不影响任何他人数据 */
export async function handleClear(
  openid: string,
  requestId: string,
): Promise<CloudResponse<{ cleared: boolean }>> {
  await clearMyData(openid);
  return success({ cleared: true }, requestId);
}

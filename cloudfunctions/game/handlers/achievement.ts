import { failure, success } from "../errors";
import { mergeAchievements } from "../repository";
import { validateSyncAchievementsRequest, CloudResponse } from "@shared/index";

export async function handleAchievements(
  openid: string,
  requestId: string,
  data: unknown,
): Promise<CloudResponse> {
  const checked = validateSyncAchievementsRequest(data);
  if (!checked.ok) return failure(checked.code, requestId);
  const result = await mergeAchievements(openid, checked.value);
  return success(result, requestId, result.version);
}

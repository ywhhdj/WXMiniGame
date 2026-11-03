import { failure, success } from "../errors";
import { mergeEndings } from "../repository";
import { validateSyncEndingsRequest, CloudResponse } from "@shared/index";

export async function handleEndings(
  openid: string,
  requestId: string,
  data: unknown,
): Promise<CloudResponse> {
  const checked = validateSyncEndingsRequest(data);
  if (!checked.ok) return failure(checked.code, requestId);
  const result = await mergeEndings(openid, checked.value);
  return success(result, requestId, result.version);
}

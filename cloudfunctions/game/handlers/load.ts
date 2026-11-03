import { success } from "../errors";
import { loadSnapshot } from "../repository";
import type { CloudResponse, LoadResult } from "@shared/index";

export async function handleLoad(
  openid: string,
  requestId: string,
): Promise<CloudResponse<LoadResult>> {
  const result = await loadSnapshot(openid);
  return success(result, requestId, result.version);
}

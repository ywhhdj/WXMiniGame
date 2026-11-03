import { failure, success } from "../errors";
import { saveSnapshot } from "../repository";
import { validateSaveRequest, CloudResponse } from "@shared/index";

export async function handleSave(
  openid: string,
  requestId: string,
  data: unknown,
): Promise<CloudResponse> {
  const checked = validateSaveRequest(data);
  if (!checked.ok) return failure(checked.code, requestId);
  const result = await saveSnapshot(
    openid,
    checked.value.snapshot,
    checked.value.expectedVersion,
  );
  return success(result, requestId, result.version);
}

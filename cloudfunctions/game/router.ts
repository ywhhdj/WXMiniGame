import {
  ERROR_CODES,
  RATE_LIMITS,
  CloudRequest,
  CloudResponse,
} from "./shared";
import { getIdentity } from "./auth";
import { checkRateLimit } from "./ratelimit";
import { ConflictError, failure, logError } from "./errors";
import { parseAction, parseRequestId, asRecord } from "./validate";
import { writeAudit } from "./repository";
import { handleLoad } from "./handlers/load";
import { handleSave } from "./handlers/save";
import { handleAchievements } from "./handlers/achievement";
import { handleEndings } from "./handlers/ending";
import { handleProfile, handleClear } from "./handlers/profile";

export async function route(event: unknown): Promise<CloudResponse> {
  const started = Date.now();
  const e = asRecord(event) as unknown as CloudRequest;
  const requestId = parseRequestId(e.requestId);
  const action = parseAction(e.action);
  let identity: ReturnType<typeof getIdentity> = null;

  const audit = async (code: string): Promise<void> => {
    await writeAudit({
      openidHash: identity?.openidHash ?? "anonymous",
      action: action ?? "unknown",
      code,
      requestId,
      costMs: Date.now() - started,
    });
  };

  try {
    identity = getIdentity();
    if (!action) {
      await audit(ERROR_CODES.INVALID_ACTION);
      return failure(ERROR_CODES.INVALID_ACTION, requestId);
    }
    if (!identity) {
      await audit(ERROR_CODES.UNAUTHORIZED);
      return failure(ERROR_CODES.UNAUTHORIZED, requestId);
    }
    const allowed = await checkRateLimit(identity.openid, action, RATE_LIMITS[action]);
    if (!allowed) {
      await audit(ERROR_CODES.RATE_LIMITED);
      return failure(ERROR_CODES.RATE_LIMITED, requestId);
    }

    let resp: CloudResponse;
    switch (action) {
      case "loadSnapshot":
        resp = await handleLoad(identity.openid, requestId);
        break;
      case "saveSnapshot":
        resp = await handleSave(identity.openid, requestId, e.data);
        break;
      case "syncAchievements":
        resp = await handleAchievements(identity.openid, requestId, e.data);
        break;
      case "syncEndings":
        resp = await handleEndings(identity.openid, requestId, e.data);
        break;
      case "getProfile":
        resp = await handleProfile(identity.openid, requestId);
        break;
      case "clearMyData":
        resp = await handleClear(identity.openid, requestId);
        break;
      default:
        resp = failure(ERROR_CODES.INVALID_ACTION, requestId);
        break;
    }
    await audit(resp.code);
    return resp;
  } catch (err) {
    if (err instanceof ConflictError) {
      const resp = failure(ERROR_CODES.CONFLICT, requestId, {
        data: err.snapshot,
        version: err.version,
      });
      await audit(ERROR_CODES.CONFLICT);
      return resp;
    }
    logError(
      {
        requestId,
        action: action ?? "unknown",
        code: ERROR_CODES.INTERNAL,
        costMs: Date.now() - started,
        openidHash: identity?.openidHash,
      },
      err,
    );
    await audit(ERROR_CODES.INTERNAL);
    return failure(ERROR_CODES.INTERNAL, requestId);
  }
}

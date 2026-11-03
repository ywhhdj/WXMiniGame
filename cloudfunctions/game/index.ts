import { init, DYNAMIC_CURRENT_ENV } from "wx-server-sdk";
import { route } from "./router";
import type { CloudResponse } from "./shared";

init({ env: DYNAMIC_CURRENT_ENV });

/** 唯一入口：所有请求经 router 做鉴权 / 限流 / 校验 / 审计，业务不直接碰数据库 */
export const main = async (event: unknown): Promise<CloudResponse> => route(event);

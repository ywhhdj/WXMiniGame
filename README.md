# 微信文字修仙小游戏 · 安全重构版

基于 `ywhhdj/WXMiniGame` main 分支重构。保留全部玩法与 UI（WXML/SCSS/资源），重做**数据结构、前后端分层、云函数与云数据库安全**。完整设计见 [重构合理规划项目.md](./重构合理规划项目.md)。

> 为什么要重构：原项目把客户端当成可信后端——云函数把 `event.data` 原样写进 `Users` 集合、无字段白名单/无大小限制/无版本号、成就与结局可任意伪造、二维码接口无鉴权限流、集合权限未声明。本项目把可信边界收拢到云函数，并用共享 schema 把前后端契约钉死。

## 架构一览

```
miniprogram/                 小程序（原 src/，UI 与资源保留）
  services/  cloud → repository → storage / gameState     ← 唯一数据通道
  shared/                    共享契约副本（由 sync-shared.js 生成）
  config/env.ts              环境配置（inject:env 注入）
cloudfunctions/
  game/                      主业务：router → auth / validate / ratelimit → handlers → repository
  getMiniProgramCode/        二维码专用：独立最小权限 + 按天限流
shared/                      ★ 唯一真源：constants / types / schema（零运行时依赖）
database/  docs/  scripts/  .github/
```

所有写入都经过 `shared/schema.ts` 白名单构造；数据库集合**仅云函数可读写**；每次保存用 `version` 做 CAS；所有调用带审计日志与频率限制。

## 快速开始

```bash
# 1. 安装开发依赖（TypeScript / 小程序类型）
npm install

# 2. 按环境注入云环境 ID 与云存储 fileID（.env.local 不入库）
cp .env.example .env.local
#    编辑 .env.local
npm run inject:env

# 3. 同步共享契约到小程序与两个云函数
npm run sync:shared

# 4. 校验（CI 执行同一套命令）
npm run validate:plots      # 剧情数据引用与枚举
npm run typecheck           # 共享层 + 云函数类型检查
npm run build:shared && npm test   # 校验器自测（注入/超长/伪造等 20 例）
npm run build:cloud         # 编译云函数 TS → JS

# 5. 微信开发者工具导入项目根目录，按 database/权限配置.md 配置集合与索引
# 6. 上传云函数（需 WECHAT_CLI 指向开发者工具 CLI）
WECHAT_CLI=/path/to/cli npm run deploy:cloud -- <envId>
```

微信开发者工具中还需开启「云开发」、创建与 `.env.local` 中 `CLOUD_ENV` 一致的环境；小程序类型由 `miniprogram-api-typings` 提供，务必先 `npm install`。

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm run sync:shared` / `sync:shared:check` | 同步 / 校验三处 shared 副本一致性 |
| `npm run inject:env` / `env:check` / `env:restore` | 注入 / 校验 / 还原环境配置 |
| `npm run validate:plots` | 剧情 JSON 结构、引用、枚举、环检测 |
| `npm run typecheck` | `tsconfig.shared.json` + `tsconfig.cloud.json` 类型检查 |
| `npm run build:shared && npm test` | 编译共享层并跑校验器自测 |
| `npm run build:cloud` | 编译两个云函数 |
| `npm run deploy:cloud -- <envId>` | 校验后逐个部署云函数 |

## 数据模型

`game_users` 集合，一个用户一个文档（`_id = openid`，由服务端指定）：

```ts
{
  schemaVersion: 2,
  version: number,            // 乐观锁，每次成功写入 +1
  currentRole: Role | null,   // 固定字段，无任意键
  saves: SaveItem[],          // ≤3，每条自带完整 role 快照
  achievements: string[],     // ≤64，值必须在 ACHIEVEMENT_IDS 白名单
  endings: EndingRecord[],    // ≤64，sceneId / endingKey 必须合法
  createdAt, updatedAt       // 服务端时间，客户端不可覆盖
}
```

辅助集合：`game_audit_logs`（只写审计，TTL 90 天）、`game_rate_limits`（原子计数，TTL 自动清理）。旧 `Users` 集合在迁移期**只读兼容**，确认无旧客户端后删除。

## 云函数接口

`game` 的 `action` 白名单：`loadSnapshot | saveSnapshot | syncAchievements | syncEndings | getProfile | clearMyData`。
二维码走独立函数 `getMiniProgramCode`，仅允许 `pages/index/index`，3 次/日，cloudPath 随机化防覆盖。

统一响应：`{ success, code, message?, data?, version?, requestId }`。错误码见 `shared/constants.ts` 与 [docs/安全设计.md](./docs/安全设计.md)。**任何异常都不回传内部原文**。

## 安全基线（对应规划风险矩阵）

- 身份只取 `getWXContext().OPENID`；不下发 `openid/appid/unionid`；日志用哈希脱敏。
- 入参逐字段白名单构造，拒绝 `$` 开头键、含 `.` 键、`__proto__` 等危险键；64 KB 上限、字符串/数组/数值范围限制。
- 集合权限「仅云函数可读写」，客户端不出现 `wx.cloud.database()` 直连。
- `version` CAS 防多端覆盖；冲突返回 `E3001_CONFLICT` + 最新快照，客户端合并后重试。
- 成就/结局服务端单调并集（只增不减）+ 白名单，杜绝刷取与伪删。
- 分 action 限流；二维码独立函数独立配额；限流组件异常 fail-open 并告警。
- 每次调用写审计日志；`E5001_INTERNAL` 只记录脱敏上下文。
- `uploadWithSourceMap: false`、`urlCheck: true`、`sitemap` 默认 disallow、依赖锁版本、CI 依赖审计。
- 提供 `clearMyData` 与本地清除能力，配合《用户隐私保护指引》声明收集范围。

## 明确的残余风险

> 本项目是**单机养成文字游戏，无交易、无 PVP、无排行榜**。客户端数值天然不可信，因此采用「服务端边界校验 + 枚举白名单 + 数值范围 + 审计」，**没有**做服务端权威结算。客户端仍可在合法范围内本地改属性后提交。这不构成资损，但**不可用于排行榜、成就真实性证明或任何付费校验**。若后续引入排行榜，必须把剧情推进与数值计算迁移到云函数，客户端只上送「选择了哪个选项」，由服务端按剧情配置重算落库。

## 迁移与运维

见 [docs/数据迁移与回滚.md](./docs/数据迁移与回滚.md)、[docs/部署运维.md](./docs/部署运维.md)、[docs/验收清单.md](./docs/验收清单.md)。

## 目录说明

| 路径 | 说明 |
|---|---|
| `shared/` | 前后端共享契约唯一真源，改动后必须 `npm run sync:shared` |
| `miniprogram/` | 小程序根（`project.config.json` 的 `miniprogramRoot`） |
| `cloudfunctions/game/` | 主业务云函数，分层：router / middleware / handlers / repository |
| `cloudfunctions/getMiniProgramCode/` | 二维码云函数，独立权限与配额 |
| `database/` | 集合初始化脚本与权限配置说明 |
| `scripts/` | 构建、部署、注入、校验、自测脚本 |
| `docs/` | 安全、迁移、运维、验收文档 |

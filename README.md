# 微信文字修仙小游戏


## 文件结构

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
cp .env.example .env
#    编辑 .env
pnpm run inject:env

# 3. 同步共享契约到小程序与两个云函数
pnpm run sync:shared

# 4. 校验（CI 执行同一套命令）
pnpm run validate:plots      # 剧情数据引用与枚举
pnpm run typecheck           # 共享层 + 云函数类型检查
pnpm run build:shared && npm test   # 校验器自测（注入/超长/伪造等 20 例）
pnpm run build:cloud         # 编译云函数 TS → JS

# 5. 微信开发者工具导入项目根目录，按 database/权限配置.md 配置集合与索引
# 6. 上传云函数（需 WECHAT_CLI 指向开发者工具 CLI）
WECHAT_CLI=/path/to/cli pnpm run deploy:cloud -- <envId>
```

微信开发者工具中还需开启「云开发」、创建与 `.env` 中 `CLOUD_ENV` 一致的环境；小程序类型由 `miniprogram-api-typings` 提供，务必先 `npm install`。

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

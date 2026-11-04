#!/usr/bin/env node
/** 把纯 TS 的 shared/ 转译为 CommonJS 到 .build/shared/，供 selftest.js 直接 require。 */
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require(process.env.TYPESCRIPT_JS || 'typescript');
} catch {
  console.error('[build:shared] 缺少 typescript，请先执行 pnpm install');
  process.exit(1);
}
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'shared');
const OUT = path.join(ROOT, '.build/shared');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.ts'))) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  const js = ts.transpileModule(code, {
    compilerOptions: { 
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: f,
  }).outputText;
  fs.writeFileSync(path.join(OUT, f.replace(/\.ts$/, '.js')), js, 'utf8');
}
console.log('[build:shared] 已生成 .build/shared/*.js');

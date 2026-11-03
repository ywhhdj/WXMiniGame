#!/usr/bin/env node
'use strict';
/**
 * 按环境注入云环境 ID / 云存储 fileID / appid 白名单。
 * 用法：
 *   node scripts/inject-env.js            读取 .env.local（不入库）与 process.env
 *   node scripts/inject-env.js --check    校验 env.ts 的注入区块完整
 *   node scripts/inject-env.js --restore  还原为仓库默认值（提交前执行）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'src/config/env.ts');
const DOTENV = path.join(ROOT, '.env.local');
const BEGIN = '/* ENV:BEGIN */';
const END = '/* ENV:END */';

const DEFAULTS = {
  CLOUD_ENV: 'cloud1-d5g13xntx36481a06',
  AUDIO_FILE_ID_1: 'cloud://cloud1-d5g13xntx36481a06.636c-cloud1-d5g13xntx36481a06-1438972521/夏·烟火.mp3',
  AUDIO_FILE_ID_2: 'cloud://cloud1-d5g13xntx36481a06.636c-cloud1-d5g13xntx36481a06-1438972521/穿越时空的思念钢琴版.m4a',
  APPID_ALLOWLIST: '',
};

function readDotEnv() {
  if (!fs.existsSync(DOTENV)) return {};
  const out = {};
  for (const line of fs.readFileSync(DOTENV, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function buildBlock(v) {
  const list = v.APPID_ALLOWLIST
    ? v.APPID_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return [
    BEGIN,
    `export const CLOUD_ENV = ${JSON.stringify(v.CLOUD_ENV)};`,
    'export const AUDIO_CLOUD_FILE_IDS = [',
    `  ${JSON.stringify(v.AUDIO_FILE_ID_1)},`,
    `  ${JSON.stringify(v.AUDIO_FILE_ID_2)},`,
    '] as const;',
    `export const APPID_ALLOWLIST: readonly string[] = ${JSON.stringify(list)};`,
    END,
  ].join('\n');
}

function replaceBlock(block) {
  const src = fs.readFileSync(TARGET, 'utf8');
  const a = src.indexOf(BEGIN);
  const b = src.indexOf(END);
  if (a < 0 || b < 0 || b < a) {
    console.error('[inject:env] env.ts 缺少 ENV:BEGIN / ENV:END 标记');
    process.exit(1);
  }
  fs.writeFileSync(TARGET, src.slice(0, a) + block + src.slice(b + END.length), 'utf8');
}

const args = process.argv.slice(2);
if (args.includes('--restore')) {
  replaceBlock(buildBlock(DEFAULTS));
  console.log('[inject:env] 已还原为仓库默认配置');
  process.exit(0);
}
if (args.includes('--check')) {
  const src = fs.readFileSync(TARGET, 'utf8');
  const ok = src.includes(BEGIN) && src.includes(END) && /export const CLOUD_ENV = ".+";/.test(src);
  console.log(ok ? '[inject:env] env.ts 注入区块完整' : '[inject:env] env.ts 注入区块缺失或不完整');
  process.exit(ok ? 0 : 1);
}

const values = { ...DEFAULTS, ...readDotEnv() };
for (const k of Object.keys(DEFAULTS)) {
  if (process.env[k]) values[k] = process.env[k];
}
if (!values.CLOUD_ENV) {
  console.error('[inject:env] CLOUD_ENV 不能为空');
  process.exit(1);
}
replaceBlock(buildBlock(values));
console.log(`[inject:env] 已注入 CLOUD_ENV=${values.CLOUD_ENV}（请勿提交 .env.local）`);

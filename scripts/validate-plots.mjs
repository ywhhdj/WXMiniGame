#!/usr/bin/env node
/**
 * 剧情 JSON 完整性校验：结构、引用、枚举、文本长度、环、境界标记。
 * 不依赖第三方库，可直接在 CI 与本地运行。
 */
import * as path from 'path';
import * as fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILE = path.resolve(__dirname, '../src/assets/data/game_plots.json');
const ATTR_IDS = ['potential', 'root', 'wit', 'chance', 'goodness'];
const STORY_TRAITS = ['至尊骨', '吾辈楷模', '头铁', '后天木灵'];
const LEVEL_NAMES = ['练气期', '筑基期', '金丹期', '元婴期', '化神期'];
/** 终止标记：不是真实节点，显式白名单，避免把 end/end_1 误判为悬空引用 */
const TERMINAL_NODES = new Set(['end', 'end_1']);
const MAX_TEXT = 2000;
const NODE_KEY_ALLOW = new Set([
  'id', 'text', 'next', 'attrs', 'traits', 'options', 'isLevelUpNode'
]);
const OPTION_KEY_ALLOW = new Set(['id', 'text', 'choice', 'attrs', 'traits', 'next']);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

let plots;
try {
  plots = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error('[validate:plots] JSON 解析失败:', e.message);
  process.exit(1);
}
const nodes = plots.nodes || {};
const ids = new Set(Object.keys(nodes));
const isRef = (r) => ids.has(r) || TERMINAL_NODES.has(r);

const checkAttrs = (attrs, where) => {
  if (!isObj(attrs)) { err(`${where}.attrs 必须是对象`); return; }
  for (const kind of Object.keys(attrs)) {
    if (kind !== 'reward' && kind !== 'punish') { err(`${where}.attrs.${kind} 非法的效果类型`); continue; }
    const list = attrs[kind];
    if (!Array.isArray(list)) { err(`${where}.attrs.${kind} 必须是数组`); continue; }
    list.forEach((a, i) => {
      if (!isObj(a) || !ATTR_IDS.includes(a.type) || typeof a.value !== 'number' || !Number.isFinite(a.value)) {
        err(`${where}.attrs.${kind}[${i}] 非法（type 枚举 / value 有限数字）`);
      }
    });
  }
};
const checkText = (text, where) => {
  if (!Array.isArray(text) || text.length === 0) { err(`${where}.text 必须是非空数组`); return; }
  text.forEach((t, i) => {
    if (typeof t !== 'string') err(`${where}.text[${i}] 必须是字符串`);
    else if (t.length > MAX_TEXT) err(`${where}.text[${i}] 超过 ${MAX_TEXT} 字`);
  });
};
const checkTraits = (traits, where) => {
  if (traits === undefined) return;
  if (!Array.isArray(traits)) { err(`${where}.traits 必须是数组`); return; }
  traits.forEach((t, i) => { if (!STORY_TRAITS.includes(t)) err(`${where}.traits[${i}] "${t}" 不在剧情词条白名单`); });
};

// 顶层结构
for (const key of ['names', 'startNodes', 'nodes', 'levelUp']) {
  if (!(key in plots)) err(`顶层缺少 ${key}`);
}
if (!Array.isArray(plots.startNodes) || plots.startNodes.length === 0) err('startNodes 必须是非空数组');
else plots.startNodes.forEach((s) => { if (!ids.has(s)) err(`startNodes 引用了不存在的节点 ${s}`); });
if (!isObj(plots.names) || !('girl' in plots.names) || !('boy' in plots.names)) err('names 必须包含 girl / boy');

// 节点
for (const [key, node] of Object.entries(nodes)) {
  const where = `nodes.${key}`;
  if (!isObj(node)) { err(`${where} 必须是对象`); continue; }
  if (node.id !== key) err(`${where}.id "${node.id}" 与键名不一致`);
  checkText(node.text, where);
  if (typeof node.next !== 'string' || !isRef(node.next)) err(`${where}.next "${node.next}" 是悬空引用`);
  for (const k of Object.keys(node)) {
    if (!NODE_KEY_ALLOW.has(k)) warn(`${where} 存在未声明字段 ${k}`);
  }
  if ('isLevelUpNone' in node) {
    warn(`${where} 使用了 isLevelUpNone（拼写错误）；GamePlot 只识别 isLevelUpNode，请改名`);
  }
  if ('isLevelUpNode' in node && typeof node.isLevelUpNode !== 'boolean') err(`${where}.isLevelUpNode 必须是布尔值`);
  if (node.attrs !== undefined) checkAttrs(node.attrs, where);
  checkTraits(node.traits, where);
  if (node.options !== undefined) {
    if (!Array.isArray(node.options)) { err(`${where}.options 必须是数组`); continue; }
    node.options.forEach((o, i) => {
      const ow = `${where}.options[${i}]`;
      if (!isObj(o)) { err(`${ow} 必须是对象`); return; }
      checkText(o.text, ow);
      if (typeof o.choice !== 'string') err(`${ow}.choice 必须是字符串`);
      for (const k of Object.keys(o)) if (!OPTION_KEY_ALLOW.has(k)) warn(`${ow} 存在未声明字段 ${k}`);
      if (o.attrs !== undefined) checkAttrs(o.attrs, ow);
      checkTraits(o.traits, ow);
      if (o.next !== undefined && (typeof o.next !== 'string' || !isRef(o.next))) err(`${ow}.next "${o.next}" 是悬空引用`);
    });
  }
}

// 境界配置
if (isObj(plots.levelUp)) {
  for (const lv of LEVEL_NAMES) {
    if (!isObj(plots.levelUp[lv])) { err(`levelUp 缺少 ${lv}`); continue; }
    for (const field of ['successNode', 'failNode', 'upNode']) {
      const r = plots.levelUp[lv][field];
      if (r === undefined) warn(`levelUp.${lv} 缺少 ${field}（前端当前未使用，建议补齐）`);
      else if (!isRef(r)) err(`levelUp.${lv}.${field} "${r}" 是悬空引用`);
    }
  }
}

// 环检测（从起始节点沿 next 与 option.next 遍历）
const color = new Map();
const cycles = [];
const dfs = (id, stack) => {
  if (TERMINAL_NODES.has(id)) return;
  if (!ids.has(id)) return;
  if (color.get(id) === 1) { cycles.push([...stack, id].join(' -> ')); return; }
  if (color.get(id) === 2) return;
  color.set(id, 1);
  const n = nodes[id];
  const nexts = [n.next, ...(n.options || []).map((o) => o.next).filter(Boolean)];
  for (const nx of nexts) dfs(nx, [...stack, id]);
  color.set(id, 2);
};
for (const s of plots.startNodes || []) dfs(s, []);
cycles.forEach((c) => warn(`检测到剧情回环: ${c}（确认是否为设计意图）`));

const optionCount = Object.values(nodes).reduce((n, v) => n + (v.options ? v.options.length : 0), 0);
console.log(`[validate:plots] 节点 ${ids.size} 个，选项 ${optionCount} 个，终止标记 ${[...TERMINAL_NODES].join('/')}`);
warnings.forEach((w) => console.warn(`  WARN  ${w}`));
errors.forEach((e) => console.error(`  ERROR ${e}`));
if (errors.length) {
  console.error(`[validate:plots] 失败：${errors.length} 个错误`);
  process.exit(1);
}
console.log(`[validate:plots] 通过（${warnings.length} 条提示）`);

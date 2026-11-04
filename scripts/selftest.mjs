#!/usr/bin/env node
/**
 * 共享校验器自测：注入、超长、超大、伪造成就/结局、非法存档 ID、版本冲突参数等。
 * 运行前先执行 npm run build:shared。
 */
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.build/shared');

let S;
let C;
try {
  S = require(path.join(OUT, 'schema.js'));
  C = require(path.join(OUT, 'constants.js'));
} catch (e) {
  console.error('[selftest] 找不到编译产物，请先执行 npm run build:shared');
  process.exit(1);
}

function makeRole() {
  const els = {};
  C.ELEMENT_IDS.forEach((id, i) => {
    els[id] = { name: C.ELEMENT_NAMES[i], level: 0, leveName: '初级' };
  });
  const attrs = {};
  C.ATTR_IDS.forEach((id, i) => { attrs[id] = { val: 10 + i, name: C.ATTR_NAMES[i] }; });
  return {
    currentNode: 'node_1', gender: 'girl', name: '测试角色',
    avatar: '/assets/images/roles/girl.webp', age: 1,
    level: { level: 0, name: '练气期' }, elements: els, attributes: attrs,
    traits: [],
  };
}
function makeSave(role) {
  return {
    id: 1700000000000001, name: '测试角色', gender: 'girl',
    avatar: '/assets/images/roles/girl.webp', age: 1,
    level: { level: 0, name: '练气期' }, elements: role.elements,
    attributes: role.attributes, time: '2026.11.02 12:00', preview: '故事从这里开始…',
    currentNodeId: 'node_1', role,
  };
}
function makeSnapshot() {
  const role = makeRole();
  return {
    schemaVersion: 2, version: 3,
    currentRole: role, saves: [makeSave(role)],
    achievements: ['first_step'], endings: [{ sceneId: 'cultivation-start', endingKey: 'C1-A2' }],
    updatedAt: '2026-11-02T00:00:00.000Z',
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

const cases = [
  ['合法快照应通过', () => S.validateSnapshot(makeSnapshot()), (r) => r.ok === true],
  ['合法保存请求应通过', () => S.validateSaveRequest({ snapshot: makeSnapshot(), expectedVersion: 3 }), (r) => r.ok === true],
  ['合法成就同步应通过', () => S.validateSyncAchievementsRequest({ ids: ['first_step', 'foundation'] }), (r) => r.ok === true],
  ['合法结局同步应通过', () => S.validateSyncEndingsRequest({ endings: [{ sceneId: 'first-tribulation', endingKey: 'D1-B2' }] }), (r) => r.ok === true],
  ['$inc 操作符注入应被拒绝', () => S.validateSnapshot({ ...makeSnapshot(), $inc: { version: 999 } }), (r) => r.ok === false && r.code === C.ERROR_CODES.FORBIDDEN_FIELD],
  ['原型污染键应被拒绝', () => S.validateSnapshot(JSON.parse('{"currentRole":null,"__proto__":{"polluted":true},"saves":[],"achievements":[],"endings":[]}')), (r) => r.ok === false && r.code === C.ERROR_CODES.FORBIDDEN_FIELD],
  ['含点号的键应被拒绝', () => S.validateSnapshot({ ...makeSnapshot(), 'a.b': 1 }), (r) => r.ok === false && r.code === C.ERROR_CODES.FORBIDDEN_FIELD],
  ['超 64KB 应被拒绝', () => S.validateSnapshot({ ...makeSnapshot(), currentRole: { ...makeRole(), name: 'x'.repeat(70000) } }), (r) => r.ok === false && r.code === C.ERROR_CODES.PAYLOAD_TOO_LARGE],
  ['伪造成就 ID 应被拒绝', () => S.validateSyncAchievementsRequest({ ids: ['not_exist'] }), (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['伪造结局 key 应被拒绝', () => S.validateSyncEndingsRequest({ endings: [{ sceneId: 'cultivation-start', endingKey: 'HACK-1' }] }), (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['伪造场景 ID 应被拒绝', () => S.validateSyncEndingsRequest({ endings: [{ sceneId: 'fake-scene', endingKey: 'C1-A2' }] }), (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['超过 3 个存档应被拒绝', () => { const s = makeSnapshot(); s.saves = [makeSave(makeRole()), makeSave(makeRole()), makeSave(makeRole()), makeSave(makeRole())]; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.QUOTA_EXCEEDED],
  ['短存档 ID 应被拒绝', () => { const s = makeSnapshot(); s.saves[0].id = 123; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['存档缺少 role 快照应被拒绝', () => { const s = makeSnapshot(); delete s.saves[0].role; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['外链 avatar 应被拒绝', () => { const s = makeSnapshot(); s.currentRole.avatar = 'https://evil.example/a.png'; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['负数期望版本应被拒绝', () => S.validateSaveRequest({ snapshot: makeSnapshot(), expectedVersion: -1 }), (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['属性值越界应被拒绝', () => { const s = makeSnapshot(); s.currentRole.attributes.potential.val = 1e9; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['超长字符串应被拒绝', () => { const s = makeSnapshot(); s.currentRole.name = 'a'.repeat(100); return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['控制字符应被拒绝', () => { const s = makeSnapshot(); s.currentRole.name = 'a\u0000b'; return S.validateSnapshot(s); }, (r) => r.ok === false && r.code === C.ERROR_CODES.INVALID_PAYLOAD],
  ['深层嵌套应被拒绝', () => { let o = {}; let cur = o; for (let i = 0; i < 12; i++) { cur.n = {}; cur = cur.n; } return S.checkEnvelope(o); }, (r) => r.ok === false && r.code === C.ERROR_CODES.FORBIDDEN_FIELD],
];

let pass = 0;
let fail = 0;
for (const [name, run, assert] of cases) {
  let r;
  try { r = run(); } catch (e) { r = { ok: false, code: 'THREW', message: String(e) }; }
  const good = assert(r);
  if (good) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.error(`  FAIL  ${name} -> ${JSON.stringify(r)}`); }
}
console.log(`[selftest] ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
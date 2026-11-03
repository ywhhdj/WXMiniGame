/**
 * 云数据库初始化脚本。
 * 用法：把本文件作为临时云函数上传并在云开发控制台调用一次，或在「云开发控制台 → 数据库」
 * 中按下方清单手工创建集合与索引。脚本只创建集合，索引与权限需在控制台配置。
 */
import{
  init,
  DYNAMIC_CURRENT_ENV,
  database
} from 'wx-server-sdk';
init({ env: DYNAMIC_CURRENT_ENV });

const COLLECTIONS = [
  'game_users',
  'game_audit_logs',
  'game_rate_limits',
];

/** 需要在控制台手工创建的索引 */
const INDEXES = [
  { collection: 'game_users', name: 'idx_updatedAt', keys: { updatedAt: -1 }, note: '运维扫描用，非唯一' },
  { collection: 'game_audit_logs', name: 'idx_ts', keys: { ts: -1 }, note: '按时间查询审计' },
  { collection: 'game_audit_logs', name: 'ttl_expireAt', keys: { expireAt: 1 }, note: 'TTL 索引，90 天自动清理' },
  { collection: 'game_rate_limits', name: 'ttl_expireAt', keys: { expireAt: 1 }, note: 'TTL 索引，限流窗口自动清理' },
];

export const main = async () => {
  const db = database();
  const created:string[] = [];
  const existed:string[] = [];
  for (const name of COLLECTIONS) {
    try {
      await db.collection(name);
      created.push(name);
    } catch (err) {
      existed.push(name);
    }
  }
  return {
    created,
    existed,
    indexesToCreate: INDEXES,
    permissions: '全部业务集合设为「仅云函数可读写」；详见 database/权限配置.md',
    legacy: '旧 Users 集合迁移期只读保留，确认无旧客户端调用后删除',
  };
};

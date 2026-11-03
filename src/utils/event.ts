type Listener = (...args: any[]) => void;

/**
 * 轻量事件总线（见 优化.md §3.2）
 * - Set 存储：同一回调重复 on 不会累积，避免多页面切换后监听数线性增长
 * - on 返回 unsubscribe，便于组件 detached 精确解绑
 * - emit 用快照迭代：回调内 off/on 不会导致本次分发跳过或重复
 * - 单个 listener 抛错不影响其余订阅者
 */
class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    const snapshot = Array.from(set);
    for (const listener of snapshot) {
      try {
        listener(...args);
      } catch (err) {
        console.error("[eventbus] listener error:", event, err);
      }
    }
  }

  clean(): void {
    this.listeners.clear();
  }

  /** 调试用：查询某事件（或全部）的监听数量 */
  listenerCount(event?: string): number {
    if (event) return this.listeners.get(event)?.size || 0;
    let total = 0;
    this.listeners.forEach((set) => { total += set.size; });
    return total;
  }
}

const event = new EventBus();
export default event;

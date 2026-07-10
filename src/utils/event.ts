class EventBus {
  private listeners = new Map<string, Function[]>();
  on(event: string, listener: (...args: any[])=>void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  off(event: string, listener: Function) {
    if (this.listeners.has(event)) {
      const index = this.listeners.get(event)!.indexOf(listener);
      if (index > -1) {
        this.listeners.get(event)!.splice(index, 1);
      }
    }
  }
  emit(event: string, ...args: any[]) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => listener(...args));
    }
  }
  clean(){
    this.listeners.clear();
  }
}
const event = new EventBus();
export default event;
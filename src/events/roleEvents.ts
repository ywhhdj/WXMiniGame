import events from "../utils/event";
enum RoleEventType {
  AgeChanged = 'role:age:changed',
  AttrsChanged = 'role:attrs:changed',
  LevelChanged = 'role:level:changed',
  NodeChanged = 'role:node:changed',
  TraitsChanged = 'role:traits:changed',
}

export function onAgeChanged(fn:(age: number) => void){
  events.on(RoleEventType.AgeChanged,fn);
}

export function offAgeChanged(fn:(age: number) => void){
  events.off(RoleEventType.AgeChanged,fn);
}

export function emitAgeChanged(age: number){
  events.emit(RoleEventType.AgeChanged,age);
}

export function onArtsChanged(fn:(arts: AppGame.PlotAttrs) => void){
  events.on(RoleEventType.AttrsChanged,fn);
}

export function offArtsChanged(fn:(arts: AppGame.PlotAttrs) => void){
  events.off(RoleEventType.AttrsChanged,fn);
}

export function emitArtsChanged(arts: AppGame.PlotAttrs){
  events.emit(RoleEventType.AttrsChanged,arts);
}

export function onLevelChanged(fn:(level: AppGame.Level) => void){
  events.on(RoleEventType.LevelChanged,fn);
}

export function offLevelChanged(fn:(level: AppGame.Level) => void){
  events.off(RoleEventType.LevelChanged,fn);
}

export function emitLevelChanged(level: AppGame.Level){
  events.emit(RoleEventType.LevelChanged,level);
}

export function onNodeChanged(fn:() => void){
  events.on(RoleEventType.NodeChanged,fn);
}

export function offNodeChanged(fn:() => void){
  events.off(RoleEventType.NodeChanged,fn);
}

export function emitNodeChanged(){
  events.emit(RoleEventType.NodeChanged);
}

export function onTraitsChanged(fn:(traits: AppGame.TraitsItem[]) => void){
  events.on(RoleEventType.TraitsChanged,fn);
}

export function offTraitsChanged(fn:(traits: AppGame.TraitsItem[]) => void){
  events.off(RoleEventType.TraitsChanged,fn);
}

export function emitTraitsChanged(traits: AppGame.TraitsItem[]){
  events.emit(RoleEventType.TraitsChanged,traits);
}
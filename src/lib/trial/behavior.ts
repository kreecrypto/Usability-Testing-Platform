import { FIRST_PARTY_BRIDGE_PROTOCOL, FIRST_PARTY_BRIDGE_PROTOCOL_VERSION } from '../web/first-party-message-bridge.ts';
import type { Store, Version, Evidence } from './model.ts';
export const SIMULATION_LAYOUT = 'utp-housing-v1';
export const simulatedScreens = ['dashboard','houses','house18','house12','repairs','repairDetail'] as const;
export const screenName = (screen: string) => ({dashboard:'ภาพรวม',houses:'บ้านทั้งหมด',house18:'บ้านเลขที่ 18/9',house12:'บ้านเลขที่ 12/4',repairs:'งานซ่อม',repairDetail:'รายละเอียดงานซ่อม'}[screen] || screen);
export type BehaviorEvent = {
  id: string; sessionId: string; versionId: string; taskId: string; sequence: number; at: string;
  type: 'screen_view'|'pointer'|'action'|'scroll'; screenId: string; layoutVersion: string;
  viewportWidth: number; viewportHeight: number; documentWidth: number; documentHeight: number;
  documentX?: number; documentY?: number; elementId?: string; previousScreenId?: string;
  transitionReason?: string; scrollX?: number; scrollY?: number;
};
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function validBehavior(e: BehaviorEvent): boolean {
  return Boolean(e && ['id','sessionId','versionId','taskId','at'].every(k => typeof e[k as keyof BehaviorEvent] === 'string' && e[k as keyof BehaviorEvent])
    && Number.isFinite(Date.parse(e.at)) && Number.isSafeInteger(e.sequence) && e.sequence > 0
    && ['screen_view','pointer','action','scroll'].includes(e.type) && simulatedScreens.includes(e.screenId as typeof simulatedScreens[number])
    && e.layoutVersion === SIMULATION_LAYOUT && [e.viewportWidth,e.viewportHeight,e.documentWidth,e.documentHeight].every(v=>finite(v) && v>0 && v<=20000)
    && (e.type === 'pointer' ? finite(e.documentX) && finite(e.documentY) && e.documentX <= e.documentWidth && e.documentY <= e.documentHeight : e.documentX === undefined && e.documentY === undefined)
    && (e.elementId === undefined || /^[a-zA-Z0-9_-]{1,80}$/.test(e.elementId))
    && (e.scrollX === undefined || finite(e.scrollX) && e.scrollX <= e.documentWidth)
    && (e.scrollY === undefined || finite(e.scrollY) && e.scrollY <= e.documentHeight)
    && (e.previousScreenId === undefined || simulatedScreens.includes(e.previousScreenId as typeof simulatedScreens[number]))
    && (e.transitionReason === undefined || ['resize','reload','navigate','navigation','back'].includes(e.transitionReason)));
}
export function behaviorMessage(message: {origin:string;source:unknown;data:unknown}, expectedOrigin:string, expectedSource:unknown,
  context: Pick<BehaviorEvent,'sessionId'|'versionId'|'taskId'|'sequence'>): BehaviorEvent | null {
  if (!expectedSource || message.origin !== expectedOrigin || message.source !== expectedSource) return null;
  const p = message.data as {protocol?:string;version?:number;type?:string;data?:Record<string,unknown>} | null;
  if (!p || p.protocol !== FIRST_PARTY_BRIDGE_PROTOCOL || p.version !== FIRST_PARTY_BRIDGE_PROTOCOL_VERSION || !p.data) return null;
  const d=p.data;
  const e = { ...context, id:crypto.randomUUID(), at:new Date().toISOString(), type:p.type, screenId:d.screenId,
    layoutVersion:d.layoutVersion,viewportWidth:d.viewportWidth,viewportHeight:d.viewportHeight,documentWidth:d.documentWidth,documentHeight:d.documentHeight,
    ...(p.type === 'pointer' ? {documentX:d.documentX,documentY:d.documentY}:{}),
    ...(['pointer','scroll'].includes(p.type || '') ? {scrollX:d.scrollX,scrollY:d.scrollY}:{}),
    ...(typeof d.elementId === 'string' ? {elementId:d.elementId}:{}),
    ...(typeof d.previousScreenId === 'string' ? {previousScreenId:d.previousScreenId}:{}),
    ...(typeof d.transitionReason === 'string' ? {transitionReason:d.transitionReason}:{}) } as BehaviorEvent;
  return validBehavior(e) ? e : null;
}
export function appendBehavior(store:Store, event:BehaviorEvent):Store {
  const existing=(store.behaviorEvents || []).find(e=>e.id===event.id);
  if (existing) {
    if (JSON.stringify(existing)!==JSON.stringify(event)) throw new Error('รหัสเหตุการณ์ซ้ำแต่ข้อมูลไม่ตรงกัน');
    return store;
  }
  const session=store.sessions.find(s=>s.id===event.sessionId);
  const version=store.versions.find(v=>v.id===event.versionId);
  if (!validBehavior(event) || !session?.behaviorConsentAt || session.submittedAt || session.versionId!==event.versionId
    || version?.target?.kind!=='simulation' || version.target.layoutVersion!==event.layoutVersion
    || version.tasks.find(t=>!session.answers.some(a=>a.taskId===t.id))?.id!==event.taskId)
    throw new Error('รับพฤติกรรมไม่ได้: ต้องยินยอมและอยู่ในโจทย์ที่กำลังทำ');
  if ((store.behaviorEvents||[]).some(e=>e.sessionId===event.sessionId && e.sequence===event.sequence)) throw new Error('ลำดับเหตุการณ์ซ้ำ');
  return {...store,behaviorEvents:[...(store.behaviorEvents||[]),structuredClone(event)]};
}
export function behaviorIsActive(store:Store, event:Pick<BehaviorEvent,'sessionId'|'versionId'|'taskId'>):boolean {
  const session=store.sessions.find(s=>s.id===event.sessionId);
  const version=store.versions.find(v=>v.id===event.versionId);
  return Boolean(session?.behaviorConsentAt && !session.submittedAt && session.versionId===event.versionId && version?.target?.kind==='simulation'
    && version.tasks.find(t=>!session.answers.some(a=>a.taskId===t.id))?.id===event.taskId);
}
export function retryBehavior(store:Store, pending:BehaviorEvent[]):Store {
  return pending.reduce((next,event)=>{
    const existing=(next.behaviorEvents||[]).find(e=>e.id===event.id);
    if (existing) return appendBehavior(next,{...event,sequence:existing.sequence});
    const sequence=Math.max(0,...(next.behaviorEvents||[]).filter(e=>e.sessionId===event.sessionId).map(e=>e.sequence))+1;
    return appendBehavior(next,{...event,sequence});
  },store);
}
export function consentBehavior(store:Store, sessionId:string):Store {
  const session=store.sessions.find(s=>s.id===sessionId);
  const v=store.versions.find(v=>v.id===session?.versionId);
  if (!session || session.submittedAt || v?.target?.kind!=='simulation') throw new Error('รอบนี้เริ่มเก็บพฤติกรรมไม่ได้');
  return {...store,sessions:store.sessions.map(s=>s.id===sessionId ? {...s,behaviorConsentAt:s.behaviorConsentAt||new Date().toISOString()} : s)};
}
export const geometryKey=(e:BehaviorEvent)=>[e.layoutVersion,e.screenId,e.viewportWidth,e.viewportHeight,e.documentWidth,e.documentHeight].join('|');
export const geometryName=(e:BehaviorEvent)=>`${screenName(e.screenId)} · หน้าจอ ${e.viewportWidth} × ${e.viewportHeight} · เนื้อหา ${e.documentWidth} × ${e.documentHeight}`;
export const eventName=(type:BehaviorEvent['type'])=>({screen_view:'เปิดหน้า',pointer:'คลิก/แตะ',action:'กดด้วยคีย์บอร์ด',scroll:'เลื่อนหน้า'}[type]);
export const evidenceName=(kind?:Evidence['kind'])=>({event:'เหตุการณ์',path:'เส้นทาง',heatmap:'แผนที่คลิก'}[kind || 'event']);
export function behaviorEvidenceValid(store:Store, versionId:string, evidence:Evidence):boolean {
  const s=store.sessions.find(s=>s.id===evidence.sessionId && s.versionId===versionId);
  if (!s?.submittedAt || !s.answers.some(a=>a.taskId===evidence.taskId)) return false;
  if (!evidence.eventIds) return evidence.kind === undefined;
  if (!['event','path','heatmap'].includes(evidence.kind||'')) return false;
  const selected=(store.behaviorEvents||[]).filter(e=>evidence.eventIds!.includes(e.id));
  if (evidence.kind==='path' && selected.some(e=>e.type!=='screen_view')) return false;
  if (evidence.kind==='heatmap' && (selected.some(e=>e.type!=='pointer') || new Set(selected.map(geometryKey)).size!==1)) return false;
  return evidence.eventIds.length>0 && new Set(evidence.eventIds).size===evidence.eventIds.length && evidence.eventIds.every(id =>
    (store.behaviorEvents||[]).some(e=>e.id===id && e.versionId===versionId && e.sessionId===s.id && e.taskId===evidence.taskId));
}
export function behaviorComparable(before:Version, after:Version):boolean {
  return before.target?.kind==='simulation' && after.target?.kind==='simulation' && before.target.layoutVersion===after.target.layoutVersion;
}
export function selectedEvidence(store:Store, versionId:string, query:URLSearchParams):(Evidence & {eventIds:string[]})|null {
  try {
    const index=(key:string)=>{const value=query.get(key)||'';if(!/^(0|[1-9]\d*)$/.test(value))return -1;return Number(value);};
    let selected:unknown;
    if(query.has('report')) {
      const report=store.reports.find(r=>r.id===query.get('report') && r.versionId===versionId);
      selected=report?.findings[index('fi')]?.evidence[index('ei')];
    } else if(query.has('finding')) {
      selected=store.findings.find(f=>f.id===query.get('finding') && f.versionId===versionId)?.evidence[index('ei')];
    } else if(query.has('evidence')) selected=JSON.parse(query.get('evidence')!);
    if(!selected || typeof selected!=='object')return null;
    const e=selected as Evidence;
    if(typeof e.sessionId!=='string'||typeof e.taskId!=='string'||!Array.isArray(e.eventIds)||!e.eventIds.every(id=>typeof id==='string'))return null;
    return behaviorEvidenceValid(store,versionId,e)?e as Evidence & {eventIds:string[]}:null;
  } catch {return null;}
}
export function behaviorSummary(events:BehaviorEvent[]) {
  if (!events.length) return null;
  return {clicks:events.filter(e=>e.type==='pointer').length,actions:events.filter(e=>e.type==='action').length,
    paths:events.filter(e=>e.type==='screen_view' && e.transitionReason!=='resize').sort((a,b)=>a.sequence-b.sequence)};
}

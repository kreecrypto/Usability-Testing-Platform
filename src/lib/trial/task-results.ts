import {taskSummary, type Store, type Session, type Answer} from './model.ts';
export const outcomeLabels = {done:'ทำได้',not_done:'ทำไม่ได้',skipped:'ข้าม',technical_blocked:'ทำต่อไม่ได้เพราะปัญหาทางเทคนิค'};
// Missing or inconsistent clocks never become a fabricated zero duration.
export function answerElapsed(session:Session, answer:Answer):number|null {
  const start = session.taskStarts?.find(t=>t.taskId===answer.taskId)?.at;
  if (!start || !answer.answeredAt) return null;
  const a=Date.parse(start),b=Date.parse(answer.answeredAt),sessionStart=Date.parse(session.startedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(sessionStart) || a<sessionStart || b<a
    || (session.submittedAt && (!Number.isFinite(Date.parse(session.submittedAt)) || b>Date.parse(session.submittedAt)))) return null;
  return b-a;
}
export function taskResults(store:Store, versionId:string, taskId:string) {
  const sessions=store.sessions.filter(s=>s.versionId===versionId);
  const rows=sessions.map(session=>({session,answer:session.answers.find(a=>a.taskId===taskId)})).filter(({session,answer})=>answer || session.taskStarts?.some(t=>t.taskId===taskId) || store.behaviorEvents?.some(e=>e.sessionId===session.id && e.versionId===versionId && e.taskId===taskId));
  const x=taskSummary(store,versionId,taskId);
  const eligible=x.done+x.notDone+x.skipped;
  const times=rows.filter(r=>r.session.submittedAt && r.answer && ['done','not_done'].includes(r.answer.outcome))
    .flatMap(r=>{const time=answerElapsed(r.session,r.answer!);return time===null?[]:[time];}).sort((a,b)=>a-b);
  const mid=Math.floor(times.length/2);
  return {...x, rows, started:rows.length, pending:rows.filter(r=>!r.session.submittedAt).length,
    answered:rows.filter(r=>r.answer).length, eligible, rate:eligible?x.done/eligible:null,
    medianMs:times.length?(times.length%2?times[mid]:(times[mid-1]+times[mid])/2):null,timeCount:times.length};
}
export function elapsedLabel(ms:number|null):string {
  return ms===null?'เวลาไม่พร้อม':`${(ms/1000).toLocaleString('th-TH',{maximumFractionDigits:1})} วินาที`;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {blankStore,startTask,answerSession,decodeStore,type Store,type Session,type Answer} from '../src/lib/trial/model.ts';
import {taskResults,answerElapsed} from '../src/lib/trial/task-results.ts';
const zero='2026-10-11T00:00:00.000Z';
const at=(ms:number)=>new Date(Date.parse(zero)+ms).toISOString();
function fixture():Store {return {...blankStore(),projects:[{id:'p',name:'QA',goal:'QA'}],tests:[{id:'t',projectId:'p',title:'QA'}],versions:[{id:'v',testId:'t',number:1,title:'QA',url:'https://example.com',tasks:[{id:'a',instruction:'A'},{id:'b',instruction:'B'}],publishedAt:zero}],sessions:[{id:'s',versionId:'v',startedAt:zero,answers:[]}]};}
const answer=(outcome:Answer['outcome']='done'):Answer=>({taskId:'a',outcome,ease:null,feedback:'QA',...(outcome==='technical_blocked'?{technicalReason:'เปิดหน้าไม่ได้'}:{})});
function session(id:string,outcome:Answer['outcome'],ms:number|undefined,submitted=true):Session {return {id,versionId:'v',startedAt:zero,...(ms!==undefined?{taskStarts:[{taskId:'a',at:zero}]}:{}),answers:[{...answer(outcome),...(ms!==undefined?{answeredAt:at(ms)}:{})}],...(submitted?{submittedAt:at(100000)}:{})};}
test('start is explicit, persisted, active-task only and idempotent; saved endpoint never restarts',()=>{
 const initial=fixture();assert.throws(()=>startTask(initial,'s','b'),/เฉพาะ/);const s=startTask(initial,'s','a',at(100));assert.equal(startTask(s,'s','a',at(900)),s);assert.equal(decodeStore(JSON.stringify(s)).sessions[0].taskStarts![0].at,at(100));
 const done=answerSession(s,'s',answer(),at(5100));assert.equal(answerElapsed(done.sessions[0],done.sessions[0].answers[0]),5000);
 const edited=answerSession(done,'s',answer('not_done'),at(9000));assert.equal(edited.sessions[0].answers[0].answeredAt,at(5100));assert.throws(()=>startTask(done,'s','a'),/เฉพาะ/);
});
test('submitted eligible denominator includes skips, excludes technical and incomplete; version isolation',()=>{
 const store={...fixture(),sessions:[session('1','done',1000),session('2','not_done',3000),session('3','skipped',4000),session('4','technical_blocked',2000),session('5','done',5000,false),{...session('6','done',1000),versionId:'other'}]};
 const x=taskResults(store,'v','a');assert.equal(x.started,5);assert.equal(x.pending,1);assert.equal(x.count,4);assert.equal(x.eligible,3);assert.equal(x.rate,1/3);assert.equal(x.technicalBlocked,1);assert.equal(x.medianMs,2000);assert.equal(x.timeCount,2);
});
test('odd median ignores missing times without imputing zero',()=>{const s={...fixture(),sessions:[session('1','done',1000),session('2','done',5000),session('3','not_done',3000),session('4','done',undefined)]};const x=taskResults(s,'v','a');assert.equal(x.medianMs,3000);assert.equal(x.timeCount,3);assert.equal(x.rate,3/4);});
test('empty and technical-only rates/median are No Data; valid zero duration is preserved',()=>{
 assert.equal(taskResults(fixture(),'v','a').rate,null);assert.equal(taskResults(fixture(),'v','a').medianMs,null);
 const s={...fixture(),sessions:[session('s','technical_blocked',1000)]};assert.equal(taskResults(s,'v','a').rate,null);assert.equal(taskResults(s,'v','a').medianMs,null);assert.equal(answerElapsed(session('s','done',0),session('s','done',0).answers[0]),0);
});
test('legacy data remains readable; starts and endpoints are never fabricated',()=>{
 let s=fixture();s=answerSession(s,'s',answer());assert.equal(s.sessions[0].answers[0].answeredAt,undefined);assert.equal(decodeStore(JSON.stringify(s)).sessions[0].taskStarts,undefined);assert.equal(answerElapsed(s.sessions[0],s.sessions[0].answers[0]),null);
});
test('invalid/backward/pre-session/after-submit timestamps do not produce durations',()=>{
 for(const [start,end] of [['bad',at(1000)],[at(2000),at(1000)],[at(-1),at(1000)],[zero,'bad'],[zero,at(100001)]]){
 const s=session('s','done',1000);s.taskStarts![0].at=start;s.answers[0].answeredAt=end;assert.equal(answerElapsed(s,s.answers[0]),null);
 }
 const store=fixture();store.sessions=[{...session('s','done',1000,false),taskStarts:[{taskId:'a',at:'bad'}]}];assert.doesNotThrow(()=>decodeStore(JSON.stringify(store)));
});
test('technical reason required; metadata shape, uniqueness and task references validated',()=>{
 const s=fixture();assert.throws(()=>answerSession(s,'s',{...answer('technical_blocked'),technicalReason:' '}),/ระบุ/);
 const started=startTask(s,'s','a',zero);const saved=answerSession(started,'s',answer('technical_blocked'),at(1000));assert.doesNotThrow(()=>decodeStore(JSON.stringify(saved)));
 assert.throws(()=>decodeStore(JSON.stringify({...saved,sessions:[{...saved.sessions[0],taskStarts:[{taskId:'missing',at:zero}]}]})));
 assert.throws(()=>decodeStore(JSON.stringify({...saved,sessions:[{...saved.sessions[0],taskStarts:[{taskId:'a',at:zero},{taskId:'a',at:zero}]}]})));
});

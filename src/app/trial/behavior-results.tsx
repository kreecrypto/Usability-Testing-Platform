"use client";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { behaviorEvidenceValid, geometryKey, geometryName, screenName, eventName, evidenceName, selectedEvidence, behaviorSummary, type BehaviorEvent } from '../../lib/trial/behavior';
import type { Store, Version } from '../../lib/trial/model';
import styles from './trial.module.css';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Maximize2, X } from 'lucide-react';
function Heatmap({points,selectedId,onSelect}:{points:BehaviorEvent[];selectedId:string;onSelect:(id:string)=>void}) {
  const e=points[0];
  const box=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(280);
  const [status,setStatus]=useState<'loading'|'ready'|'error'|'mismatch'>('loading');
  const [attempt,setAttempt]=useState(0);
  const [zoom,setZoom]=useState('fit');
  const opener=useRef<HTMLButtonElement>(null);
  const scroller=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(false);
  const [overlap,setOverlap]=useState<string[]>([]);
  useEffect(()=>{
    if(!box.current)return;
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));
    observer.observe(box.current);
    return()=>observer.disconnect();
  },[expanded]);
  useEffect(()=>{
    if(status!=='loading')return;
    const timer=window.setTimeout(()=>setStatus('error'),10_000);
    return()=>window.clearTimeout(timer);
  },[status,attempt]);
  const scale=zoom==='fit'?Math.min(1,Math.max(0,width-2)/e.viewportWidth):Number(zoom);
  const selected=points.find(p=>p.id===selectedId);
  useEffect(()=>{
    if(status==='ready' && selected && scroller.current) {
      scroller.current.scrollTo({left:Math.max(0,(selected.documentX||0)*scale-scroller.current.clientWidth/2),top:Math.max(0,(selected.documentY||0)*scale-scroller.current.clientHeight/2)});
    }
  },[selectedId,scale,status,expanded]);
  function choose(p:BehaviorEvent) {
    const near=points.filter(row=>Math.hypot((row.documentX||0)-(p.documentX||0),(row.documentY||0)-(p.documentY||0))*scale<44);
    setOverlap(near.length>1?near.map(row=>row.id):[]);onSelect(p.id);
  }
  const canvas=<div ref={box} aria-busy={status==='loading'}>

    <p>{geometryName(e)} · {points.length} คลิก</p>
    <label>ขนาดแผนที่<select value={zoom} onChange={event=>setZoom(event.target.value)}><option value="fit">พอดีพื้นที่</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
    <div ref={scroller} className={styles.mapScroller} tabIndex={0} role="region" aria-label="แผนที่เลื่อนได้">
    {status==='loading' && <p role="status">กำลังโหลดแผนที่ตำแหน่งคลิก…</p>}
    {status==='error' && <div role="alert"><p>โหลดแผนที่ตำแหน่งคลิกไม่สำเร็จ ข้อมูลเหตุการณ์ยังอยู่ ลองใหม่หรือดูรายการเหตุการณ์ด้านล่าง</p><Button variant="legacy" type="button" onClick={()=>{setStatus('loading');setAttempt(n=>n+1);}}>ลองโหลดแผนที่อีกครั้ง</Button></div>}
    {status==='mismatch' && <p role="status">แสดงแผนที่ตำแหน่งคลิกไม่ได้: ขนาดหน้าไม่ตรงกับหลักฐาน ดูรายการเหตุการณ์ด้านล่างแทน</p>}
    <div className={styles.heatmap} style={{width:e.viewportWidth*scale,height:status==='ready'?e.documentHeight*scale:0,borderWidth:status==='ready'?undefined:0}}>
      <div style={{position:'relative',width:e.viewportWidth,height:e.documentHeight,transform:`scale(${scale})`,transformOrigin:'top left'}}>
        <iframe key={attempt} tabIndex={-1} aria-hidden="true" title="พื้นหลังแผนที่ตำแหน่งคลิกแบบอ่านอย่างเดียว" src={`/trial/target?mode=preview&layout=${e.layoutVersion}&screen=${e.screenId}`} width={e.viewportWidth} height={e.documentHeight} className={styles.backgroundFrame}
          onError={()=>setStatus('error')}
          onLoad={event=>{
            const doc=event.currentTarget.contentDocument;
            if(!doc || doc.body?.dataset.layoutVersion!==e.layoutVersion){setStatus('error');return;}
            setStatus(doc.documentElement.scrollWidth===e.documentWidth && doc.documentElement.scrollHeight===e.documentHeight?'ready':'mismatch');
          }}/>
        {status==='ready' && points.map((p,i)=><button type="button" key={p.id} aria-label={`เลือกคลิก ${i+1}`} aria-pressed={p.id===selectedId} className={styles.heatPoint} style={{left:p.documentX,top:p.documentY,transform:`scale(${1/scale})`}} onClick={()=>choose(p)}>{i+1}</button>)}
      </div>
    </div>
    </div>
    {overlap.length>1 && <div role="group" aria-label="คลิกที่ซ้อนกัน"><p>จุดนี้มี {overlap.length} คลิกอยู่ใกล้กัน เลือกเหตุการณ์ที่ต้องการตรวจ</p>{overlap.map(id=><Button variant="legacy" type="button" key={id} aria-pressed={id===selectedId} onClick={()=>onSelect(id)}>คลิก {points.findIndex(p=>p.id===id)+1}</Button>)}</div>}
    <p>แต่ละจุดคือตำแหน่งคลิกที่เก็บจริง รวมระยะเลื่อนหน้า จำนวนคลิกไม่ใช่คะแนนความสำเร็จ ใช้รายการคลิกด้านล่างเพื่อตรวจหลักฐาน</p>
  </div>;
  return <Dialog open={expanded} onOpenChange={next=>{setStatus('loading');setExpanded(next);}}>
    <DialogTrigger asChild><Button variant="legacy" ref={opener} type="button"><Maximize2 aria-hidden="true" data-ui="icon" /> ขยายแผนที่</Button></DialogTrigger>
    {!expanded && canvas}
    <DialogContent container={opener.current?.closest<HTMLElement>(`.${styles.shell}`)} className={styles.mapDialog}>
      <DialogTitle>แผนที่ตำแหน่งคลิกขนาดใหญ่</DialogTitle>
      <DialogDescription>เลื่อนและขยายเพื่อดูจุดคลิก ปิดหน้าต่างเพื่อกลับไปดูหลักฐาน</DialogDescription>
      <DialogClose asChild><Button variant="legacy" type="button"><X aria-hidden="true" data-ui="icon" /> ปิดแผนที่ขนาดใหญ่</Button></DialogClose>{expanded && canvas}
      {expanded && selected && <p role="status">เลือกคลิก {points.indexOf(selected)+1} · {selected.elementId||'บนหน้า'} · ตำแหน่ง ({selected.documentX}, {selected.documentY}) · {selected.at} — ปิดแผนที่เพื่อดูหลักฐานและสร้างข้อค้นพบ</p>}
    </DialogContent>
  </Dialog>;
}
export default function BehaviorResults({store,version}:{store:Store;version:Version}) {
  const [selectedId,setSelectedId]=useState(typeof window==='undefined'?'':window.location.hash.replace(/^#event-/,''));
  const [task,setTask]=useState('');const [session,setSession]=useState('');const [screen,setScreen]=useState('');const [group,setGroup]=useState('');
  const query=new URLSearchParams(typeof window==='undefined'?'':window.location.search);
  const selected=selectedEvidence(store,version.id,query);
  const invalidSelection=['report','finding','evidence'].some(key=>query.has(key))&&!selected;
  const all=(store.behaviorEvents||[]).filter(e=>e.versionId===version.id);
  const events=all.filter(e=>(!task||e.taskId===task)&&(!session||e.sessionId===session)&&(!screen||e.screenId===screen)&&(!selected||selected.eventIds.includes(e.id)));
  const clickScreens=[...new Set(events.filter(e=>e.type==='pointer').map(e=>e.screenId))];
  const [mapScreen,setMapScreen]=useState('');
  const focused=events.find(e=>e.id===selectedId && e.type==='pointer');
  const chosenScreen=clickScreens.includes(mapScreen)?mapScreen:focused?.screenId||clickScreens[0];
  const groups=[...new Set(events.filter(e=>e.screenId===chosenScreen).filter(e=>e.type==='pointer').map(geometryKey))];const chosen=groups.includes(group)?group:focused && groups.includes(geometryKey(focused))?geometryKey(focused):groups[0];
  const points=events.filter(e=>e.type==='pointer' && geometryKey(e)===chosen);
  const summary=behaviorSummary(events);
  const inspected=points.find(e=>e.id===selectedId);
  const evidence=inspected?{sessionId:inspected.sessionId,taskId:inspected.taskId,kind:'event' as const,eventIds:[inspected.id]}:null;
  useEffect(()=>{
    const update=()=>{setSelectedId(window.location.hash.replace(/^#event-/,''));setGroup('');setMapScreen('');};
    window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);
  },[]);
  function inspect(id:string) {setSelectedId(id);}
  function openEvent(id:string) {
    const article=document.getElementById(`event-${id}`);
    article?.closest('details')?.setAttribute('open','');
    window.history.replaceState(null,'',`${window.location.pathname}${window.location.search}#event-${id}`);
    article?.scrollIntoView({block:'start'});article?.focus({preventScroll:true});
  }
  return <Card asChild appearance="legacy" ><section className={styles.card} aria-label="พฤติกรรมบนเว็บจำลอง">
    <h2>คลิก เส้นทาง และแผนที่ตำแหน่งคลิก</h2><p>พฤติกรรมจริงบนเว็บจำลอง UTP · เวอร์ชัน {version.number} · เก็บเฉพาะเบราว์เซอร์นี้ ไม่ใช่ผลจาก Banrao</p>
    {invalidSelection && <p role="status">เปิดชุดหลักฐานนี้ไม่ได้: ลิงก์ไม่ถูกต้องหรือข้อมูลไม่ได้อยู่ในเบราว์เซอร์นี้ ด้านล่างแสดงพฤติกรรมทั้งหมดของเวอร์ชันนี้</p>}
    {selected && <p>กำลังแสดงชุดหลักฐาน {evidenceName(selected.kind)} ที่อ้างอิงไว้ ({events.length} เหตุการณ์) <a href={`/trial?step=results&p=${query.get('p')||''}&t=${version.testId}&v=${version.id}`}>ดูพฤติกรรมทั้งหมด</a></p>}
    <div className="tw:grid tw:gap-ah-16 tw:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
      <label>โจทย์<select value={task} onChange={e=>setTask(e.target.value)}><option value="">ทุกโจทย์</option>{version.tasks.map((t,i)=><option key={t.id} value={t.id}>โจทย์ {i+1}</option>)}</select></label>
      <label>รอบทดลอง<select value={session} onChange={e=>setSession(e.target.value)}><option value="">ทุกรอบ</option>{store.sessions.filter(s=>s.versionId===version.id).map((s,i)=><option key={s.id} value={s.id}>รอบ {i+1}{!s.submittedAt?' (ยังไม่ส่งครบ)':''}</option>)}</select></label>
      <label>หน้า<select value={screen} onChange={e=>setScreen(e.target.value)}><option value="">ทุกหน้า</option>{[...new Set(all.map(e=>e.screenId))].map(s=><option key={s} value={s}>{screenName(s)}</option>)}</select></label>
    </div>
    {(task || session || screen) && <Button variant="legacy" type="button" onClick={()=>{setTask('');setSession('');setScreen('');setGroup('');}}>ล้างตัวกรอง</Button>}
    {!summary ? <p role="status">{!all.length ? 'ยังไม่มีการเก็บพฤติกรรม เริ่มเว็บจำลองและยินยอมเก็บพฤติกรรมก่อน' : 'ไม่พบข้อมูลตามตัวกรองนี้ ล้างตัวกรองเพื่อกลับไปดูข้อมูลที่เก็บไว้'}</p> : <>
      <p>คลิก/แตะ {summary.clicks} · การกระทำด้วยคีย์บอร์ด {summary.actions} · ไม่มีการสรุปความสำเร็จหรือ misclick จากจำนวนคลิก</p>
      {summary.paths.length ? <h3>เส้นทางแยกตามรอบและโจทย์</h3> : <p>ชุดข้อมูลที่แสดงไม่มีเหตุการณ์เส้นทาง {selected ? 'เปิดพฤติกรรมทั้งหมดเพื่อดูเส้นทางของรอบทดลอง' : 'ดูการกระทำที่เก็บไว้จากรายการเหตุการณ์'}</p>}
      {store.sessions.filter(s=>s.versionId===version.id && (!session||s.id===session)).map((s,i)=><div key={s.id}>{version.tasks.filter(t=>!task||t.id===task).map((t,j)=>{
        const path=summary.paths.filter(e=>e.sessionId===s.id && e.taskId===t.id);return path.length>0 && <article key={t.id}><h4>รอบ {store.sessions.filter(s=>s.versionId===version.id).findIndex(row=>row.id===s.id)+1} · โจทย์ {version.tasks.indexOf(t)+1}</h4><ol>{path.map(e=><li key={e.id}><a href={`#event-${e.id}`}>{screenName(e.screenId)}</a>{e.transitionReason==='reload'?' (เปิดต่อ/โหลดใหม่)':e.transitionReason==='back'?' (ย้อนกลับ)':''}</li>)}</ol></article>;
      })}</div>)}
      <h3>แผนที่ตำแหน่งคลิก</h3>
      {groups.length ? <>
        <div className="tw:grid tw:gap-ah-16 tw:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
          <label>หน้าบนแผนที่<select value={chosenScreen} onChange={e=>{setMapScreen(e.target.value);setGroup('');setSelectedId('');}}>{clickScreens.map(id=><option key={id} value={id}>{screenName(id)} · {events.filter(e=>e.type==='pointer'&&e.screenId===id).length} คลิก</option>)}</select></label>
          <label>ขนาดหน้าจอที่เก็บข้อมูล<select value={chosen} onChange={e=>{setGroup(e.target.value);setSelectedId('');}}>{groups.map(g=><option key={g} value={g}>{geometryName(events.find(e=>geometryKey(e)===g)!)} · {events.filter(e=>e.type==='pointer'&&geometryKey(e)===g).length} คลิก</option>)}</select></label>
        </div>
        <Heatmap key={chosen} points={points} selectedId={selectedId} onSelect={inspect}/>
        <h4>รายการคลิก ({points.length})</h4><ol className={styles.clickList}>{points.map((e,i)=><li key={e.id}><Button variant="legacy" type="button" aria-pressed={selectedId===e.id} onClick={()=>inspect(e.id)}>คลิก {i+1} · {e.elementId||'บนหน้า'} · โจทย์ {version.tasks.findIndex(t=>t.id===e.taskId)+1}</Button></li>)}</ol>
        {inspected && <section className={styles.clickInspector} aria-label="รายละเอียดคลิก" aria-live="polite"><h4>คลิก {points.indexOf(inspected)+1} · {screenName(inspected.screenId)}</h4><p>องค์ประกอบ: {inspected.elementId||'ไม่มีองค์ประกอบ'} · โจทย์ {version.tasks.findIndex(t=>t.id===inspected.taskId)+1} · รอบ {store.sessions.filter(s=>s.versionId===version.id).findIndex(s=>s.id===inspected.sessionId)+1}</p><p>เวลา {inspected.at} · ตำแหน่ง ({inspected.documentX}, {inspected.documentY})</p><small>เหตุการณ์ {inspected.id}</small><div className="tw:grid tw:gap-ah-16 tw:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"><Button variant="legacy" type="button" onClick={()=>openEvent(inspected.id)}>ดูเหตุการณ์ต้นทาง</Button>{evidence && behaviorEvidenceValid(store,version.id,evidence)?<a href={`/trial?step=findings&p=${query.get('p')||''}&t=${version.testId}&v=${version.id}&click=${inspected.id}`}>สร้างข้อค้นพบจากคลิกนี้</a>:<><Button variant="legacy" type="button" disabled>สร้างข้อค้นพบจากคลิกนี้</Button><p>รอบทดลองนี้ยังส่งคำตอบไม่ครบ จึงยังใช้คลิกนี้เป็นหลักฐานไม่ได้</p></>}</div></section>}
      </> : <p>ยังไม่มีพิกัดคลิก การกดด้วยคีย์บอร์ดดูได้จากรายการเหตุการณ์</p>}
      <details open={Boolean(typeof window!=='undefined' && window.location.hash.startsWith('#event-'))}><summary>รายการเหตุการณ์และหลักฐาน ({events.length})</summary>
        {events.map(e=><article id={`event-${e.id}`} tabIndex={-1} key={e.id} className={styles.evidence}><h4>{eventName(e.type)} · {screenName(e.screenId)}</h4><p>{e.elementId||'ไม่มีองค์ประกอบ'}{e.type==='pointer'?` · ตำแหน่งบนเนื้อหา (${e.documentX}, ${e.documentY})`:''}{e.type==='scroll'&&e.scrollY!==undefined?` · เลื่อนจากขอบบน ${e.scrollY} พิกเซล`:''}</p><small>โจทย์ {version.tasks.findIndex(t=>t.id===e.taskId)+1} · รอบ {e.sessionId} · ลำดับ {e.sequence} · เวลา {e.at} · เหตุการณ์ {e.id}</small></article>)}
      </details>
    </>}
  </section></Card>;
}

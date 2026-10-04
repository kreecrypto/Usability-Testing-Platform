"use client";
import { useEffect, useRef, useState } from 'react';
import { geometryKey, geometryName, screenName, eventName, evidenceName, selectedEvidence, behaviorSummary, type BehaviorEvent } from '../../lib/trial/behavior';
import type { Store, Version } from '../../lib/trial/model';
import styles from './trial.module.css';
function Heatmap({points}:{points:BehaviorEvent[]}) {
  const e=points[0];
  const box=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(280);
  const [status,setStatus]=useState<'loading'|'ready'|'error'|'mismatch'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!box.current)return;
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));
    observer.observe(box.current);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(status!=='loading')return;
    const timer=window.setTimeout(()=>setStatus('error'),10_000);
    return()=>window.clearTimeout(timer);
  },[status,attempt]);
  const scale=Math.min(1,Math.max(0,width-2)/e.viewportWidth);
  return <div ref={box} aria-busy={status==='loading'}>
    <p>{geometryName(e)} · {points.length} คลิก</p>
    {status==='loading' && <p role="status">กำลังโหลดแผนที่ตำแหน่งคลิก…</p>}
    {status==='error' && <div role="alert"><p>โหลดแผนที่ตำแหน่งคลิกไม่สำเร็จ ข้อมูลเหตุการณ์ยังอยู่ ลองใหม่หรือดูรายการเหตุการณ์ด้านล่าง</p><button type="button" onClick={()=>{setStatus('loading');setAttempt(n=>n+1);}}>ลองโหลดแผนที่อีกครั้ง</button></div>}
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
        {status==='ready' && points.map(p=><span key={p.id} className={styles.heatPoint} style={{left:p.documentX,top:p.documentY}} title={`เหตุการณ์ ${p.id}`} />)}
      </div>
    </div>
    <p>แต่ละวงแสดงตำแหน่งคลิกจริงบนเนื้อหา รวมระยะที่เลื่อนหน้า ไม่ใช่ระดับความหนาแน่นหรือคะแนนความสำเร็จ แผนที่แยกตามขนาดหน้าจอและรูปแบบหน้า ดูหลักฐานได้จากรายการเหตุการณ์</p>
  </div>;
}
export default function BehaviorResults({store,version}:{store:Store;version:Version}) {
  const [task,setTask]=useState('');const [session,setSession]=useState('');const [screen,setScreen]=useState('');const [group,setGroup]=useState('');
  const query=new URLSearchParams(typeof window==='undefined'?'':window.location.search);
  const selected=selectedEvidence(store,version.id,query);
  const invalidSelection=['report','finding','evidence'].some(key=>query.has(key))&&!selected;
  const all=(store.behaviorEvents||[]).filter(e=>e.versionId===version.id);
  const events=all.filter(e=>(!task||e.taskId===task)&&(!session||e.sessionId===session)&&(!screen||e.screenId===screen)&&(!selected||selected.eventIds.includes(e.id)));
  const groups=[...new Set(events.filter(e=>e.type==='pointer').map(geometryKey))];const chosen=groups.includes(group)?group:groups[0];
  const points=events.filter(e=>e.type==='pointer' && geometryKey(e)===chosen);
  const summary=behaviorSummary(events);
  return <section className={styles.card} aria-label="พฤติกรรมบนเว็บจำลอง">
    <h2>คลิก เส้นทาง และแผนที่ตำแหน่งคลิก</h2><p>พฤติกรรมจริงบนเว็บจำลอง UTP · เวอร์ชัน {version.number} · เก็บเฉพาะเบราว์เซอร์นี้ ไม่ใช่ผลจาก Banrao</p>
    {invalidSelection && <p role="status">เปิดชุดหลักฐานนี้ไม่ได้: ลิงก์ไม่ถูกต้องหรือข้อมูลไม่ได้อยู่ในเบราว์เซอร์นี้ ด้านล่างแสดงพฤติกรรมทั้งหมดของเวอร์ชันนี้</p>}
    {selected && <p>กำลังแสดงชุดหลักฐาน {evidenceName(selected.kind)} ที่อ้างอิงไว้ ({events.length} เหตุการณ์) <a href={`/trial?step=results&p=${query.get('p')||''}&t=${version.testId}&v=${version.id}`}>ดูพฤติกรรมทั้งหมด</a></p>}
    <div className={styles.filters}>
      <label>โจทย์<select value={task} onChange={e=>setTask(e.target.value)}><option value="">ทุกโจทย์</option>{version.tasks.map((t,i)=><option key={t.id} value={t.id}>โจทย์ {i+1}</option>)}</select></label>
      <label>รอบทดลอง<select value={session} onChange={e=>setSession(e.target.value)}><option value="">ทุกรอบ</option>{store.sessions.filter(s=>s.versionId===version.id).map((s,i)=><option key={s.id} value={s.id}>รอบ {i+1}{!s.submittedAt?' (ยังไม่ส่งครบ)':''}</option>)}</select></label>
      <label>หน้า<select value={screen} onChange={e=>setScreen(e.target.value)}><option value="">ทุกหน้า</option>{[...new Set(all.map(e=>e.screenId))].map(s=><option key={s} value={s}>{screenName(s)}</option>)}</select></label>
    </div>
    {(task || session || screen) && <button type="button" onClick={()=>{setTask('');setSession('');setScreen('');setGroup('');}}>ล้างตัวกรอง</button>}
    {!summary ? <p role="status">{!all.length ? 'ยังไม่มีการเก็บพฤติกรรม เริ่มเว็บจำลองและยินยอมเก็บพฤติกรรมก่อน' : 'ไม่พบข้อมูลตามตัวกรองนี้ ล้างตัวกรองเพื่อกลับไปดูข้อมูลที่เก็บไว้'}</p> : <>
      <p>คลิก/แตะ {summary.clicks} · การกระทำด้วยคีย์บอร์ด {summary.actions} · ไม่มีการสรุปความสำเร็จหรือ misclick จากจำนวนคลิก</p>
      {summary.paths.length ? <h3>เส้นทางแยกตามรอบและโจทย์</h3> : <p>ชุดข้อมูลที่แสดงไม่มีเหตุการณ์เส้นทาง {selected ? 'เปิดพฤติกรรมทั้งหมดเพื่อดูเส้นทางของรอบทดลอง' : 'ดูการกระทำที่เก็บไว้จากรายการเหตุการณ์'}</p>}
      {store.sessions.filter(s=>s.versionId===version.id && (!session||s.id===session)).map((s,i)=><div key={s.id}>{version.tasks.filter(t=>!task||t.id===task).map((t,j)=>{
        const path=summary.paths.filter(e=>e.sessionId===s.id && e.taskId===t.id);return path.length>0 && <article key={t.id}><h4>รอบ {store.sessions.filter(s=>s.versionId===version.id).findIndex(row=>row.id===s.id)+1} · โจทย์ {version.tasks.indexOf(t)+1}</h4><ol>{path.map(e=><li key={e.id}><a href={`#event-${e.id}`}>{screenName(e.screenId)}</a>{e.transitionReason==='reload'?' (เปิดต่อ/โหลดใหม่)':e.transitionReason==='back'?' (ย้อนกลับ)':''}</li>)}</ol></article>;
      })}</div>)}
      <h3>แผนที่ตำแหน่งคลิก</h3>
      {groups.length ? <><label>หน้าและขนาดที่ใช้แสดง<select value={chosen} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g} value={g}>{geometryName(events.find(e=>geometryKey(e)===g)!)}</option>)}</select></label><Heatmap key={chosen} points={points}/></> : <p>ยังไม่มีพิกัดคลิก การกดด้วยคีย์บอร์ดดูได้จากรายการเหตุการณ์</p>}
      <details open={Boolean(typeof window!=='undefined' && window.location.hash.startsWith('#event-'))}><summary>รายการเหตุการณ์และหลักฐาน ({events.length})</summary>
        {events.map(e=><article id={`event-${e.id}`} tabIndex={-1} key={e.id} className={styles.evidence}><h4>{eventName(e.type)} · {screenName(e.screenId)}</h4><p>{e.elementId||'ไม่มีองค์ประกอบ'}{e.type==='pointer'?` · ตำแหน่งบนเนื้อหา (${e.documentX}, ${e.documentY})`:''}{e.type==='scroll'&&e.scrollY!==undefined?` · เลื่อนจากขอบบน ${e.scrollY} พิกเซล`:''}</p><small>โจทย์ {version.tasks.findIndex(t=>t.id===e.taskId)+1} · รอบ {e.sessionId} · ลำดับ {e.sequence} · เวลา {e.at} · เหตุการณ์ {e.id}</small></article>)}
      </details>
    </>}
  </section>;
}

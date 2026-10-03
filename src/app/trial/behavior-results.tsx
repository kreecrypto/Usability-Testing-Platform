"use client";
import { useEffect, useRef, useState } from 'react';
import { geometryKey, geometryName, screenName, eventName, evidenceName, selectedEvidence, behaviorSummary, type BehaviorEvent } from '../../lib/trial/behavior';
import type { Store, Version } from '../../lib/trial/model';
import styles from './trial.module.css';
function Heatmap({points}:{points:BehaviorEvent[]}) {
  const e=points[0]; const box=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(280);const [valid,setValid]=useState<boolean|null>(null);
  useEffect(()=>{if(!box.current)return;const o=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));o.observe(box.current);return()=>o.disconnect();},[]);
  const scale=Math.min(1,width/e.viewportWidth);
  return <div ref={box}><p>{geometryName(e)} · {points.length} คลิก</p>
    {valid===false && <p role="status">แสดง Heatmap ไม่ได้: ขนาดหน้าไม่ตรงกับหลักฐาน ดูรายการเหตุการณ์ด้านล่างแทน</p>}
    <div className={styles.heatmap} style={{height:e.documentHeight*scale,display:valid===false?'none':undefined}}>
      <div style={{position:'relative',width:e.viewportWidth,height:e.documentHeight,transform:`scale(${scale})`,transformOrigin:'top left'}}>
        <iframe tabIndex={-1} aria-hidden="true" title="พื้นหลัง Heatmap แบบอ่านอย่างเดียว" src={`/trial/target?mode=preview&layout=${e.layoutVersion}&screen=${e.screenId}`} width={e.viewportWidth} height={e.documentHeight} className={styles.backgroundFrame}
          onLoad={event=>{const doc=event.currentTarget.contentDocument;setValid(Boolean(doc && doc.documentElement.scrollWidth===e.documentWidth && doc.documentElement.scrollHeight===e.documentHeight));}}/>
        {valid===true && points.map(p=><span key={p.id} className={styles.heatPoint} style={{left:p.documentX,top:p.documentY}} title={`เหตุการณ์ ${p.id}`} />)}
      </div>
    </div>
    <p>วงสีแสดงตำแหน่งคลิกจริง รวมการเลื่อนหน้า แผนที่แยกตามขนาดหน้าจอและ layout รายการเหตุการณ์เป็นหลักฐานอ้างอิง</p>
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
    <h2>คลิก เส้นทาง และ Heatmap</h2><p>พฤติกรรมจริงบนเว็บจำลอง UTP · เวอร์ชัน {version.number} · เก็บเฉพาะเบราว์เซอร์นี้ ไม่ใช่ผลจาก Banrao</p>
    {invalidSelection && <p role="status">เปิดชุดหลักฐานนี้ไม่ได้: ลิงก์ไม่ถูกต้องหรือข้อมูลไม่ได้อยู่ในเบราว์เซอร์นี้ ด้านล่างแสดงพฤติกรรมทั้งหมดของเวอร์ชันนี้</p>}
    {selected && <p>กำลังแสดงชุดหลักฐาน {evidenceName(selected.kind)} ที่อ้างอิงไว้ ({events.length} เหตุการณ์) <a href={`/trial?step=results&p=${query.get('p')||''}&t=${version.testId}&v=${version.id}`}>ดูพฤติกรรมทั้งหมด</a></p>}
    <div className={styles.filters}>
      <label>โจทย์<select value={task} onChange={e=>setTask(e.target.value)}><option value="">ทุกโจทย์</option>{version.tasks.map((t,i)=><option key={t.id} value={t.id}>โจทย์ {i+1}</option>)}</select></label>
      <label>รอบทดลอง<select value={session} onChange={e=>setSession(e.target.value)}><option value="">ทุกรอบ</option>{store.sessions.filter(s=>s.versionId===version.id).map((s,i)=><option key={s.id} value={s.id}>รอบ {i+1}{!s.submittedAt?' (ยังไม่ส่งครบ)':''}</option>)}</select></label>
      <label>หน้า<select value={screen} onChange={e=>setScreen(e.target.value)}><option value="">ทุกหน้า</option>{[...new Set(all.map(e=>e.screenId))].map(s=><option key={s} value={s}>{screenName(s)}</option>)}</select></label>
    </div>
    {!summary ? <p>ยังไม่มีข้อมูลตามตัวกรองนี้ เริ่มเว็บจำลองและยินยอมเก็บพฤติกรรมก่อน</p> : <>
      <p>คลิก/แตะ {summary.clicks} · การกระทำด้วยคีย์บอร์ด {summary.actions} · ไม่มีการสรุปความสำเร็จหรือ misclick จากจำนวนคลิก</p>
      <h3>เส้นทางแยกตามรอบและโจทย์</h3>
      {store.sessions.filter(s=>s.versionId===version.id && (!session||s.id===session)).map((s,i)=><div key={s.id}>{version.tasks.filter(t=>!task||t.id===task).map((t,j)=>{
        const path=summary.paths.filter(e=>e.sessionId===s.id && e.taskId===t.id);return path.length>0 && <article key={t.id}><h4>รอบ {store.sessions.filter(s=>s.versionId===version.id).findIndex(row=>row.id===s.id)+1} · โจทย์ {version.tasks.indexOf(t)+1}</h4><ol>{path.map(e=><li key={e.id}><a href={`#event-${e.id}`}>{screenName(e.screenId)}</a>{e.transitionReason==='reload'?' (เปิดต่อ/โหลดใหม่)':e.transitionReason==='back'?' (ย้อนกลับ)':''}</li>)}</ol></article>;
      })}</div>)}
      <h3>แผนที่คลิก (Heatmap)</h3>
      {groups.length ? <><label>หน้าและขนาดที่ใช้แสดง<select value={chosen} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g} value={g}>{geometryName(events.find(e=>geometryKey(e)===g)!)}</option>)}</select></label><Heatmap key={chosen} points={points}/></> : <p>ยังไม่มีพิกัดคลิก การกดด้วยคีย์บอร์ดดูได้จากรายการเหตุการณ์</p>}
      <details open={Boolean(typeof window!=='undefined' && window.location.hash.startsWith('#event-'))}><summary>รายการเหตุการณ์และหลักฐาน ({events.length})</summary>
        {events.map(e=><article id={`event-${e.id}`} tabIndex={-1} key={e.id} className={styles.evidence}><h4>{eventName(e.type)} · {screenName(e.screenId)}</h4><p>{e.elementId||'ไม่มีองค์ประกอบ'}{e.type==='pointer'?` · ตำแหน่งบนเนื้อหา (${e.documentX}, ${e.documentY})`:''}{e.type==='scroll'&&e.scrollY!==undefined?` · เลื่อนจากขอบบน ${e.scrollY} พิกเซล`:''}</p><small>โจทย์ {version.tasks.findIndex(t=>t.id===e.taskId)+1} · รอบ {e.sessionId} · ลำดับ {e.sequence} · เวลา {e.at} · เหตุการณ์ {e.id}</small></article>)}
      </details>
    </>}
  </section>;
}

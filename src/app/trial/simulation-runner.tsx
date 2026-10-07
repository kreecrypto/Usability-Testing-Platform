"use client";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { appendBehavior, behaviorIsActive, behaviorMessage, consentBehavior, retryBehavior, SIMULATION_LAYOUT, type BehaviorEvent } from '../../lib/trial/behavior';
import type { Store, Session, Version, Task } from '../../lib/trial/model';
import styles from './trial.module.css';
export default function SimulationRunner({store,session,version,task,commit,blocked,onPendingChange}:{store:Store;session:Session;version:Version;task:Task;commit:(fn:(s:Store)=>Store)=>Store|null;blocked:boolean;onPendingChange:(value:boolean,pending?:BehaviorEvent[])=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const latest=useRef({store,commit,blocked}); latest.current={store,commit,blocked};
  const pending=useRef<BehaviorEvent[]>([]);
  const [paused,setPaused]=useState(false);
  const [reload,setReload]=useState(0);
  const [withConsent,setWithConsent]=useState(false);
  useEffect(()=>{
    let sequence=Math.max(0,...(latest.current.store.behaviorEvents||[]).filter(e=>e.sessionId===session.id).map(e=>e.sequence));
    const onMessage=(message:MessageEvent)=>{
      const current=latest.current;
      if (paused || current.blocked || !session.behaviorConsentAt) return;
      const event=behaviorMessage(message,window.location.origin,frame.current?.contentWindow,{sessionId:session.id,versionId:version.id,taskId:task.id,sequence:++sequence});
      if (!event || !behaviorIsActive(current.store,event)) return;
      const alreadyPending=pending.current.length>0;
      pending.current.push(event);
      if (alreadyPending) {onPendingChange(true,pending.current);return;}
      let inactive=false;
      if (current.commit(s=>{if(!behaviorIsActive(s,event)){inactive=true;return s;}return appendBehavior(s,event);})) { pending.current.shift(); if(inactive)return; }
      else {setPaused(true);onPendingChange(true,pending.current);}
    };
    const leave=(e:BeforeUnloadEvent)=>{if(pending.current.length){e.preventDefault();}};
    window.addEventListener('message',onMessage);window.addEventListener('beforeunload',leave);
    return ()=>{window.removeEventListener('message',onMessage);window.removeEventListener('beforeunload',leave);};
  },[session.id,session.behaviorConsentAt,version.id,task.id,paused]);
  return <section className={styles.simulation} aria-label="เว็บจำลองสำหรับโจทย์นี้">
    <p><strong>เว็บจำลองสำหรับทดสอบระบบ</strong> — ข้อมูลบ้านและงานซ่อมเป็นข้อมูลสังเคราะห์ ไม่ใช่เว็บ Banrao จริง</p>
    {!session.behaviorConsentAt ? <>
      <p>เมื่อยินยอม ระบบจะเก็บคลิก การเปลี่ยนหน้า และการเลื่อนภายในเว็บจำลองเฉพาะโจทย์ที่กำลังทำ เก็บเฉพาะเบราว์เซอร์นี้ ไม่เก็บข้อความที่พิมพ์ คุณพักได้ทุกเมื่อ</p>
      <label className={styles.check}><Input appearance="legacy" type="checkbox" checked={withConsent} onChange={e=>setWithConsent(e.target.checked)}/>ยินยอมให้เก็บพฤติกรรมบนเว็บจำลอง</label>
      <Button variant="legacy" type="button" disabled={!withConsent} onClick={()=>commit(s=>consentBehavior(s,session.id))}>เริ่มเว็บจำลอง</Button>
    </> : <>
      <p role="status">{paused || blocked ? 'หยุดเก็บพฤติกรรมชั่วคราว' : `กำลังเก็บพฤติกรรมของโจทย์นี้ · บันทึกแล้ว ${(store.behaviorEvents||[]).filter(e=>e.sessionId===session.id && e.taskId===task.id).length} เหตุการณ์`}</p>
      {paused && <div role="alert"><p>มี {pending.current.length} เหตุการณ์ที่ยังบันทึกไม่ได้ เก็บไว้ในแท็บนี้ ให้ตรวจพื้นที่จัดเก็บหรือโหลดข้อมูลล่าสุดก่อนลองบันทึกอีกครั้ง อย่าปิดแท็บระหว่างนี้</p><Button variant="legacy" type="button" disabled={blocked} onClick={()=>{
        if(latest.current.commit(s=>retryBehavior(s,pending.current))) {pending.current=[];onPendingChange(false);setPaused(false);setReload(n=>n+1);}
      }}>บันทึกเหตุการณ์ค้างและทำต่อ</Button></div>}
      {!paused && !blocked && <iframe ref={frame} key={`${task.id}-${reload}`} src={`/trial/target?mode=run&layout=${SIMULATION_LAYOUT}`} title="เว็บจำลองบ้านเช่า — ทำโจทย์ภายในนี้" className={styles.targetFrame}/>}
      <small>การกดด้วยคีย์บอร์ดแสดงเป็นการกระทำ ไม่มีพิกัดสำหรับแผนที่ตำแหน่งคลิก</small>
    </>}
  </section>;
}

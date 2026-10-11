"use client";
import {Card} from '@/components/ui/card';
import {taskResults, answerElapsed, elapsedLabel, outcomeLabels} from '../../lib/trial/task-results';
import {selectedEvidence} from '../../lib/trial/behavior';
import type {Store,Version} from '../../lib/trial/model';
import styles from './trial.module.css';
export default function TaskResults({store,version}:{store:Store;version:Version}) {
  const query=new URLSearchParams(typeof window==='undefined'?'':window.location.search);
  const selected=selectedEvidence(store,version.id,query);
  const invalidSelection=['finding','report','evidence'].some(k=>query.has(k)) && !selected;
  return <section aria-label="ผลรายโจทย์"><h2>ผลรายโจทย์</h2>
    <p>ผลมาจากคำตอบของผู้ทดลอง ไม่ใช่การตรวจความสำเร็จจากเว็บไซต์ รอบที่ยังไม่ส่งครบไม่นับในอัตราทำได้</p>
    <p>เวลาตั้งแต่เริ่มโจทย์ถึงบันทึกคำตอบ รวมการให้คะแนน ความคิดเห็น และเวลาที่ออกจากแท็บหรือปิดเบราว์เซอร์ ไม่ใช่เวลาทำงานบนเว็บไซต์อย่างเดียว</p>
    {(selected || invalidSelection) && <p>ผลรายโจทย์เป็นภาพรวมของทั้งเวอร์ชัน ลิงก์เหตุการณ์ด้านล่างเปิดเฉพาะชุดหลักฐานที่อ้างอิงไว้ ไม่เปลี่ยนรายงานที่บันทึกแล้ว</p>}
    <div className="tw:overflow-x-auto" tabIndex={0} role="region" aria-label="ตารางผลรายโจทย์เลื่อนได้">
      <table className={styles.taskTable}><caption>ผลรายโจทย์ของเวอร์ชันนี้</caption>
        <thead><tr><th scope="col">โจทย์</th><th scope="col">คำตอบที่ส่งครบ</th><th scope="col">ผู้ทดลองตอบว่าทำได้</th><th scope="col">Median ถึงบันทึกคำตอบ</th></tr></thead>
        <tbody>{version.tasks.map((t,i)=>{const x=taskResults(store,version.id,t.id);return <tr key={t.id}>
          <th scope="row"><a href={`#task-result-${t.id}`}>โจทย์ {i+1}</a></th>
          <td>{x.count} รอบ · ทำได้ {x.done} / ทำไม่ได้ {x.notDone} / ข้าม {x.skipped} / เทคนิค {x.technicalBlocked}</td>
          <td>{x.rate===null?'ยังไม่มีข้อมูล':`${(x.rate*100).toLocaleString('th-TH',{maximumFractionDigits:1})}% (${x.done}/${x.eligible})`}</td>
          <td>{x.medianMs===null?'เวลาไม่พร้อม':elapsedLabel(x.medianMs)} ({x.timeCount} ตัวอย่าง)</td>
        </tr>;})}</tbody>
      </table>
    </div>
    {version.tasks.map((task,i)=>{
      const x=taskResults(store,version.id,task.id);
      return <Card asChild appearance="legacy" key={task.id}><section id={`task-result-${task.id}`} tabIndex={-1} className={styles.card} aria-label={`ผลโจทย์ ${i+1}`}>
        <h3>โจทย์ {i+1}: {task.instruction}</h3>
        <p>มีหลักฐานว่าเริ่มแล้ว {x.started} รอบ · บันทึกคำตอบแล้ว {x.answered} รอบ · ส่งครบ {x.count} รอบ · ยังไม่ส่งครบ {x.pending} รอบ</p>
        <small>นับเริ่มจากเวลาเริ่ม คำตอบ หรือเหตุการณ์ของโจทย์นี้ ข้อมูลเก่าที่ไม่มีหลักฐานเหล่านี้ระบุไม่ได้ว่าเริ่มหรือยัง</small>
        {!x.count?<p>ยังไม่มีคำตอบที่ส่งครบ เริ่มทดลองหรือกลับมาส่งรอบที่ค้าง</p>:<p>จำนวนคำตอบ {x.count} · ทำได้ {x.done} · ทำไม่ได้ {x.notDone} · ข้าม {x.skipped} · ปัญหาทางเทคนิค {x.technicalBlocked}</p>}
        <p>ผู้ทดลองตอบว่าทำได้: {x.rate===null?'ยังไม่มีข้อมูลที่เข้าเกณฑ์':`${(x.rate*100).toLocaleString('th-TH',{maximumFractionDigits:1})}% (${x.done}/${x.eligible} คำตอบ)`}</p>
        <small>สูตร: ทำได้ ÷ (ทำได้ + ทำไม่ได้ + ข้าม) ของรอบที่ส่งครบ แยกปัญหาทางเทคนิคออก</small>
        <p>เวลาตั้งแต่เริ่มโจทย์ถึงบันทึกคำตอบ — Median: {x.medianMs===null?'ยังไม่มีเวลาที่ใช้คำนวณได้':elapsedLabel(x.medianMs)} · {x.timeCount} ตัวอย่าง</p>
        <small>ใช้เฉพาะทำได้/ทำไม่ได้ของรอบที่ส่งครบและมีเวลาถูกต้อง ไม่นับข้าม ปัญหาทางเทคนิค และข้อมูลเก่าที่ไม่มีเวลา</small>
        <p>คะแนนความง่าย: {x.scoreCount?`${x.scoreCount} คำตอบ`:'ยังไม่มีคะแนน'}</p>
        {x.scoreCount>0 && <ul>{x.scores.map(s=><li key={s.score}>คะแนน {s.score}: {s.count} คำตอบ</li>)}</ul>}
        <details><summary>ตรวจคำตอบและหลักฐานรายรอบ ({x.rows.length})</summary>
          {!x.rows.length && <p>ยังไม่มีหลักฐานรายรอบของโจทย์นี้</p>}
          {x.rows.map(({session,answer})=>{
            const events=(store.behaviorEvents||[]).filter(e=>!invalidSelection && e.versionId===version.id && e.sessionId===session.id && e.taskId===task.id && (!selected || selected.eventIds.includes(e.id)));
            return <article key={session.id} className={styles.evidence}><h4>รอบ {store.sessions.filter(s=>s.versionId===version.id).findIndex(s=>s.id===session.id)+1}</h4>
              <p>{answer?`รายงานว่า: ${outcomeLabels[answer.outcome]}`:'ยังไม่บันทึกคำตอบ'} · {session.submittedAt?'ส่งครบแล้ว':'ยังไม่ส่งครบ — ไม่ใช้คำนวณอัตราทำได้'}</p>
              <p>{answer?elapsedLabel(answerElapsed(session,answer)):'เวลาไม่พร้อม'} · ความง่าย {answer?.ease==null?'ไม่ได้ให้คะแนน':`${answer.ease}/7`}</p>
              {answer?.technicalReason && <p>ปัญหาทางเทคนิค: {answer.technicalReason}</p>}
              <p>{answer?.feedback||'ไม่มีความคิดเห็นเพิ่มเติม'}</p><small>รอบ {session.id} · เวอร์ชัน {version.number} · โจทย์ {task.id}</small>
              {session.submittedAt && answer && <p><a href={`#answer-${session.id}-${task.id}`}>ดูคำตอบต้นทาง</a></p>}
              {events.length?<p><a href={`#event-${events[0].id}`}>ดูเหตุการณ์ต้นทางของรอบนี้ ({events.length} เหตุการณ์)</a></p>:<p>{selected || invalidSelection?'ชุดหลักฐานที่อ้างอิงไม่มีเหตุการณ์ของรอบและโจทย์นี้':'ไม่มีข้อมูลพฤติกรรม มีเฉพาะคำตอบหรือเวลาเริ่มที่บันทึกไว้'}</p>}
            </article>;
          })}
        </details>
      </section></Card>;
    })}
  </section>;
}

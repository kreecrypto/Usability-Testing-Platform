'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authenticatedFetch } from '../../../lib/auth/client';
import type { StudyVersion } from '../../../lib/test-overview';
import StudyWorkflow from '../../../components/navigation/study-workflow';
import styles from '../../projects/projects.module.css';

type Data = {
  test: { id: string; title: string; status: string; description: string | null };
  project: { id: string; name: string };
  versions: StudyVersion[];
  selectedVersionId: string | null;
  participants: { availability: string; started: number | null; completed: number | null };
};
const statusLabels: Record<string, string> = { draft: 'ฉบับร่าง', published: 'เผยแพร่แล้ว', closed: 'ปิดแล้ว', archived: 'เก็บเข้าคลัง' };

export default function TestOverview({ testId }: { testId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const endpoint = `/api/tests/${encodeURIComponent(testId)}`;
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void authenticatedFetch(`${endpoint}/overview${version ? `?versionId=${encodeURIComponent(version)}` : ''}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'กรุณาเข้าสู่ระบบเพื่อดูแบบทดสอบ' : response.status === 403 ? 'ไม่มีสิทธิ์ดูแบบทดสอบนี้' : response.status === 404 ? 'ไม่พบแบบทดสอบหรือเวอร์ชันที่เข้าถึงได้' : 'โหลดแบบทดสอบไม่สำเร็จ โปรดลองอีกครั้ง');
        return response.json() as Promise<Data>;
      })
      .then(value => { if (active) setData(value); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, version, retry]);

  const selected = data?.versions.find(item => item.id === data.selectedVersionId);
  const draft = data?.versions.find(item => item.lifecycle_status === 'draft');
  const methods = (draft ?? selected)?.study_mode === 'methods';
  const unavailable = data?.test.status === 'closed' || data?.test.status === 'archived';
  const unsupported = (draft ?? selected)?.study_mode === 'mixed';
  const builder = `/builder/${encodeURIComponent(testId)}`;
  async function save(event?: FormEvent<HTMLFormElement>, archive = false) {
    event?.preventDefault();
    if (busy || !data) return;
    if (archive && !window.confirm('เก็บแบบทดสอบเข้าคลัง? คุณยังเปิดผลของเวอร์ชันเดิมได้')) return;
    setBusy(true); setSaveError('');
    try {
      const response = await authenticatedFetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(archive ? { action: 'archive' } : { title: title.trim(), description: description.trim() || null }) });
      if (!response.ok) throw new Error(response.status === 403 ? 'ไม่มีสิทธิ์แก้ไขแบบทดสอบนี้' : response.status === 401 ? 'กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังอยู่' : 'บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง');
      setEditing(false); setRetry(value => value + 1);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }

  return <main className={styles.content}>
    <a href={data ? `/projects/${encodeURIComponent(data.project.id)}` : '/projects'}>← กลับโปรเจกต์{data ? ` ${data.project.name}` : ''}</a>
    <header className={styles.header}><div><p>แบบทดสอบ</p><h1>{data?.test.title ?? 'เปิดแบบทดสอบ'}</h1><p>{data?.test.description}</p></div></header>
    {loading ? <p role="status">กำลังโหลด…</p> : error ? <section className={styles.card}><p role="alert">{error}</p><button className={styles.secondaryButton} onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</button><a href="/login">เข้าสู่ระบบ</a></section> : data ? <>
      <section className={styles.card}>
        <h2>สิ่งที่ควรทำต่อ</h2><p>สถานะ: {statusLabels[data.test.status] ?? 'ไม่รองรับสถานะนี้'}</p>
        {unsupported ? <p>กิจกรรมแบบผสมยังไม่พร้อมเปิดรับผู้เข้าร่วม กรุณาตรวจนิยามกิจกรรมก่อน</p> : unavailable ? <p>แบบทดสอบนี้หยุดรับผู้เข้าร่วมแล้ว คุณยังตรวจผลของเวอร์ชันที่เผยแพร่ได้</p> : <div className={styles.actions}><a className={styles.primaryButton} href={`${builder}/${methods ? 'methods' : 'prototype'}`}>{draft ? 'แก้ไขฉบับร่าง' : selected ? 'สร้างฉบับร่างรอบใหม่' : 'ตั้งค่าแบบทดสอบ'}</a><a className={styles.secondaryButton} href={`${builder}/review`}>ตรวจสอบและเผยแพร่</a></div>}
        {saveError ? <p role="alert">{saveError}</p> : null}
        {editing ? <form className={styles.form} onSubmit={event => void save(event)}><label className={styles.field}>ชื่อแบบทดสอบ<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></label><label className={styles.field}>เป้าหมายการทดสอบ<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} /></label><div className={styles.actions}><button className={styles.primaryButton} disabled={busy}>บันทึกข้อมูล</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(false)}>ยกเลิก</button></div></form> : data.test.status !== 'archived' ? <div className={styles.actions}><button className={styles.secondaryButton} onClick={() => { setTitle(data.test.title); setDescription(data.test.description ?? ''); setEditing(true); }}>แก้ไขชื่อและเป้าหมาย</button><button className={styles.secondaryButton} disabled={busy} onClick={() => void save(undefined, true)}>เก็บเข้าคลัง</button></div> : null}
      </section>
      <section className={styles.card}>
        <h2>ผลของแต่ละเวอร์ชัน</h2>
        {data.versions.length ? <label className={styles.field}>เลือกเวอร์ชัน<select value={version || data.selectedVersionId || ''} onChange={event => setVersion(event.target.value)}><option value="" disabled>เลือกเวอร์ชัน</option>{data.versions.map(item => <option key={item.id} value={item.id}>เวอร์ชัน {item.version_no} · {item.lifecycle_status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</option>)}</select></label> : <p>ยังไม่มีเวอร์ชัน เริ่มตั้งค่าและบันทึกฉบับร่างก่อน</p>}
        {selected ? <>
          <p>เวอร์ชัน {selected.version_no} · {selected.study_mode === 'methods' ? 'กิจกรรมวิจัย' : selected.study_mode === 'mixed' ? 'กิจกรรมแบบผสม' : 'ต้นแบบหรือเว็บไซต์'}</p>
          {selected.study_mode === 'mixed' ? <p>Runner ยังไม่รองรับเวอร์ชันแบบผสมนี้</p> : <StudyWorkflow testId={testId} versionId={selected.id} methods={selected.study_mode === 'methods'} published={selected.lifecycle_status === 'published'} editable={!unavailable} current={3} />}
          {data.participants.availability === 'available' ? <p>เริ่มเข้าร่วม {data.participants.started} คน · ทำเสร็จ {data.participants.completed} คน</p> : <p>{data.participants.availability === 'restricted' ? 'ไม่มีสิทธิ์ดูข้อมูลผู้เข้าร่วม' : selected.lifecycle_status !== 'published' ? 'เผยแพร่เวอร์ชันนี้ก่อนเก็บผล' : 'ยังโหลดจำนวนผู้เข้าร่วมไม่ได้ โปรดลองอีกครั้ง'}</p>}
          {selected.lifecycle_status === 'published' && selected.study_mode !== 'mixed' && !unavailable ? <p>{selected.study_mode === 'methods' ? <a href={`${builder}/methods#invites`}>จัดการคำเชิญและการคัดกรอง →</a> : <a href={`/t/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">เปิดลิงก์ผู้เข้าร่วม →</a>}</p> : null}
        </> : null}
      </section>
    </> : null}
  </main>;
}

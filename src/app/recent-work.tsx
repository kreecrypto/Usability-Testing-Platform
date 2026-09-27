"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./recent-work.module.css";

type Project = Readonly<{ id: string; workspace_id: string; name: string; updated_at: string }>;
type StudyTest = Readonly<{ id: string; workspace_id: string; project_id: string; title: string; status: string; updated_at: string }>;
type RecentWork = Readonly<{ projects: Project[]; tests: StudyTest[] }>;
type State = "loading" | "ready" | "signed_out" | "error";

function statusLabel(status: string): string {
  if (status === "draft") return "ฉบับร่าง";
  if (status === "published") return "เผยแพร่แล้ว";
  if (status === "closed") return "ปิดแล้ว";
  return status;
}

export default function RecentWork() {
  const [state, setState] = useState<State>("loading");
  const [work, setWork] = useState<RecentWork | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const response = await fetch("/api/recent-work", { cache: "no-store", signal });
      if (response.status === 401) { setState("signed_out"); return; }
      if (!response.ok) throw new Error("recent_work_unavailable");
      const result = await response.json() as RecentWork;
      setWork(result);
      setState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return <section className={styles.section} aria-labelledby="recent-work-title">
    <div className={styles.heading}>
      <div><p className="eyebrow">Researcher Workspace</p><h2 id="recent-work-title">งานล่าสุด</h2></div>
      <a href="/projects">ดูการทดสอบทั้งหมด →</a>
    </div>
    {state === "loading" ? <p className={styles.state} role="status">กำลังโหลดงานล่าสุด…</p> : null}
    {state === "signed_out" ? <div className={styles.state}><p>เข้าสู่ระบบเพื่อดูโปรเจกต์และแบบทดสอบของคุณ</p><a href="/login">เข้าสู่ระบบ</a></div> : null}
    {state === "error" ? <div className={styles.state} role="alert"><p>โหลดงานล่าสุดไม่สำเร็จ</p><button type="button" onClick={() => void load()}>ลองอีกครั้ง</button></div> : null}
    {state === "ready" && work ? (
      work.projects.length === 0 && work.tests.length === 0
        ? <div className={styles.state}><p>ยังไม่มีงานล่าสุด สร้างโปรเจกต์เพื่อเริ่มการทดสอบครั้งแรก</p><a href="/projects/new">สร้างโปรเจกต์</a></div>
        : <div className={styles.grid}>
          <div className={styles.card}><h3>แบบทดสอบ</h3>{work.tests.length ? <ul>{work.tests.map((item) => <li key={item.id}><a href={`/builder/${encodeURIComponent(item.id)}/prototype`}>{item.title}</a><span>{statusLabel(item.status)}</span></li>)}</ul> : <p>ยังไม่มีแบบทดสอบ</p>}</div>
          <div className={styles.card}><h3>โปรเจกต์</h3>{work.projects.length ? <ul>{work.projects.map((item) => <li key={item.id}><a href={`/projects/${encodeURIComponent(item.id)}`}>{item.name}</a></li>)}</ul> : <p>ยังไม่มีโปรเจกต์</p>}</div>
        </div>
    ) : null}
  </section>;
}

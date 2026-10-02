"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "../lib/auth/client.ts";
import { friendlyError } from "../components/navigation/labels";
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
  const [errorMessage, setErrorMessage] = useState("");
  const [work, setWork] = useState<RecentWork | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const response = await authenticatedFetch("/api/recent-work", { cache: "no-store", signal }, false);
      if (response.status === 401) { setState("signed_out"); return; }
      if (!response.ok) throw new Error(response.status === 403 ? "permission_denied" : "recent_work_unavailable");
      const result = await response.json() as RecentWork;
      setWork(result);
      setState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage(friendlyError(error)); setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return <section className={styles.section} aria-labelledby="recent-work-title">
    <div className={styles.heading}>
      <div><h2 id="recent-work-title">งานล่าสุด</h2></div>
      <a href="/projects">ไปที่โปรเจกต์ →</a>
    </div>
    {state === "loading" ? <p className={styles.state} role="status">กำลังโหลดงานล่าสุด…</p> : null}
    {state === "signed_out" ? <div className={styles.state}><p>เข้าสู่ระบบเพื่อดูโปรเจกต์และแบบทดสอบของคุณ</p><a href="/login?next=%2Fprojects">เข้าสู่ระบบ</a> · <a href="/login?mode=signup&next=%2Fprojects">สร้างบัญชี</a></div> : null}
    {state === "error" ? <div className={styles.state} role="alert"><p>{errorMessage}</p><button type="button" onClick={() => void load()}>ลองอีกครั้ง</button></div> : null}
    {state === "ready" && work ? (
      work.projects.length === 0 && work.tests.length === 0
        ? <div className={styles.state}><p>ยังไม่มีงานล่าสุด สร้างโปรเจกต์เพื่อเริ่มการทดสอบครั้งแรก</p><a href="/projects/new">สร้างโปรเจกต์</a></div>
        : <div className={styles.grid}>
          <div className={styles.card}><h3>แบบทดสอบล่าสุด (ไม่เกิน 5 รายการ)</h3>{work.tests.length ? <ul>{work.tests.map((item) => <li key={item.id}><a href={`/tests/${encodeURIComponent(item.id)}`}>{item.title}</a><span>{statusLabel(item.status)}</span></li>)}</ul> : <p>ยังไม่มีแบบทดสอบ</p>}</div>
          <div className={styles.card}><h3>โปรเจกต์ล่าสุด (ไม่เกิน 5 รายการ)</h3>{work.projects.length ? <ul>{work.projects.map((item) => <li key={item.id}><a href={`/projects/${encodeURIComponent(item.id)}`}>{item.name}</a></li>)}</ul> : <p>ยังไม่มีโปรเจกต์</p>}</div>
        </div>
    ) : null}
  </section>;
}

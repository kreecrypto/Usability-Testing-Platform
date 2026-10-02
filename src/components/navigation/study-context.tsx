"use client";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "../../lib/auth/client.ts";
import { friendlyError } from "./labels";
import styles from "./study-navigation.module.css";
export default function StudyContext({ testId, versionId, versionNo }: { testId?: string | null; versionId?: string; versionNo?: number | null }) {
  const [context, setContext] = useState<{ testId: string; title: string; projectId: string; project: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setContext(null); setError("");
    if (!testId) return;
    async function load() {
      try {
        const response = await authenticatedFetch(`/api/tests/${encodeURIComponent(testId!)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 403 ? "permission_denied" : "context_unavailable");
        const { test } = await response.json();
        const projectResponse = await authenticatedFetch(`/api/projects/${encodeURIComponent(test.project_id)}`, { cache: "no-store" });
        if (!projectResponse.ok) throw new Error(projectResponse.status === 403 ? "permission_denied" : "context_unavailable");
        const { project } = await projectResponse.json();
        if (active) setContext({ testId: test.id, title: test.title, projectId: project.id, project: project.name });
      } catch (cause) { if (active) setError(friendlyError(cause, "โหลดชื่อโปรเจกต์และแบบทดสอบไม่สำเร็จ")); }
    }
    void load(); return () => { active = false; };
  }, [testId, retry]);
  const current = context?.testId === testId ? context : null;
  return <section className={styles.context} aria-label="บริบทแบบทดสอบ"><nav aria-label="ตำแหน่งปัจจุบัน"><a href="/">หน้าหลัก</a><span aria-hidden="true"> / </span><a href="/projects">โปรเจกต์</a>{current ? <><span aria-hidden="true"> / </span><a href={`/projects/${encodeURIComponent(current.projectId)}`}>{current.project}</a><span aria-hidden="true"> / </span><a href={`/projects/${encodeURIComponent(current.projectId)}/tests`}>แบบทดสอบในโปรเจกต์</a><span aria-hidden="true"> / </span><a href={`/tests/${encodeURIComponent(current.testId)}`}>{current.title}</a></> : null}</nav>
    {error ? <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>ลองโหลดชื่ออีกครั้ง</button></p> : testId && !current ? <p role="status">กำลังโหลดชื่อโปรเจกต์และแบบทดสอบ…</p> : null}
    {versionId ? <p>เวอร์ชัน {versionNo ?? "ไม่ระบุลำดับ"} · <span className={styles.identifier}>รหัสอ้างอิง {versionId}</span></p> : null}
  </section>;
}

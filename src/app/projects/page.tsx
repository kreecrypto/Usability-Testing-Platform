"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./projects.module.css";

type Workspace = { id: string; name: string };
type Project = { id: string; name: string };
type StudyTest = { id: string; title: string; status: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) throw new Error("request_failed");
  return await response.json() as T;
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [testTitle, setTestTitle] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (session.status === 401) { window.location.assign("/login"); return; }
      if (!session.ok) throw new Error("session_unavailable");
      const result = await request<{ workspaces: Workspace[] }>("/api/workspaces");
      if (active) {
        setWorkspaces(result.workspaces);
        const requestedWorkspaceId = new URLSearchParams(window.location.search).get("workspaceId");
        if (requestedWorkspaceId && result.workspaces.some((item) => item.id === requestedWorkspaceId)) {
          setWorkspaceId(requestedWorkspaceId);
        }
      }
    })().catch(() => { if (active) setError("เปิดรายการเวิร์กสเปซไม่สำเร็จ โปรดลองโหลดหน้าใหม่"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workspaceId) { setProjects([]); setProjectId(""); return; }
    let active = true;
    void request<{ projects: Project[] }>(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((result) => {
        if (!active) return;
        setProjects(result.projects);
        const requestedProjectId = new URLSearchParams(window.location.search).get("projectId");
        if (requestedProjectId && result.projects.some((item) => item.id === requestedProjectId)) {
          setProjectId(requestedProjectId);
        }
      })
      .catch(() => { if (active) setError("โหลดโปรเจกต์ไม่สำเร็จ โปรดลองอีกครั้ง"); });
    return () => { active = false; };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !projectId) { setTests([]); return; }
    let active = true;
    void request<{ tests: StudyTest[] }>(`/api/tests?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`)
      .then((result) => { if (active) setTests(result.tests); })
      .catch(() => { if (active) setError("โหลดแบบทดสอบไม่สำเร็จ โปรดลองอีกครั้ง"); });
    return () => { active = false; };
  }, [workspaceId, projectId]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !workspaceName.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const result = await request<{ workspaceId: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name: workspaceName.trim() }) });
      const refreshed = await request<{ workspaces: Workspace[] }>("/api/workspaces");
      setWorkspaces(refreshed.workspaces);
      setWorkspaceId(result.workspaceId);
      setProjectId(""); setProjects([]); setTests([]); setWorkspaceName("");
      setMessage("สร้างเวิร์กสเปซแล้ว เลือกหรือสร้างโปรเจกต์ต่อได้เลย");
    } catch { setError("สร้างเวิร์กสเปซไม่สำเร็จ โปรดตรวจชื่อและลองอีกครั้ง"); }
    finally { setWorking(false); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !workspaceId || !projectName.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const result = await request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ workspaceId, name: projectName.trim() }) });
      setProjects((current) => [...current, result.project]);
      setProjectId(result.project.id); setTests([]); setProjectName("");
      setMessage("สร้างโปรเจกต์แล้ว สร้างแบบทดสอบต่อได้เลย");
    } catch { setError("สร้างโปรเจกต์ไม่สำเร็จ โปรดตรวจชื่อและลองอีกครั้ง"); }
    finally { setWorking(false); }
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !workspaceId || !projectId || !testTitle.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const result = await request<{ test: StudyTest }>("/api/tests", { method: "POST", body: JSON.stringify({ workspaceId, projectId, title: testTitle.trim() }) });
      window.location.assign(`/builder/${encodeURIComponent(result.test.id)}/prototype`);
    } catch { setError("สร้างแบบทดสอบไม่สำเร็จ โปรดตรวจชื่อและลองอีกครั้ง"); setWorking(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.backLink}>← หน้าหลัก</a>
      <span className={styles.eyebrow}>Researcher Workspace</span>
      <h1>สร้างการทดสอบ</h1>
      <p>เลือกเวิร์กสเปซและโปรเจกต์ แล้วสร้างแบบทดสอบเพื่อกำหนดเป้าหมายและงาน</p>
    </header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {message ? <p className={styles.notice} role="status">{message}</p> : null}
    {loading ? <p role="status">กำลังโหลดเวิร์กสเปซ…</p> : <div className={styles.steps}>
      <section className={styles.card} aria-labelledby="workspace-heading">
        <div className={styles.stepHeading}><span>1</span><div><h2 id="workspace-heading">เวิร์กสเปซ</h2><p>พื้นที่ทำงานของทีมที่เป็นเจ้าของการทดสอบ</p></div></div>
        {workspaces.length ? <label className={styles.field} htmlFor="workspace-select">เลือกเวิร์กสเปซ
          <select id="workspace-select" value={workspaceId} disabled={working} onChange={(event) => { setWorkspaceId(event.target.value); setProjectId(""); setProjects([]); setTests([]); }}>
            <option value="">เลือกเวิร์กสเปซ</option>
            {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label> : <p className={styles.helper}>ยังไม่มีเวิร์กสเปซ สร้างพื้นที่ทำงานแรกด้านล่าง</p>}
        <form className={styles.form} onSubmit={(event) => void createWorkspace(event)}>
          <label className={styles.field} htmlFor="workspace-name">ชื่อเวิร์กสเปซใหม่
            <input id="workspace-name" required value={workspaceName} disabled={working} onChange={(event) => setWorkspaceName(event.target.value)} />
          </label>
          <button type="submit" className={styles.secondaryButton} disabled={working || !workspaceName.trim()}>สร้างเวิร์กสเปซ</button>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="project-heading">
        <div className={styles.stepHeading}><span>2</span><div><h2 id="project-heading">โปรเจกต์</h2><p>รวมแบบทดสอบของงานเดียวกันไว้ด้วยกัน</p></div></div>
        {!workspaceId ? <p className={styles.helper}>เลือกเวิร์กสเปซก่อน</p> : <>
          {projects.length ? <label className={styles.field} htmlFor="project-select">เลือกโปรเจกต์
            <select id="project-select" value={projectId} disabled={working} onChange={(event) => { setProjectId(event.target.value); setTests([]); }}>
              <option value="">เลือกโปรเจกต์</option>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label> : <p className={styles.helper}>ยังไม่มีโปรเจกต์ในเวิร์กสเปซนี้</p>}
          <form className={styles.form} onSubmit={(event) => void createProject(event)}>
            <label className={styles.field} htmlFor="project-name">ชื่อโปรเจกต์ใหม่
              <input id="project-name" required value={projectName} disabled={working} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <button type="submit" className={styles.secondaryButton} disabled={working || !projectName.trim()}>สร้างโปรเจกต์</button>
          </form>
        </>}
      </section>

      <section className={styles.card} aria-labelledby="test-heading">
        <div className={styles.stepHeading}><span>3</span><div><h2 id="test-heading">แบบทดสอบ</h2><p>ตั้งชื่อแล้วไปกำหนดเป้าหมายทดสอบในขั้นถัดไป</p></div></div>
        {!projectId ? <p className={styles.helper}>เลือกโปรเจกต์ก่อน</p> : <>
          {tests.length ? <ul className={styles.testList}>{tests.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</span></div><a href={`/builder/${encodeURIComponent(item.id)}/prototype`}>เปิดแบบทดสอบ</a></li>)}</ul> : <p className={styles.helper}>ยังไม่มีแบบทดสอบในโปรเจกต์นี้</p>}
          <form className={styles.form} onSubmit={(event) => void createTest(event)}>
            <label className={styles.field} htmlFor="test-title">ชื่อแบบทดสอบใหม่
              <input id="test-title" required value={testTitle} disabled={working} onChange={(event) => setTestTitle(event.target.value)} />
            </label>
            <button type="submit" className={styles.primaryButton} disabled={working || !testTitle.trim()}>{working ? "กำลังดำเนินการ…" : "สร้างและตั้งค่าเป้าหมายทดสอบ"}</button>
          </form>
        </>}
      </section>
    </div>}
  </main>;
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./projects.module.css";

type Workspace = { id: string; name: string };
type Project = { id: string; workspace_id: string; name: string; description: string | null; status: "active" | "archived" };
type StudyTest = { id: string; title: string; status: "draft" | "published" | "closed"; latestPublishedVersionId?: string | null; latestStudyMode?: "usability" | "methods" | "mixed" };
type Finding = { id: string; title: string; severity: string; status: string; test_version_id: string };
type Overview = { project: Project; tests: StudyTest[]; findings: Finding[] };
type View = "index" | "new-project" | "overview" | "tests" | "new-test";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json" } : undefined });
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error("request_failed");
  return await response.json() as T;
}

const labels = { draft: "ฉบับร่าง", published: "เผยแพร่แล้ว", closed: "ปิดแล้ว" };
const query = (value: string) => encodeURIComponent(value);
const projectHref = (id: string) => `/projects/${query(id)}`;
const testsHref = (id: string) => `${projectHref(id)}/tests`;
const newTestHref = (id: string) => `${testsHref(id)}/new`;
const testHref = (item: StudyTest) => item.status === "draft"
  ? `/builder/${query(item.id)}/${item.latestStudyMode === "methods" ? "methods" : "prototype"}`
  : item.latestPublishedVersionId ? `/${item.latestStudyMode === "methods" ? "methods/results" : "results"}/${query(item.latestPublishedVersionId)}` : null;

export default function ProjectsClient({ view, projectId }: { view: View; projectId?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsRetry, setProjectsRetry] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testKind, setTestKind] = useState<"target" | "methods">("target");

  const load = useCallback(async () => {
    setState("loading"); setError("");
    try {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (session.status === 401) { window.location.assign("/login"); return; }
      if (!session.ok) throw new Error("session_unavailable");
      if (projectId) {
        const data = await request<Overview>(`/api/projects/${query(projectId)}/overview`);
        setOverview(data);
      } else {
        const data = await request<{ workspaces: Workspace[] }>("/api/workspaces");
        setWorkspaces(data.workspaces);
        const requested = new URLSearchParams(window.location.search).get("workspaceId");
        setWorkspaceId((current) => current || (requested && data.workspaces.some((item) => item.id === requested) ? requested : data.workspaces[0]?.id ?? ""));
      }
      setState("ready");
    } catch { setState("error"); setError("โหลดข้อมูลไม่สำเร็จ โปรดลองอีกครั้ง"); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (projectId || !workspaceId || view !== "index") { setProjects([]); return; }
    let active = true;
    setState("loading");
    void request<{ projects: Project[] }>(`/api/projects?workspaceId=${query(workspaceId)}`)
      .then((data) => { if (active) { setProjects(data.projects.filter((item) => item.status !== "archived")); setState("ready"); } })
      .catch(() => { if (active) { setState("error"); setError("โหลดโปรเจกต์ไม่สำเร็จ โปรดลองอีกครั้ง"); } });
    return () => { active = false; };
  }, [workspaceId, projectId, view, projectsRetry]);

  function retryLoad() {
    if (view === "index" && workspaceId && workspaces.length) {
      setState("loading"); setError(""); setProjectsRetry((current) => current + 1);
    } else void load();
  }

  const visibleProjects = useMemo(() => projects.filter((item) => `${item.name} ${item.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [projects, search]);
  const visibleTests = useMemo(() => (overview?.tests ?? []).filter((item) => status === "all" || item.status === status), [overview, status]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !workspaceName.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ workspaceId: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name: workspaceName.trim() }) });
      setWorkspaces((current) => [...current, { id: result.workspaceId, name: workspaceName.trim() }]);
      setWorkspaceId(result.workspaceId); setWorkspaceName("");
    } catch { setError("สร้างเวิร์กสเปซไม่สำเร็จ โปรดลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !workspaceId || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ workspaceId, name: name.trim(), description: description.trim() || null }) });
      window.location.assign(projectHref(result.project.id));
    } catch { setError("สร้างโปรเจกต์ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง"); setBusy(false); }
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !overview || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ test: StudyTest }>("/api/tests", { method: "POST", body: JSON.stringify({ workspaceId: overview.project.workspace_id, projectId: overview.project.id, title: name.trim(), description: description.trim() || null }) });
      window.location.assign(`/builder/${query(result.test.id)}/${testKind === "methods" ? "methods" : "prototype"}`);
    } catch { setError("สร้างแบบทดสอบไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง"); setBusy(false); }
  }

  const title = view === "index" ? "โปรเจกต์" : view === "new-project" ? "สร้างโปรเจกต์" : view === "overview" ? overview?.project.name ?? "โปรเจกต์" : view === "tests" ? "แบบทดสอบ" : "สร้างแบบทดสอบ";
  return <main className={styles.shell}>
    <aside className={styles.sidebar} aria-label="เมนูโปรเจกต์"><a className={styles.brand} href="/">UT Platform</a><nav aria-label="เมนูหลัก"><a href="/">ภาพรวม</a><a href="/projects" aria-current={view === "index" ? "page" : undefined}>โปรเจกต์</a>{projectId ? <><a href={projectHref(projectId)} aria-current={view === "overview" ? "page" : undefined}>ภาพรวมโปรเจกต์</a><a href={testsHref(projectId)} aria-current={view === "tests" ? "page" : undefined}>แบบทดสอบ</a></> : null}</nav></aside>
    <div className={styles.content}>
      <header className={styles.header}><div><a className={styles.backLink} href={projectId ? projectHref(projectId) : "/"}>← {projectId ? "โปรเจกต์" : "หน้าหลัก"}</a><p className={styles.eyebrow}>Researcher Workspace</p><h1>{title}</h1><p>{view === "index" ? "จัดการโปรเจกต์และเริ่มการทดสอบของทีม" : view === "overview" ? overview?.project.description || "แบบทดสอบและประเด็นที่พบในโปรเจกต์นี้" : view === "tests" ? "เลือกแบบทดสอบเพื่อสร้างงานหรือดูผลจากเวอร์ชันที่เผยแพร่" : "กรอกข้อมูลเพื่อเริ่มงานวิจัย"}</p></div>{view === "index" ? <a className={styles.primaryButton} href="/projects/new">สร้างโปรเจกต์</a> : view === "overview" && projectId ? <a className={styles.primaryButton} href={newTestHref(projectId)}>สร้างแบบทดสอบ</a> : null}</header>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {state === "loading" ? <div className={styles.card} role="status">กำลังโหลดข้อมูล…</div> : state === "error" ? <div className={styles.card}><button className={styles.secondaryButton} type="button" onClick={retryLoad}>ลองอีกครั้ง</button></div> : null}
      {state === "ready" && (view === "index" || view === "new-project") ? <>
        {workspaces.length ? <label className={styles.field} htmlFor="workspace-select">เวิร์กสเปซ<select id="workspace-select" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} disabled={busy}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <section className={styles.card}><h2>เริ่มจากเวิร์กสเปซ</h2><p className={styles.helper}>สร้างพื้นที่ทำงานของทีมก่อนเพิ่มโปรเจกต์</p><form className={styles.form} onSubmit={(event) => void createWorkspace(event)}><label className={styles.field} htmlFor="workspace-name">ชื่อเวิร์กสเปซ<input id="workspace-name" required value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><button className={styles.secondaryButton} disabled={busy || !workspaceName.trim()}>สร้างเวิร์กสเปซ</button></form></section>}
        {view === "index" && workspaces.length ? <><label className={styles.field} htmlFor="project-search">ค้นหาโปรเจกต์<input id="project-search" type="search" placeholder="ค้นหาชื่อหรือรายละเอียด" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{projects.length === 0 ? <div className={styles.card}><h2>ยังไม่มีโปรเจกต์</h2><p>สร้างโปรเจกต์แรกเพื่อรวมแบบทดสอบและผลการศึกษา</p><a className={styles.primaryButton} href="/projects/new">สร้างโปรเจกต์</a></div> : visibleProjects.length === 0 ? <div className={styles.card}><h2>ไม่พบโปรเจกต์</h2><p>ลองคำค้นอื่น หรือแสดงโปรเจกต์ทั้งหมด</p><button type="button" className={styles.secondaryButton} onClick={() => setSearch("")}>ล้างคำค้น</button></div> : <ul className={styles.list}>{visibleProjects.map((item) => <li className={styles.card} key={item.id}><h2><a href={projectHref(item.id)}>{item.name}</a></h2><p>{item.description || "ยังไม่มีคำอธิบาย"}</p><a href={projectHref(item.id)}>เปิดโปรเจกต์ →</a></li>)}</ul>}</> : null}
        {view === "new-project" && workspaces.length ? <section className={styles.card}><form className={styles.form} onSubmit={(event) => void createProject(event)}><label className={styles.field} htmlFor="project-name">ชื่อโปรเจกต์ <span aria-hidden="true">*</span><input id="project-name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label><label className={styles.field} htmlFor="project-description">คำอธิบาย (ไม่บังคับ)<textarea id="project-description" maxLength={1000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} /></label><div className={styles.actions}><a className={styles.secondaryButton} href="/projects">ยกเลิก</a><button className={styles.primaryButton} disabled={busy || !workspaceId || !name.trim()}>{busy ? "กำลังสร้าง…" : "สร้างโปรเจกต์"}</button></div></form></section> : null}
      </> : null}
      {state === "ready" && overview && projectId && view === "overview" ? <><section className={styles.card}><div className={styles.sectionHead}><div><h2>แบบทดสอบ</h2><p>งานที่อยู่ในโปรเจกต์นี้</p></div><a href={testsHref(projectId)}>ดูทั้งหมด →</a></div>{overview.tests.length ? <TestList items={overview.tests.slice(0, 5)} /> : <div className={styles.empty}><p>ยังไม่มีแบบทดสอบ</p><a href={newTestHref(projectId)}>สร้างแบบทดสอบแรก</a></div>}</section><section className={styles.card}><h2>ประเด็นที่พบ</h2>{overview.findings.length ? <ul className={styles.list}>{overview.findings.map((item) => <li key={item.id}><a href={`/findings/${query(item.test_version_id)}`}>{item.title}</a><span>{item.severity} · {item.status}</span></li>)}</ul> : <p className={styles.helper}>ยังไม่มีประเด็นที่พบ เมื่อมีหลักฐานจากการทดสอบแล้วจึงบันทึก Findings ได้</p>}</section></> : null}
      {state === "ready" && overview && projectId && view === "tests" ? <section className={styles.card}><div className={styles.sectionHead}><p>แบบทดสอบใน {overview.project.name}</p><a className={styles.primaryButton} href={newTestHref(projectId)}>สร้างแบบทดสอบ</a></div><label className={styles.field} htmlFor="test-status">สถานะ<select id="test-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">ทั้งหมด</option><option value="draft">ฉบับร่าง</option><option value="published">เผยแพร่แล้ว</option><option value="closed">ปิดแล้ว</option></select></label>{visibleTests.length ? <TestList items={visibleTests} /> : <div className={styles.empty}><p>{overview.tests.length ? "ไม่มีแบบทดสอบในสถานะนี้" : "ยังไม่มีแบบทดสอบในโปรเจกต์นี้"}</p><a href={newTestHref(projectId)}>สร้างแบบทดสอบ</a></div>}</section> : null}
      {state === "ready" && overview && projectId && view === "new-test" ? <section className={styles.card}><p>โปรเจกต์: <strong>{overview.project.name}</strong></p><form className={styles.form} onSubmit={(event) => void createTest(event)}><label className={styles.field} htmlFor="test-title">ชื่อแบบทดสอบ <span aria-hidden="true">*</span><input id="test-title" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label><label className={styles.field} htmlFor="test-description">เป้าหมายการทดสอบ (ไม่บังคับ)<textarea id="test-description" rows={4} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} /></label><label className={styles.field} htmlFor="test-kind">วิธีทดสอบ<select id="test-kind" value={testKind} onChange={(event) => setTestKind(event.target.value as "target" | "methods")} disabled={busy}><option value="target">Prototype / Website Test</option><option value="methods">Survey / Card Sorting / Tree Testing</option></select></label><div className={styles.actions}><a className={styles.secondaryButton} href={testsHref(projectId)}>ยกเลิก</a><button className={styles.primaryButton} disabled={busy || !name.trim()}>{busy ? "กำลังสร้าง…" : testKind === "methods" ? "สร้างฉบับร่างและเพิ่มกิจกรรม" : "สร้างฉบับร่างและตั้งค่าเป้าหมาย"}</button></div></form></section> : null}
    </div>
  </main>;
}

function TestList({ items }: { items: StudyTest[] }) {
  return <ul className={styles.list}>{items.map((item) => { const href = testHref(item); return <li key={item.id} className={styles.testRow}><div>{href ? <a href={href}>{item.title}</a> : <strong>{item.title}</strong>}<span>{labels[item.status]}</span></div>{href ? <a href={href}>{item.status === "draft" ? "แก้ไขแบบทดสอบ →" : "ดูผลการทดสอบ →"}</a> : <span>ยังไม่มีผลจากเวอร์ชันที่เผยแพร่</span>}</li>; })}</ul>;
}

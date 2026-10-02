"use client";

import { authenticatedFetch, SESSION_MESSAGE } from "../../lib/auth/client.ts";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import MainNavigation from "../../components/navigation/main-navigation";
import { friendlyError } from "../../components/navigation/labels";
import styles from "./projects.module.css";

type Workspace = { id: string; name: string };
type Project = { id: string; workspace_id: string; name: string; description: string | null; status: "active" | "archived" };
type StudyTest = { id: string; title: string; status: "draft" | "published" | "closed" | "archived"; latestPublishedVersionId?: string | null; latestStudyMode?: "usability" | "methods" | "mixed" };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type Finding = { id: string; title: string; severity: string; status: string; test_version_id: string; studyMode?: string | null };
type Overview = { project: Project; tests: StudyTest[]; findings: Finding[] };
type View = "index" | "new-project" | "overview" | "tests" | "new-test";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json" } : undefined });
  if (response.status === 401) { throw new Error(SESSION_MESSAGE); }
  if (!response.ok) throw new Error(response.status === 403 ? "permission_denied" : response.status === 404 ? "not_found" : "request_failed");
  return await response.json() as T;
}

const labels = { draft: "ฉบับร่าง", published: "เผยแพร่แล้ว", closed: "ปิดแล้ว", archived: "เก็บเข้าคลัง" };
const query = (value: string) => encodeURIComponent(value);
const projectHref = (id: string) => `/projects/${query(id)}`;
const testsHref = (id: string) => `${projectHref(id)}/tests`;
const newTestHref = (id: string) => `${testsHref(id)}/new`;
const testHref = (item: StudyTest) => `/tests/${query(item.id)}`;

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
  const [testKind, setTestKind] = useState<"target" | "survey" | "card_sort" | "tree_test">("target");
  const [page, setPage] = useState(1);
  const [listing, setListing] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [pagedTests, setPagedTests] = useState<StudyTest[]>([]);
  const [editingProject, setEditingProject] = useState(false);
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading"); setError("");
    try {
      const session = await authenticatedFetch("/api/auth/session", { cache: "no-store" });
      if (session.status === 401) { throw new Error(SESSION_MESSAGE); }
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
    } catch (cause) { setState("error"); setError(friendlyError(cause)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (projectId || !workspaceId || view !== "index") return;
    let active = true;
    setListing(true); setPagination(null); setError("");
    void request<{ projects: Project[]; pagination: Pagination }>(`/api/projects?workspaceId=${query(workspaceId)}&page=${page}&search=${query(search)}&status=${query(status)}`)
      .then((data) => { if (active) { setProjects(data.projects); setPagination(data.pagination); setListing(false); setState("ready"); } })
      .catch(() => { if (active) { setState("error"); setError("โหลดโปรเจกต์ไม่สำเร็จ โปรดลองอีกครั้ง"); } });
    return () => { active = false; };
  }, [workspaceId, projectId, view, projectsRetry, page, search, status]);

  function retryLoad() {
    if (view === "index" && workspaceId && workspaces.length) {
      setState("loading"); setError(""); setProjectsRetry((current) => current + 1);
    } else void load();
  }

  useEffect(() => {
    if (!overview || !projectId || (view !== "tests" && view !== "overview")) return;
    let active = true;
    setListing(true); setPagination(null); setError("");
    void request<{ tests: StudyTest[]; pagination: Pagination }>(`/api/tests?workspaceId=${query(overview.project.workspace_id)}&projectId=${query(projectId)}&page=${page}&search=${query(search)}&status=${query(status)}`)
      .then(data => { if (active) { setPagedTests(data.tests); setPagination(data.pagination); setListing(false); } })
      .catch(cause => { if (active) { setPagedTests([]); setError(friendlyError(cause)); setState("error"); } });
    return () => { active = false; };
  }, [overview, projectId, view, page, search, status, projectsRetry]);
  const visibleProjects = projects;
  const visibleTests = pagedTests;
  const paging = pagination ? <nav className={styles.actions} aria-label="หน้ารายการ"><button className={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>หน้าก่อน</button><span>พบ {pagination.total} รายการ · หน้า {page} จาก {Math.max(1, pagination.totalPages)}</span><button className={styles.secondaryButton} disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>หน้าถัดไป</button></nav> : null;
  const filters = <div className={styles.actions}><label className={styles.field}>ค้นหาชื่อ<input type="search" maxLength={160} value={search} onChange={event => {setSearch(event.target.value);setPage(1);}} /></label><label className={styles.field}>สถานะ<select value={status} onChange={event => {setStatus(event.target.value);setPage(1);}}><option value="all">ทั้งหมด</option>{view === "index" ? <><option value="active">ใช้งานอยู่</option><option value="archived">เก็บเข้าคลัง</option></> : <><option value="draft">ฉบับร่าง</option><option value="published">เผยแพร่แล้ว</option><option value="closed">ปิดแล้ว</option><option value="archived">เก็บเข้าคลัง</option></>}</select></label></div>;
  async function saveProject(event?: FormEvent<HTMLFormElement>, archive = false) {
    event?.preventDefault(); if (!overview || busy) return;
    if (archive && !window.confirm("เก็บโปรเจกต์เข้าคลัง? คุณยังดูแบบทดสอบและผลเดิมได้")) return;
    setBusy(true);setError("");
    try { await request(`/api/projects/${query(overview.project.id)}`, { method: "PATCH", body: JSON.stringify(archive ? {action:"archive"} : {name:name.trim(),description:description.trim()||null}) });setEditingProject(false);await load(); }
    catch(cause) {setError(friendlyError(cause));} finally {setBusy(false);}
  }

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
      // Keep the created ID if method initialization fails: retry must not create another test.
      const id = createdTestId ?? (await request<{ test: StudyTest }>("/api/tests", { method: "POST", body: JSON.stringify({ workspaceId: overview.project.workspace_id, projectId: overview.project.id, title: name.trim(), description: description.trim() || null }) })).test.id;
      setCreatedTestId(id);
      if (testKind !== "target") await request(`/api/tests/${query(id)}/methods`, {method:"POST",body:JSON.stringify({action:"initialize"})});
      window.location.assign(`/builder/${query(id)}/${testKind !== "target" ? `methods?kind=${testKind}` : "prototype"}`);
    } catch { setError("สร้างแบบทดสอบไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง"); setBusy(false); }
  }

  const title = view === "index" ? "โปรเจกต์" : view === "new-project" ? "สร้างโปรเจกต์" : view === "overview" ? overview?.project.name ?? "โปรเจกต์" : view === "tests" ? "แบบทดสอบ" : "สร้างแบบทดสอบ";
  return <main className={styles.shell}>
    <aside className={styles.sidebar} aria-label="เมนูโปรเจกต์"><a className={styles.brand} href="/">UT Platform</a><MainNavigation current={view === "index" ? "/projects" : undefined} projectId={projectId} /></aside>
    <div className={styles.content}>
      <header className={styles.header}><div><a className={styles.backLink} href={projectId ? projectHref(projectId) : "/"}>← {projectId ? "โปรเจกต์" : "หน้าหลัก"}</a><p className={styles.eyebrow}>พื้นที่ทำงานวิจัย</p><h1>{title}</h1><p>{view === "index" ? "โปรเจกต์ใช้รวมแบบทดสอบและผลการศึกษาของงานเดียวกัน" : view === "overview" ? overview?.project.description || "แบบทดสอบและข้อค้นพบในโปรเจกต์นี้" : view === "tests" ? "เลือกแบบทดสอบเพื่อสร้างงานหรือดูผลจากเวอร์ชันที่เผยแพร่" : "กรอกข้อมูลเพื่อเริ่มงานวิจัย"}</p></div>{view === "index" ? <a className={styles.primaryButton} href="/projects/new">สร้างโปรเจกต์</a> : view === "overview" && projectId && overview?.project.status === "active" ? <a className={styles.primaryButton} href={newTestHref(projectId)}>สร้างแบบทดสอบ</a> : null}</header>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {state === "loading" ? <div className={styles.card} role="status">กำลังโหลดข้อมูล…</div> : state === "error" ? <div className={styles.card}><button className={styles.secondaryButton} type="button" onClick={retryLoad}>ลองอีกครั้ง</button></div> : null}
      {state === "ready" && (view === "index" || view === "new-project") ? <>
        {workspaces.length ? <label className={styles.field} htmlFor="workspace-select">เวิร์กสเปซ<select id="workspace-select" value={workspaceId} onChange={(event) => {setWorkspaceId(event.target.value);setPage(1);}} disabled={busy}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <section className={styles.card}><h2>เริ่มจากเวิร์กสเปซ</h2><p className={styles.helper}>สร้างพื้นที่ทำงานของทีมก่อนเพิ่มโปรเจกต์</p><form className={styles.form} onSubmit={(event) => void createWorkspace(event)}><label className={styles.field} htmlFor="workspace-name">ชื่อเวิร์กสเปซ<input id="workspace-name" required value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><button className={styles.secondaryButton} disabled={busy || !workspaceName.trim()}>สร้างเวิร์กสเปซ</button></form></section>}
        {view === "index" && workspaces.length ? <>{filters}{listing ? <p role="status">กำลังโหลดรายการโปรเจกต์…</p> : projects.length === 0 ? <div className={styles.card}><h2>ยังไม่มีโปรเจกต์</h2><p>สร้างโปรเจกต์แรกเพื่อรวมแบบทดสอบและผลการศึกษา</p><a className={styles.primaryButton} href="/projects/new">สร้างโปรเจกต์</a></div> : visibleProjects.length === 0 ? <div className={styles.card}><h2>ไม่พบโปรเจกต์</h2><p>ลองคำค้นอื่น หรือแสดงโปรเจกต์ทั้งหมด</p><button type="button" className={styles.secondaryButton} onClick={() => {setSearch("");setStatus("all");setPage(1);}}>ล้างคำค้น</button></div> : <ul className={styles.list}>{visibleProjects.map((item) => <li className={styles.card} key={item.id}><h2><a href={projectHref(item.id)}>{item.name}</a></h2><p>{item.description || "ยังไม่มีคำอธิบาย"}</p><a href={projectHref(item.id)}>เปิดโปรเจกต์ →</a></li>)}</ul>}{paging}</> : null}
        {view === "new-project" && workspaces.length ? <section className={styles.card}><form className={styles.form} onSubmit={(event) => void createProject(event)}><label className={styles.field} htmlFor="project-name">ชื่อโปรเจกต์ <span aria-hidden="true">*</span><input id="project-name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={busy || Boolean(createdTestId)} /></label><label className={styles.field} htmlFor="project-description">คำอธิบาย (ไม่บังคับ)<textarea id="project-description" maxLength={1000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy || Boolean(createdTestId)} /></label><div className={styles.actions}><a className={styles.secondaryButton} href="/projects">ยกเลิก</a><button className={styles.primaryButton} disabled={busy || !workspaceId || !name.trim()}>{busy ? "กำลังสร้าง…" : "สร้างโปรเจกต์"}</button></div></form></section> : null}
      </> : null}
      {state === "ready" && overview && projectId && view === "overview" ? <><section className={styles.card}><h2>ข้อมูลโปรเจกต์</h2><p>สถานะ: {overview.project.status === "archived" ? "เก็บเข้าคลัง" : "ใช้งานอยู่"}</p>{editingProject ? <form className={styles.form} onSubmit={event => void saveProject(event)}><label className={styles.field}>ชื่อโปรเจกต์<input required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label><label className={styles.field}>เป้าหมายและคำอธิบาย<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} /></label><div className={styles.actions}><button className={styles.primaryButton} disabled={busy}>บันทึก</button><button type="button" className={styles.secondaryButton} onClick={() => setEditingProject(false)}>ยกเลิก</button></div></form> : overview.project.status === "active" ? <div className={styles.actions}><button className={styles.secondaryButton} onClick={() => {setName(overview.project.name);setDescription(overview.project.description ?? "");setEditingProject(true);}}>แก้ไขข้อมูล</button><button className={styles.secondaryButton} disabled={busy} onClick={() => void saveProject(undefined,true)}>เก็บเข้าคลัง</button></div> : <p>โปรเจกต์นี้เก็บเข้าคลังแล้ว คุณยังตรวจผลเดิมได้</p>}</section><section className={styles.card}><div className={styles.sectionHead}><div><h2>แบบทดสอบ</h2><p>งานที่อยู่ในโปรเจกต์นี้</p></div><a href={testsHref(projectId)}>ดูทั้งหมด →</a></div>{filters}{pagination ? visibleTests.length ? <TestList items={visibleTests} /> : <div className={styles.empty}><p>ยังไม่มีแบบทดสอบ</p><a href={newTestHref(projectId)}>สร้างแบบทดสอบแรก</a></div> : <p role="status">กำลังโหลดแบบทดสอบ…</p>}{paging}</section><section className={styles.card}><h2>ข้อค้นพบล่าสุด 5 รายการ</h2>{overview.findings.length ? <ul className={styles.list}>{overview.findings.map((item) => <li key={item.id}>{item.studyMode === "methods" || item.studyMode === "usability" ? <a href={`${item.studyMode === "methods" ? "/methods" : ""}/findings/${query(item.test_version_id)}`}>{item.title}</a> : <span>{item.title} · ยังเปิดหลักฐานของวิธีนี้ไม่ได้</span>}<span>{item.severity} · {item.status}</span></li>)}</ul> : <p className={styles.helper}>ยังไม่มีข้อค้นพบ เมื่อมีหลักฐานจากการทดสอบแล้วจึงบันทึกข้อค้นพบได้</p>}</section></> : null}
      {state === "ready" && overview && projectId && view === "tests" ? <section className={styles.card}><div className={styles.sectionHead}><p>แบบทดสอบใน {overview.project.name}</p><a className={styles.primaryButton} href={newTestHref(projectId)}>สร้างแบบทดสอบ</a></div>{filters}{pagination ? visibleTests.length ? <TestList items={visibleTests} /> : <div className={styles.empty}><p>{overview.tests.length ? "ไม่มีแบบทดสอบในสถานะนี้" : "ยังไม่มีแบบทดสอบในโปรเจกต์นี้"}</p><a href={newTestHref(projectId)}>สร้างแบบทดสอบ</a></div> : <p role="status">กำลังโหลดแบบทดสอบ…</p>}{paging}</section> : null}
      {state === "ready" && overview && projectId && view === "new-test" && overview.project.status === "active" ? <section className={styles.card}><p>โปรเจกต์: <strong>{overview.project.name}</strong></p><form className={styles.form} onSubmit={(event) => void createTest(event)}><label className={styles.field} htmlFor="test-title">ชื่อแบบทดสอบ <span aria-hidden="true">*</span><input id="test-title" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={busy || Boolean(createdTestId)} /></label><label className={styles.field} htmlFor="test-description">เป้าหมายการทดสอบ (ไม่บังคับ)<textarea id="test-description" rows={4} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy || Boolean(createdTestId)} /></label><label className={styles.field} htmlFor="test-kind">วิธีทดสอบ<select id="test-kind" value={testKind} onChange={(event) => setTestKind(event.target.value as typeof testKind)} disabled={busy || Boolean(createdTestId)}><option value="target">ทดสอบต้นแบบหรือเว็บไซต์</option><option value="survey">แบบสอบถาม</option><option value="card_sort">จัดกลุ่มข้อมูล</option><option value="tree_test">ค้นหาข้อมูลในโครงสร้างเมนู</option></select></label><p className={styles.helper}>{testKind !== "target" ? "เพิ่มแบบสอบถาม กิจกรรมจัดกลุ่มข้อมูล หรือโจทย์ค้นหาในโครงสร้างเมนู โดยไม่ต้องใช้ลิงก์เว็บไซต์" : "เตรียมลิงก์ Figma Prototype หรือเว็บไซต์ และงานที่ต้องการให้ผู้เข้าร่วมทำ"}</p><div className={styles.actions}><a className={styles.secondaryButton} href={testsHref(projectId)}>ยกเลิก</a><button className={styles.primaryButton} disabled={busy || !name.trim()}>{busy ? "กำลังสร้าง…" : testKind !== "target" ? "สร้างฉบับร่างและเพิ่มกิจกรรม" : "สร้างฉบับร่างและตั้งค่าเป้าหมาย"}</button></div></form></section> : null}
      {state === "ready" && view === "new-test" && overview?.project.status === "archived" ? <section className={styles.card}><h2>โปรเจกต์นี้เก็บเข้าคลังแล้ว</h2><p>เปิดรายการแบบทดสอบเพื่อดูงานและผลเดิม</p><a href={testsHref(overview.project.id)}>ดูแบบทดสอบ</a></section> : null}
    </div>
  </main>;
}

function TestList({ items }: { items: StudyTest[] }) {
  return <ul className={styles.list}>{items.map((item) => { const href = testHref(item); return <li key={item.id} className={styles.testRow}><div>{href ? <a href={href}>{item.title}</a> : <strong>{item.title}</strong>}<span>{labels[item.status]}</span></div>{href ? <a href={href}>{"เปิดแบบทดสอบ →"}</a> : <span>ยังไม่มีผลจากเวอร์ชันที่เผยแพร่</span>}</li>; })}</ul>;
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Workspace = { id: string; name: string; slug: string };
type Project = { id: string; workspace_id: string; name: string; description: string | null; status: string };
type StudyTest = { id: string; workspace_id: string; project_id: string; title: string; description: string | null; status: string };
type Task = { id: string; title: string; ordinal: number };

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof body?.error === "string" ? body.error : "request_failed";
    throw new Error(code);
  }
  return body as T;
}

export default function ProjectsPage() {
  const [ready, setReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [testId, setTestId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceName, setWorkspaceName] = useState("UTP Internal Validation");
  const [projectName, setProjectName] = useState("Golden Path");
  const [testTitle, setTestTitle] = useState("MAJOR-A Flow Proven");
  const [targetUrl, setTargetUrl] = useState("https://usability-testing-platform.vercel.app/internal-validation-target");
  const [taskTitle, setTaskTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [instruction, setInstruction] = useState("");
  const [publishedVersionId, setPublishedVersionId] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    if (response.status === 401) { window.location.replace("/login"); return; }
    const body = await json<{ workspaces: Workspace[] }>(response);
    setWorkspaces(body.workspaces);
    setWorkspaceId((current) => current || body.workspaces[0]?.id || "");
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (!session.ok) {
        const temporary = await fetch("/api/auth/guest", { method: "POST", cache: "no-store" });
        if (!temporary.ok) { window.location.replace("/login"); return; }
      }
      await loadWorkspaces();
      setReady(true);
    })().catch(() => setMessage("โหลด Researcher workspace ไม่สำเร็จ"));
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!workspaceId) { setProjects([]); setProjectId(""); return; }
    void fetch(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" })
      .then((r) => json<{ projects: Project[] }>(r))
      .then((body) => {
        setProjects(body.projects);
        setProjectId((current) => body.projects.some((p) => p.id === current) ? current : body.projects[0]?.id || "");
      })
      .catch(() => setMessage("โหลด Project ไม่สำเร็จ"));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !projectId) { setTests([]); setTestId(""); return; }
    void fetch(`/api/tests?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then((r) => json<{ tests: StudyTest[] }>(r))
      .then((body) => {
        setTests(body.tests);
        setTestId((current) => body.tests.some((t) => t.id === current) ? current : body.tests[0]?.id || "");
      })
      .catch(() => setMessage("โหลด Test ไม่สำเร็จ"));
  }, [workspaceId, projectId]);

  const loadTasks = useCallback(async (selectedTestId: string) => {
    if (!selectedTestId) { setTasks([]); return; }
    const body = await json<{ tasks: Task[] }>(await fetch(`/api/tests/${encodeURIComponent(selectedTestId)}/tasks`, { cache: "no-store" }));
    setTasks(body.tasks);
  }, []);

  useEffect(() => { void loadTasks(testId).catch(() => setTasks([])); }, [testId, loadTasks]);

  async function run(label: string, action: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setMessage("");
    try { await action(); setMessage(`${label} สำเร็จ`); }
    catch (error) { setMessage(`${label} ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown"}`); }
    finally { setWorking(false); }
  }

  function createWorkspace(event: FormEvent) {
    event.preventDefault();
    void run("สร้าง Workspace", async () => {
      await json(await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: workspaceName }) }));
      await loadWorkspaces();
    });
  }

  function createProject(event: FormEvent) {
    event.preventDefault();
    void run("สร้าง Project", async () => {
      const body = await json<{ project: Project }>(await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, name: projectName, description: "Internal real-flow validation for MAJOR-A" }) }));
      setProjects((items) => [body.project, ...items]);
      setProjectId(body.project.id);
    });
  }

  function createTest(event: FormEvent) {
    event.preventDefault();
    void run("สร้าง Test", async () => {
      const body = await json<{ test: StudyTest }>(await fetch("/api/tests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, projectId, title: testTitle, description: "Flow Proven real study" }) }));
      setTests((items) => [body.test, ...items]);
      setTestId(body.test.id);
    });
  }

  function configureTarget(event: FormEvent) {
    event.preventDefault();
    void run("ตั้งค่า Test Target", async () => {
      await json(await fetch(`/api/tests/${encodeURIComponent(testId)}/prototype`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl, ownership: "owned", environment: "production" }),
      }));
    });
  }

  function preflightTarget() {
    if (!testId) return;
    void run("ตรวจ Target", async () => {
      await json(await fetch(`/api/tests/${encodeURIComponent(testId)}/prototype`, {
        method: "POST",
        cache: "no-store",
      }));
    });
  }

  function createTask(event: FormEvent) {
    event.preventDefault();
    void run("เพิ่ม Task", async () => {
      await json(await fetch(`/api/tests/${encodeURIComponent(testId)}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: taskTitle, scenario, instruction }),
      }));
      setTaskTitle(""); setScenario(""); setInstruction("");
      await loadTasks(testId);
    });
  }

  function publish() {
    void run("Publish", async () => {
      const body = await json<{ preview: { testVersionId: string } }>(await fetch(`/api/tests/${encodeURIComponent(testId)}/publish`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish" }),
      }));
      setPublishedVersionId(body.preview.testVersionId);
    });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  if (!ready) return <main style={{ padding: 32 }}>กำลังโหลด Researcher workspace…</main>;

  const block = { background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: 12, padding: 20 } as const;
  const input = { minHeight: 42, border: "1px solid var(--ah-hairline)", borderRadius: 8, padding: "0 10px", background: "white", width: "100%" } as const;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="Researcher menu">
          <a className="navItem active" href="/projects">Projects</a>
          <a className="navItem" href="/high-fi">Design QA</a>
          <button className="navItem" type="button" onClick={() => void signOut()} style={{ border: 0, textAlign: "left", background: "transparent" }}>เริ่ม Session ใหม่</button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">MAJOR-A / Flow Proven</p><h1>สร้าง Study จริงบน Production</h1></div>
        </header>

        {message ? <p role="status" style={{ ...block, marginBottom: 16 }}>{message}</p> : null}

        <div style={{ display: "grid", gap: 16 }}>
          <section style={block}>
            <h2 style={{ marginTop: 0 }}>1. Workspace</h2>
            {workspaces.length ? (
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} style={input}>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : (
              <form onSubmit={createWorkspace} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input required value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <button className="primaryButton" disabled={working}>สร้าง Workspace</button>
              </form>
            )}
          </section>

          <section style={block} aria-labelledby="recent-work-heading">
            <h2 id="recent-work-heading" style={{ marginTop: 0 }}>Recent work</h2>
            {!workspaceId ? <p>เลือกหรือสร้าง Workspace เพื่อดูงานล่าสุด</p> : projects.length === 0 ? <p role="status">ยังไม่มี Project ใน Workspace นี้ — สร้าง Project แรกเพื่อเริ่ม Study</p> : <div style={{ display: "grid", gap: 10 }}>{projects.slice(0, 5).map((project) => <article key={project.id} style={{ border: "1px solid var(--ah-hairline)", borderRadius: 8, padding: 12 }}><strong>{project.name}</strong><p style={{ margin: "4px 0 0", color: "var(--ah-slate)" }}>{project.id === projectId && tests.length ? `${tests.length} Test · ${tests.filter((test) => test.status === "draft").length} Draft` : "เปิด Project เพื่อดู Test"}</p></article>)}</div>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>2. Project</h2>
            {workspaceId ? <form onSubmit={createProject} style={{ display: "grid", gap: 10 }}>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={input}>
                <option value="">เลือก Project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input required value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <button className="primaryButton" disabled={working}>สร้าง Project</button>
              </div>
            </form> : <p>สร้าง Workspace ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>3. Test</h2>
            {projectId ? <form onSubmit={createTest} style={{ display: "grid", gap: 10 }}>
              <select value={testId} onChange={(e) => setTestId(e.target.value)} style={input}>
                <option value="">เลือก Test</option>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.status}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input required value={testTitle} onChange={(e) => setTestTitle(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <button className="primaryButton" disabled={working}>สร้าง Test</button>
              </div>
            </form> : <p>เลือก Project ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>4. First-party Production Target</h2>
            {testId ? <form onSubmit={configureTarget} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input required type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} style={{ ...input, flex: "1 1 420px" }} />
              <button className="primaryButton" disabled={working}>บันทึก Target</button>
              <button className="primaryButton" type="button" disabled={working} onClick={preflightTarget}>ตรวจ Target</button>
            </form> : <p>เลือก Test ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>5. Scenario / Tasks</h2>
            {testId ? <>
              <form onSubmit={createTask} style={{ display: "grid", gap: 8 }}>
                <input required placeholder="ชื่อ Task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={input} />
                <input placeholder="Scenario" value={scenario} onChange={(e) => setScenario(e.target.value)} style={input} />
                <textarea placeholder="คำสั่งสำหรับผู้เข้าร่วม" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} style={{ ...input, padding: 10 }} />
                <button className="primaryButton" disabled={working}>เพิ่ม Task</button>
              </form>
              <ol>{tasks.map((task) => <li key={task.id}>{task.ordinal}. {task.title}</li>)}</ol>
              {tasks.length > 0 ? <p><a className="primaryButton" href={`/builder/${testId}/rules`}>กำหนด Success / Failure Rules</a></p> : null}
              <p style={{ color: "var(--ah-slate)" }}>Flow Gate ใช้ข้อมูลจริงเท่านั้น; Publish จะผ่านเมื่อทุก Task มี deterministic rule ที่ Target capability รองรับและไม่ขัดแย้งกัน</p>
            </> : <p>เลือก Test ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>6. Publish</h2>
            <button className="primaryButton" type="button" disabled={working || !testId || tasks.length === 0} onClick={publish}>Publish immutable version</button>
            {publishedVersionId ? <p>Participant link: <a href={`/t/${publishedVersionId}`} target="_blank" rel="noreferrer">{`/t/${publishedVersionId}`}</a></p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

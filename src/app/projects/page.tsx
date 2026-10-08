"use client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Workspace = { id: string; name: string; slug: string };
type Project = { id: string; workspace_id: string; name: string; description: string | null; status: string };
type StudyTest = { id: string; workspace_id: string; project_id: string; title: string; description: string | null; status: string };
type Task = { id: string; title: string; ordinal: number };
type LoadState = "loading" | "ready" | "error" | "restricted";
class RequestError extends Error {
  constructor(readonly status: number, code: string) { super(code); }
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof body?.error === "string" ? body.error : "request_failed";
    throw new RequestError(response.status, code);
  }
  return body as T;
}
function readFailure(error: unknown, setLoad: (state: LoadState) => void) {
  if (error instanceof RequestError && error.status === 401) { window.location.replace("/login"); return; }
  setLoad(error instanceof RequestError && error.status === 403 ? "restricted" : "error");
}

export default function ProjectsPage() {
  const [bootstrap, setBootstrap] = useState<LoadState>("loading");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [projectLoad, setProjectLoad] = useState<LoadState>("loading");
  const [testLoad, setTestLoad] = useState<LoadState>("loading");
  const [taskLoad, setTaskLoad] = useState<LoadState>("loading");
  const [listAttempt, setListAttempt] = useState(0);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [testId, setTestId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [instruction, setInstruction] = useState("");
  const [publishedVersionId, setPublishedVersionId] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const scope = useRef({ workspaceId: "", projectId: "", testId: "" });
  scope.current = { workspaceId, projectId, testId };

  const chooseTest = useCallback((id: string) => {
    scope.current.testId = id;
    setTasks([]); setTaskLoad("loading"); setPublishedVersionId(""); setTestId(id);
  }, []);
  const chooseProject = useCallback((id: string) => {
    scope.current.projectId = id;
    setTests([]); setTestLoad("loading"); chooseTest(""); setProjectId(id);
  }, [chooseTest]);
  const chooseWorkspace = useCallback((id: string) => {
    scope.current.workspaceId = id;
    setProjects([]); setProjectLoad("loading"); chooseProject(""); setWorkspaceId(id);
  }, [chooseProject]);

  const loadWorkspaces = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/workspaces", { cache: "no-store", signal });
    const body = await json<{ workspaces: Workspace[] }>(response);
    if (signal?.aborted) return;
    setWorkspaces(body.workspaces);
    setWorkspaceId((current) => current || body.workspaces[0]?.id || "");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setBootstrap("loading");
    void (async () => {
      const session = await fetch("/api/auth/session", { cache: "no-store", signal: controller.signal });
      await json(session);
      await loadWorkspaces(controller.signal);
      if (!controller.signal.aborted) setBootstrap("ready");
    })().catch(error => { if (!controller.signal.aborted) readFailure(error, setBootstrap); });
    return () => controller.abort();
  }, [loadWorkspaces, bootstrapAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setProjects([]); setProjectLoad("loading");
    if (!workspaceId) { setProjectId(""); return () => controller.abort(); }
    void fetch(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store", signal: controller.signal })
      .then((r) => json<{ projects: Project[] }>(r))
      .then((body) => {
        if (controller.signal.aborted || scope.current.workspaceId !== workspaceId) return;
        setProjects(body.projects);
        setProjectLoad("ready");
        const next = body.projects.some(p => p.id === scope.current.projectId) ? scope.current.projectId : body.projects[0]?.id || "";
        if (next !== scope.current.projectId) chooseProject(next);
      })
      .catch(error => { if (!controller.signal.aborted) readFailure(error, setProjectLoad); });
    return () => controller.abort();
  }, [workspaceId, listAttempt, chooseProject]);

  useEffect(() => {
    const controller = new AbortController();
    setTests([]); setTestLoad("loading");
    if (!workspaceId || !projectId) { setTestId(""); return () => controller.abort(); }
    void fetch(`/api/tests?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal })
      .then((r) => json<{ tests: StudyTest[] }>(r))
      .then((body) => {
        if (controller.signal.aborted || scope.current.workspaceId !== workspaceId || scope.current.projectId !== projectId) return;
        setTests(body.tests);
        setTestLoad("ready");
        const next = body.tests.some(t => t.id === scope.current.testId) ? scope.current.testId : body.tests[0]?.id || "";
        if (next !== scope.current.testId) chooseTest(next);
      })
      .catch(error => { if (!controller.signal.aborted) readFailure(error, setTestLoad); });
    return () => controller.abort();
  }, [workspaceId, projectId, listAttempt, chooseTest]);

  const loadTasks = useCallback(async (selectedTestId: string, signal?: AbortSignal) => {
    if (!selectedTestId) { setTasks([]); return; }
    const body = await json<{ tasks: Task[] }>(await fetch(`/api/tests/${encodeURIComponent(selectedTestId)}/tasks`, { cache: "no-store", signal }));
    if (signal?.aborted || scope.current.testId !== selectedTestId) return;
    setTasks(body.tasks);
    setTaskLoad("ready");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setTasks([]); setTaskLoad("loading");
    void loadTasks(testId, controller.signal).catch(error => { if (!controller.signal.aborted) readFailure(error, setTaskLoad); });
    return () => controller.abort();
  }, [testId, loadTasks, listAttempt]);

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
    void run("สร้างพื้นที่ทำงาน", async () => {
      await json(await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: workspaceName }) }));
      await loadWorkspaces();
    });
  }

  function createProject(event: FormEvent) {
    event.preventDefault();
    void run("สร้างโปรเจกต์", async () => {
      const body = await json<{ project: Project }>(await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, name: projectName, description: null }) }));
      setProjects((items) => [body.project, ...items]);
      chooseProject(body.project.id);
    });
  }

  function createTest(event: FormEvent) {
    event.preventDefault();
    void run("สร้างแบบทดสอบ", async () => {
      const body = await json<{ test: StudyTest }>(await fetch("/api/tests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, projectId, title: testTitle, description: null }) }));
      setTests((items) => [body.test, ...items]);
      chooseTest(body.test.id);
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
    void run("ตรวจความพร้อมของเว็บไซต์", async () => {
      await json(await fetch(`/api/tests/${encodeURIComponent(testId)}/prototype`, {
        method: "POST",
        cache: "no-store",
      }));
    });
  }

  function createTask(event: FormEvent) {
    event.preventDefault();
    void run("เพิ่มงาน", async () => {
      await json(await fetch(`/api/tests/${encodeURIComponent(testId)}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: taskTitle, scenario, instruction }),
      }));
      setTaskTitle(""); setScenario(""); setInstruction("");
      await loadTasks(testId);
    });
  }

  function publish() {
    void run("เผยแพร่แบบทดสอบ", async () => {
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

  if (bootstrap !== "ready") return <main style={{ padding: 32 }}>
    <h1>พื้นที่ทำงานผู้วิจัย</h1>
    {bootstrap === "loading" ? <p role="status">กำลังโหลดพื้นที่ทำงาน…</p> : <>
      <p role="alert">{bootstrap === "restricted" ? "คุณไม่มีสิทธิ์เปิดพื้นที่ทำงานนี้ ติดต่อผู้ดูแลพื้นที่ทำงาน" : "โหลดพื้นที่ทำงานไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่"}</p>
      <Button variant="legacy" className="primaryButton" onClick={() => setBootstrapAttempt(n => n + 1)}>ลองอีกครั้ง</Button>
    </>}
  </main>;

  const listFeedback = (state: LoadState, label: string) => state === "ready" ? null : state === "loading" ? <p role="status">กำลังโหลด{label}…</p> : <div>
    <p role="alert">{state === "restricted" ? `คุณไม่มีสิทธิ์อ่าน${label}ในบริบทนี้` : `โหลด${label}ไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่`}</p>
    <Button variant="legacy" className="primaryButton" type="button" onClick={() => setListAttempt(n => n + 1)}>ลองโหลด{label}อีกครั้ง</Button>
  </div>;

  const block = { background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: 12, padding: 20 } as const;
  const input = { minHeight: "var(--ah-touch-target-min)", border: "1px solid var(--ah-hairline)", borderRadius: 8, padding: "0 10px", background: "white", width: "100%" } as const;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="เมนูผู้วิจัย">
          <a className="navItem active" href="/projects">โปรเจกต์</a>
          <Button variant="legacy" className="navItem" type="button" onClick={() => void signOut()} style={{ border: 0, textAlign: "left", background: "transparent" }}>ออกจากระบบ</Button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">พื้นที่ทำงานผู้วิจัย</p><h1>เตรียมแบบทดสอบของคุณ</h1><p>เลือกพื้นที่ทำงานและโปรเจกต์ แล้วสร้างแบบทดสอบ กำหนดงาน และตรวจความพร้อมก่อนเผยแพร่</p></div>
        </header>

        {message ? <p role="status" style={{ ...block, marginBottom: 16 }}>{message}</p> : null}

        <div style={{ display: "grid", gap: 16 }}>
          <section style={block}>
            <h2 style={{ marginTop: 0 }}>1. เลือกพื้นที่ทำงาน</h2>
            {workspaces.length ? (
              <select aria-label="พื้นที่ทำงาน" value={workspaceId} onChange={(e) => chooseWorkspace(e.target.value)} disabled={working} style={input}>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : (
              <form onSubmit={createWorkspace} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Input appearance="legacy" aria-label="ชื่อพื้นที่ทำงานใหม่" placeholder="ชื่อพื้นที่ทำงาน" required value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <Button variant="legacy" className="primaryButton" disabled={working}>สร้างพื้นที่ทำงาน</Button>
              </form>
            )}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>2. เลือกโปรเจกต์</h2>
            {workspaceId ? <form onSubmit={createProject} style={{ display: "grid", gap: 10 }}>
              <select aria-label="โปรเจกต์" value={projectId} onChange={(e) => chooseProject(e.target.value)} disabled={working || projectLoad !== "ready"} style={input}>
                <option value="">เลือกโปรเจกต์</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Input appearance="legacy" aria-label="ชื่อโปรเจกต์ใหม่" placeholder="ชื่อโปรเจกต์" required value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <Button variant="legacy" className="primaryButton" disabled={working || projectLoad !== "ready"}>สร้างโปรเจกต์</Button>
              </div>
            </form> : <p>สร้างพื้นที่ทำงานในขั้นที่ 1 ก่อน</p>}
            {workspaceId ? listFeedback(projectLoad, "โปรเจกต์") : null}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>3. เลือกแบบทดสอบ</h2>
            {projectId ? <form onSubmit={createTest} style={{ display: "grid", gap: 10 }}>
              <select aria-label="แบบทดสอบ" value={testId} onChange={(e) => chooseTest(e.target.value)} disabled={working || projectLoad !== "ready" || testLoad !== "ready"} style={input}>
                <option value="">เลือกแบบทดสอบ</option>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.status}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Input appearance="legacy" aria-label="ชื่อแบบทดสอบใหม่" placeholder="ชื่อแบบทดสอบ" required value={testTitle} onChange={(e) => setTestTitle(e.target.value)} style={{ ...input, flex: "1 1 260px" }} />
                <Button variant="legacy" className="primaryButton" disabled={working || projectLoad !== "ready" || testLoad !== "ready"}>สร้างแบบทดสอบ</Button>
              </div>
            </form> : <p>เลือกหรือสร้างโปรเจกต์ในขั้นที่ 2 ก่อน</p>}
            {projectId ? listFeedback(testLoad, "แบบทดสอบ") : null}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>4. ระบุเว็บไซต์ที่จะทดสอบ</h2>
            {testId ? <form onSubmit={configureTarget} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input appearance="legacy" aria-label="URL เว็บไซต์ที่จะทดสอบ" placeholder="https://example.com" required type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} style={{ ...input, flex: "1 1 420px" }} />
              <Button variant="legacy" className="primaryButton" disabled={working || projectLoad !== "ready" || testLoad !== "ready" || taskLoad !== "ready"}>บันทึกเว็บไซต์</Button>
              <Button variant="legacy" className="primaryButton" type="button" disabled={working || projectLoad !== "ready" || testLoad !== "ready" || taskLoad !== "ready"} onClick={preflightTarget}>ตรวจความพร้อมของเว็บไซต์</Button>
            </form> : <p>เลือกหรือสร้างแบบทดสอบในขั้นที่ 3 ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>5. เขียนงานให้ผู้เข้าร่วมทำ</h2>
            {testId ? <>
              <form onSubmit={createTask} style={{ display: "grid", gap: 8 }}>
                <Input appearance="legacy" aria-label="ชื่องาน" required placeholder="ชื่องาน เช่น สมัครสมาชิก" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={input} />
                <Input appearance="legacy" aria-label="สถานการณ์ของงาน" placeholder="สถานการณ์ เช่น คุณเพิ่งเริ่มใช้บริการ" value={scenario} onChange={(e) => setScenario(e.target.value)} style={input} />
                <textarea aria-label="คำสั่งที่ผู้เข้าร่วมจะเห็น" placeholder="คำสั่งที่ผู้เข้าร่วมจะเห็น" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} style={{ ...input, padding: 10 }} />
                <Button variant="legacy" className="primaryButton" disabled={working || projectLoad !== "ready" || testLoad !== "ready" || taskLoad !== "ready"}>เพิ่มงาน</Button>
              </form>
              <ol>{tasks.map((task) => <li key={task.id}>{task.ordinal}. {task.title}</li>)}</ol>
              {listFeedback(taskLoad, "งานทดสอบ")}
              {tasks.length > 0 ? <p><a className="primaryButton" href={`/builder/${testId}/rules`}>กำหนดเกณฑ์จบงาน</a></p> : null}
              <p style={{ color: "var(--ah-slate)" }}>ก่อนเผยแพร่ ให้กำหนดว่าแต่ละงานถือว่าสำเร็จหรือไม่สำเร็จเมื่อใด ระบบจะตรวจความครบถ้วนอีกครั้ง</p>
            </> : <p>เลือกหรือสร้างแบบทดสอบในขั้นที่ 3 ก่อน</p>}
          </section>

          <section style={block}>
            <h2 style={{ marginTop: 0 }}>6. ตรวจและเผยแพร่</h2>
            <Button variant="legacy" className="primaryButton" type="button" disabled={working || projectLoad !== "ready" || testLoad !== "ready" || taskLoad !== "ready" || !testId || tasks.length === 0} onClick={publish}>เผยแพร่เวอร์ชันนี้</Button>
            {!testId || tasks.length === 0 ? <p>เลือกแบบทดสอบและเพิ่มงานอย่างน้อย 1 งานก่อนเผยแพร่</p> : null}
            {publishedVersionId ? <p>ลิงก์สำหรับผู้เข้าร่วม: <a href={`/t/${publishedVersionId}`} target="_blank" rel="noreferrer">{`/t/${publishedVersionId}`}</a></p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./projects.module.css";

type Workspace = { id: string; name: string; slug: string; created_at: string };
type Project = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};
type ResearchTest = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed" | "archived";
  created_at: string;
  updated_at: string;
};

type ApiErrorCode =
  | "authentication_required"
  | "permission_denied"
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "data_request_failed"
  | "data_service_not_configured"
  | "internal_error"
  | string;

class UiApiError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode) {
    super(code);
    this.name = "UiApiError";
    this.status = status;
    this.code = code;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...(init.headers ?? {}) }
      : init?.headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new UiApiError(response.status, typeof body.error === "string" ? body.error : "request_failed");
  }
  return body as T;
}

function messageFor(error: unknown): string {
  if (!(error instanceof UiApiError)) return "Something went wrong. Try again.";
  if (error.code === "permission_denied") return "You do not have permission to make this change.";
  if (error.code === "invalid_input") return "Check the required fields and try again.";
  if (error.code === "conflict") return "This change conflicts with the current data. Refresh and try again.";
  if (error.code === "data_service_not_configured") return "The data service is not configured.";
  return "Unable to complete the request. Try again.";
}

export default function ProjectsPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tests, setTests] = useState<ResearchTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedTest = useMemo(
    () => tests.find((item) => item.id === selectedTestId) ?? null,
    [tests, selectedTestId],
  );

  const handleFailure = useCallback((caught: unknown) => {
    if (caught instanceof UiApiError && caught.status === 401) {
      window.location.assign("/login");
      return;
    }
    setError(messageFor(caught));
  }, []);

  const loadProjects = useCallback(async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId) {
      setProjects([]);
      setSelectedProjectId("");
      setTests([]);
      return;
    }
    const data = await api<{ projects: Project[] }>(
      `/api/projects?workspaceId=${encodeURIComponent(nextWorkspaceId)}`,
    );
    setProjects(data.projects);
    setSelectedProjectId((current) =>
      data.projects.some((project) => project.id === current) ? current : data.projects[0]?.id ?? "",
    );
  }, []);

  const loadTests = useCallback(async (nextWorkspaceId: string, projectId: string) => {
    if (!nextWorkspaceId || !projectId) {
      setTests([]);
      setSelectedTestId("");
      return;
    }
    const data = await api<{ tests: ResearchTest[] }>(
      `/api/tests?workspaceId=${encodeURIComponent(nextWorkspaceId)}&projectId=${encodeURIComponent(projectId)}`,
    );
    setTests(data.tests);
    setSelectedTestId((current) =>
      data.tests.some((item) => item.id === current) ? current : data.tests[0]?.id ?? "",
    );
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const session = await api<{ user: { id: string; email: string | null } }>("/api/auth/session");
        const workspaceData = await api<{ workspaces: Workspace[] }>("/api/workspaces");
        if (!alive) return;
        setUserEmail(session.user.email);
        setWorkspaces(workspaceData.workspaces);
        const firstWorkspace = workspaceData.workspaces[0]?.id ?? "";
        setWorkspaceId(firstWorkspace);
        await loadProjects(firstWorkspace);
      } catch (caught) {
        if (alive) handleFailure(caught);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleFailure, loadProjects]);

  useEffect(() => {
    void loadTests(workspaceId, selectedProjectId).catch(handleFailure);
  }, [workspaceId, selectedProjectId, loadTests, handleFailure]);

  async function runMutation(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await runMutation(async () => {
      await api<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          name: String(data.get("name") ?? ""),
          description: String(data.get("description") ?? "") || null,
        }),
      });
      form.reset();
      await loadProjects(workspaceId);
    }, "Project created.");
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    const data = new FormData(event.currentTarget);
    await runMutation(async () => {
      await api<{ project: Project }>(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          description: String(data.get("description") ?? "") || null,
        }),
      });
      await loadProjects(workspaceId);
    }, "Project updated.");
  }

  async function archiveProject() {
    if (!selectedProject) return;
    await runMutation(async () => {
      await api<{ project: Project }>(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
      });
      await loadProjects(workspaceId);
    }, "Project archived.");
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await runMutation(async () => {
      await api<{ test: ResearchTest }>("/api/tests", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          projectId: selectedProject.id,
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? "") || null,
        }),
      });
      form.reset();
      await loadTests(workspaceId, selectedProject.id);
    }, "Test created.");
  }

  async function updateTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTest) return;
    const data = new FormData(event.currentTarget);
    await runMutation(async () => {
      await api<{ test: ResearchTest }>(`/api/tests/${selectedTest.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? "") || null,
        }),
      });
      await loadTests(workspaceId, selectedTest.project_id);
    }, "Test updated.");
  }

  async function archiveTest() {
    if (!selectedTest) return;
    await runMutation(async () => {
      await api<{ test: ResearchTest }>(`/api/tests/${selectedTest.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
      });
      await loadTests(workspaceId, selectedTest.project_id);
    }, "Test archived.");
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  if (loading) {
    return <main className={styles.loading} aria-busy="true">Loading workspace…</main>;
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Projects / Tests</p>
          <h1>Research workspace</h1>
          <p className={styles.muted}>{userEmail ?? "Authenticated researcher"}</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.workspaceSelect}>
            <span>Workspace</span>
            <select
              value={workspaceId}
              onChange={(event) => {
                const next = event.target.value;
                setWorkspaceId(next);
                setSelectedProjectId("");
                setSelectedTestId("");
                setError(null);
                void loadProjects(next).catch(handleFailure);
              }}
              disabled={busy || workspaces.length === 0}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.secondaryButton} onClick={signOut} disabled={busy}>
            Sign out
          </button>
        </div>
      </header>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {workspaces.length === 0 ? (
        <section className={styles.empty}>
          <h2>No workspace available</h2>
          <p>Your authenticated account is not a member of a workspace yet.</p>
        </section>
      ) : (
        <div className={styles.grid}>
          <aside className={styles.sidebar} aria-label="Projects">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>S04</p>
                <h2>Projects</h2>
              </div>
              <span className={styles.count}>{projects.length}</span>
            </div>

            <div className={styles.list}>
              {projects.length === 0 ? (
                <div className={styles.emptyCompact}>No projects yet.</div>
              ) : projects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={`${styles.listItem} ${project.id === selectedProjectId ? styles.selected : ""}`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <span>{project.name}</span>
                  <small>{project.status}</small>
                </button>
              ))}
            </div>

            <form className={styles.formCard} onSubmit={createProject}>
              <p className={styles.eyebrow}>S05 · Create project</p>
              <label>
                <span>Name</span>
                <input name="name" required disabled={busy} />
              </label>
              <label>
                <span>Description</span>
                <textarea name="description" rows={3} disabled={busy} />
              </label>
              <button type="submit" disabled={busy || !workspaceId}>Create project</button>
            </form>
          </aside>

          <section className={styles.content}>
            {!selectedProject ? (
              <div className={styles.empty}>
                <p className={styles.eyebrow}>S06</p>
                <h2>Select a project</h2>
                <p>Create a project or select one to manage its tests.</p>
              </div>
            ) : (
              <>
                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.eyebrow}>S06 · Project overview</p>
                      <h2>{selectedProject.name}</h2>
                    </div>
                    <span className={styles.status}>{selectedProject.status}</span>
                  </div>
                  <form key={selectedProject.id} className={styles.inlineForm} onSubmit={updateProject}>
                    <label>
                      <span>Project name</span>
                      <input name="name" defaultValue={selectedProject.name} required disabled={busy} />
                    </label>
                    <label>
                      <span>Description</span>
                      <textarea
                        name="description"
                        defaultValue={selectedProject.description ?? ""}
                        rows={3}
                        disabled={busy}
                      />
                    </label>
                    <div className={styles.actions}>
                      <button type="submit" disabled={busy}>Save changes</button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={busy || selectedProject.status === "archived"}
                        onClick={archiveProject}
                      >
                        Archive project
                      </button>
                    </div>
                  </form>
                </section>

                <section className={styles.panel}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.eyebrow}>S07–S08</p>
                      <h2>Tests</h2>
                    </div>
                    <span className={styles.count}>{tests.length}</span>
                  </div>

                  <div className={styles.testLayout}>
                    <div className={styles.list}>
                      {tests.length === 0 ? (
                        <div className={styles.emptyCompact}>No tests in this project.</div>
                      ) : tests.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`${styles.listItem} ${item.id === selectedTestId ? styles.selected : ""}`}
                          onClick={() => setSelectedTestId(item.id)}
                        >
                          <span>{item.title}</span>
                          <small>{item.status}</small>
                        </button>
                      ))}
                    </div>

                    <form className={styles.formCard} onSubmit={createTest}>
                      <p className={styles.eyebrow}>Create test</p>
                      <label>
                        <span>Title</span>
                        <input name="title" required disabled={busy} />
                      </label>
                      <label>
                        <span>Description</span>
                        <textarea name="description" rows={3} disabled={busy} />
                      </label>
                      <button type="submit" disabled={busy}>Create test</button>
                    </form>
                  </div>

                  {selectedTest ? (
                    <form key={selectedTest.id} className={styles.inlineForm} onSubmit={updateTest}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <p className={styles.eyebrow}>Test details</p>
                          <h3>{selectedTest.title}</h3>
                        </div>
                        <span className={styles.status}>{selectedTest.status}</span>
                      </div>
                      <label>
                        <span>Test title</span>
                        <input name="title" defaultValue={selectedTest.title} required disabled={busy} />
                      </label>
                      <label>
                        <span>Description</span>
                        <textarea
                          name="description"
                          defaultValue={selectedTest.description ?? ""}
                          rows={3}
                          disabled={busy}
                        />
                      </label>
                      <div className={styles.actions}>
                        <button type="submit" disabled={busy}>Save test</button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={busy || selectedTest.status === "archived"}
                          onClick={archiveTest}
                        >
                          Archive test
                        </button>
                      </div>
                    </form>
                  ) : null}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./task-scenario-builder.module.css";

type TaskItem = {
  id: string;
  workspaceId: string;
  testVersionId: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
};

type NewTask = { title: string; scenario: string; instruction: string };

type RequestState = "loading" | "ready" | "saving" | "error";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...(init.headers ?? {}) }
      : init?.headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  }
  return body as T;
}

function normalizeOrder(tasks: TaskItem[]): TaskItem[] {
  return tasks.map((task, index) => ({ ...task, ordinal: index + 1 }));
}

export default function TaskScenarioBuilderClient({ testId }: { testId: string }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [baseline, setBaseline] = useState<Record<string, TaskItem>>({});
  const [state, setState] = useState<RequestState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<NewTask>({ title: "", scenario: "", instruction: "" });

  useEffect(() => {
    let active = true;
    void jsonRequest<{ tasks: TaskItem[] }>(`/api/tests/${encodeURIComponent(testId)}/tasks`)
      .then(({ tasks: loaded }) => {
        if (!active) return;
        setTasks(loaded);
        setBaseline(Object.fromEntries(loaded.map((task) => [task.id, task])));
        setState("ready");
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage("Unable to load task configuration.");
      });
    return () => {
      active = false;
    };
  }, [testId]);

  const dirtyIds = useMemo(
    () => new Set(tasks.filter((task) => {
      const saved = baseline[task.id];
      return !saved || task.title !== saved.title || task.scenario !== saved.scenario || task.instruction !== saved.instruction;
    }).map((task) => task.id)),
    [tasks, baseline],
  );

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage(null);
    try {
      const { task } = await jsonRequest<{ task: TaskItem }>(`/api/tests/${encodeURIComponent(testId)}/tasks`, {
        method: "POST",
        body: JSON.stringify(newTask),
      });
      setTasks((current) => [...current, task]);
      setBaseline((current) => ({ ...current, [task.id]: task }));
      setNewTask({ title: "", scenario: "", instruction: "" });
      setState("ready");
      setMessage(`Task ${task.ordinal} created.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to create task.");
    }
  }

  function editTask(taskId: string, field: "title" | "scenario" | "instruction", value: string) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, [field]: value } : task));
    if (state === "error") setState("ready");
  }

  async function saveTask(task: TaskItem) {
    setState("saving");
    setMessage(null);
    try {
      const { task: saved } = await jsonRequest<{ task: TaskItem }>(`/api/tests/${encodeURIComponent(testId)}/tasks`, {
        method: "PUT",
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          scenario: task.scenario,
          instruction: task.instruction,
        }),
      });
      setTasks((current) => current.map((item) => item.id === saved.id ? saved : item));
      setBaseline((current) => ({ ...current, [saved.id]: saved }));
      setState("ready");
      setMessage(`Task ${saved.ordinal} saved.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to save task.");
    }
  }

  async function moveTask(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;
    const local = [...tasks];
    [local[index], local[target]] = [local[target], local[index]];
    const nextLocal = normalizeOrder(local);
    setState("saving");
    setMessage(null);
    try {
      const { tasks: persisted } = await jsonRequest<{ tasks: TaskItem[] }>(`/api/tests/${encodeURIComponent(testId)}/tasks`, {
        method: "PUT",
        body: JSON.stringify({ taskIds: nextLocal.map((task) => task.id) }),
      });
      const localById = new Map(nextLocal.map((task) => [task.id, task]));
      setTasks(persisted.map((saved) => ({ ...saved, ...localById.get(saved.id), ordinal: saved.ordinal })));
      setBaseline((current) => Object.fromEntries(persisted.map((saved) => [saved.id, {
        ...saved,
        title: current[saved.id]?.title ?? saved.title,
        scenario: current[saved.id]?.scenario ?? saved.scenario,
        instruction: current[saved.id]?.instruction ?? saved.instruction,
      }])));
      setState("ready");
      setMessage("Task order saved. Unsaved field edits were preserved locally.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to reorder tasks.");
    }
  }

  const busy = state === "loading" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href={`/builder/${encodeURIComponent(testId)}/prototype`} className={styles.backLink}>← Prototype</a>
        <p className={styles.eyebrow}>S13 · Task editor</p>
        <h1>Build tasks and scenarios</h1>
        <p>Create participant-facing task context, keep instructions concise, and reorder tasks without exposing success rules.</p>
      </header>

      {message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}

      <section className={styles.card} aria-labelledby="new-task-title">
        <h2 id="new-task-title">Add task</h2>
        <form className={styles.form} onSubmit={createTask}>
          <label><span>Task title</span><input value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} required disabled={busy} /></label>
          <label><span>Scenario</span><textarea rows={3} value={newTask.scenario} onChange={(event) => setNewTask({ ...newTask, scenario: event.target.value })} disabled={busy} /></label>
          <label><span>Participant instruction</span><textarea rows={3} value={newTask.instruction} onChange={(event) => setNewTask({ ...newTask, instruction: event.target.value })} disabled={busy} /></label>
          <button type="submit" disabled={busy || newTask.title.trim() === ""}>{state === "saving" ? "Saving…" : "Add task"}</button>
        </form>
      </section>

      <section className={styles.taskSection} aria-labelledby="task-list-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="task-list-title">Task order</h2><p>{tasks.length} task{tasks.length === 1 ? "" : "s"} in this draft</p></div>
          {dirtyIds.size > 0 ? <span className={styles.unsaved}>{dirtyIds.size} unsaved</span> : null}
        </div>

        {state === "loading" ? <div className={styles.empty} role="status">Loading tasks…</div> : null}
        {state !== "loading" && tasks.length === 0 ? <div className={styles.empty}>No tasks yet. Add the first participant task above.</div> : null}

        <ol className={styles.taskList}>
          {tasks.map((task, index) => (
            <li key={task.id} className={styles.taskCard}>
              <div className={styles.taskTopbar}>
                <strong>Task {index + 1}</strong>
                <div className={styles.reorder} aria-label={`Reorder task ${index + 1}`}>
                  <button type="button" onClick={() => void moveTask(index, -1)} disabled={busy || index === 0} aria-label={`Move task ${index + 1} up`}>↑</button>
                  <button type="button" onClick={() => void moveTask(index, 1)} disabled={busy || index === tasks.length - 1} aria-label={`Move task ${index + 1} down`}>↓</button>
                </div>
              </div>
              <div className={styles.form}>
                <label><span>Task title</span><input value={task.title} onChange={(event) => editTask(task.id, "title", event.target.value)} disabled={busy} /></label>
                <label><span>Scenario</span><textarea rows={3} value={task.scenario ?? ""} onChange={(event) => editTask(task.id, "scenario", event.target.value)} disabled={busy} /></label>
                <label><span>Participant instruction</span><textarea rows={3} value={task.instruction ?? ""} onChange={(event) => editTask(task.id, "instruction", event.target.value)} disabled={busy} /></label>
                <button className={styles.secondaryButton} type="button" onClick={() => void saveTask(task)} disabled={busy || !dirtyIds.has(task.id) || task.title.trim() === ""}>Save task</button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

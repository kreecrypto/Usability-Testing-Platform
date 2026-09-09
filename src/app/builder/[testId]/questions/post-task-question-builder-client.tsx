"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./post-task-question-builder.module.css";

type Toggle = { enabled: boolean; required: boolean };
type QuestionConfig = { seq: Toggle; openFeedback: Toggle };
type QuestionTask = { id: string; ordinal: number; title: string; config: QuestionConfig };
type State = "loading" | "ready" | "saving" | "error";

type Kind = "seq" | "openFeedback";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

export default function PostTaskQuestionBuilderClient({ testId }: { testId: string }) {
  const [tasks, setTasks] = useState<QuestionTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [draft, setDraft] = useState<QuestionConfig | null>(null);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api<{ tasks: QuestionTask[] }>(`/api/tests/${encodeURIComponent(testId)}/questions`)
      .then(({ tasks: loaded }) => {
        if (!active) return;
        setTasks(loaded);
        if (loaded[0]) {
          setSelectedTaskId(loaded[0].id);
          setDraft(loaded[0].config);
        }
        setState("ready");
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage("Unable to load post-task questions.");
      });
    return () => { active = false; };
  }, [testId]);

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);
  const validation = useMemo(() => {
    if (!draft) return null;
    if (draft.seq.required && !draft.seq.enabled) return "SEQ cannot be required when disabled.";
    if (draft.openFeedback.required && !draft.openFeedback.enabled) return "Open Feedback cannot be required when disabled.";
    return null;
  }, [draft]);

  function selectTask(task: QuestionTask) {
    setSelectedTaskId(task.id);
    setDraft(task.config);
    setMessage(null);
    setState("ready");
  }

  function setEnabled(kind: Kind, enabled: boolean) {
    setDraft((current) => current ? {
      ...current,
      [kind]: { enabled, required: enabled ? current[kind].required : false },
    } : current);
  }

  function setRequired(kind: Kind, required: boolean) {
    setDraft((current) => current ? {
      ...current,
      [kind]: { ...current[kind], required },
    } : current);
  }

  async function save() {
    if (!selectedTask || !draft || validation) return;
    setState("saving");
    setMessage(null);
    try {
      const { task } = await api<{ task: QuestionTask }>(`/api/tests/${encodeURIComponent(testId)}/questions`, {
        method: "PUT",
        body: JSON.stringify({ taskId: selectedTask.id, config: draft }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      setDraft(task.config);
      setState("ready");
      setMessage(`Questions saved for Task ${task.ordinal}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to save questions.");
    }
  }

  const busy = state === "loading" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href={`/builder/${encodeURIComponent(testId)}/criteria`} className={styles.backLink}>← Success criteria</a>
        <p className={styles.eyebrow}>S15 · Question editor</p>
        <h1>Configure post-task questions</h1>
        <p>Choose whether each task asks SEQ and Open Feedback, and whether each enabled response is required.</p>
      </header>

      {message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}
      {state === "loading" ? <div className={styles.empty} role="status">Loading question configuration…</div> : null}
      {state !== "loading" && tasks.length === 0 ? <div className={styles.empty}>No tasks are available. Create a task before configuring post-task questions.</div> : null}

      {selectedTask && draft ? (
        <div className={styles.layout}>
          <aside className={styles.taskRail} aria-label="Tasks">
            <h2>Tasks</h2>
            {tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                className={task.id === selectedTaskId ? styles.activeTask : styles.taskButton}
                onClick={() => selectTask(task)}
                disabled={busy}
              >
                <span>Task {task.ordinal}</span>
                <strong>{task.title}</strong>
              </button>
            ))}
          </aside>

          <section className={styles.card} aria-labelledby="question-editor-title">
            <div className={styles.cardHeader}>
              <div><p className={styles.eyebrow}>Task {selectedTask.ordinal}</p><h2 id="question-editor-title">{selectedTask.title}</h2></div>
            </div>

            <fieldset className={styles.questionCard} disabled={busy}>
              <legend>SEQ</legend>
              <p>Post-task SEQ response.</p>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={draft.seq.enabled} onChange={(event) => setEnabled("seq", event.target.checked)} />
                <span>Ask SEQ after this task</span>
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={draft.seq.required} onChange={(event) => setRequired("seq", event.target.checked)} disabled={busy || !draft.seq.enabled} />
                <span>Required response</span>
              </label>
            </fieldset>

            <fieldset className={styles.questionCard} disabled={busy}>
              <legend>Open Feedback</legend>
              <p>Post-task text feedback.</p>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={draft.openFeedback.enabled} onChange={(event) => setEnabled("openFeedback", event.target.checked)} />
                <span>Ask Open Feedback after this task</span>
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={draft.openFeedback.required} onChange={(event) => setRequired("openFeedback", event.target.checked)} disabled={busy || !draft.openFeedback.enabled} />
                <span>Required response</span>
              </label>
            </fieldset>

            {validation ? <div className={styles.validation} role="alert">{validation}</div> : <div className={styles.valid} role="status">Question configuration is valid.</div>}
            <button type="button" onClick={() => void save()} disabled={busy || Boolean(validation)}>{state === "saving" ? "Saving…" : "Save questions"}</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

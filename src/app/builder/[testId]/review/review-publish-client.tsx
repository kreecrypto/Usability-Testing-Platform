"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./review-publish.module.css";

type Task = {
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  timeoutSeconds: number | null;
  successRule: Record<string, unknown>;
  failureRule: Record<string, unknown>;
  postTaskQuestions: Record<string, unknown>;
};

type FunnelConfig = { version: "screen-funnel-v1"; screenIds: string[] };

type Preview = {
  testId: string;
  testVersionId: string;
  versionNo: number;
  lifecycleStatus: "draft" | "published";
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  startNodeId: string;
  funnelConfig: FunnelConfig | null;
  tasks: Task[];
};

type State = "loading" | "ready" | "working" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

function enabledQuestionLabels(config: Record<string, unknown>): string[] {
  const labels: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (Reflect.get(value, "enabled") === true) labels.push(key === "open_feedback" ? "Open feedback" : "SEQ");
  }
  return labels;
}

function ruleCount(rule: Record<string, unknown>): number {
  const targets = Reflect.get(rule, "targetNodeIds");
  return Array.isArray(targets) ? targets.length : Object.keys(rule).length > 0 ? 1 : 0;
}

function parseFunnelText(value: string): string[] {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export default function ReviewPublishClient({ testId }: { testId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [funnelText, setFunnelText] = useState("");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  const applyPreview = useCallback((value: Preview) => {
    setPreview(value);
    setFunnelText(value.funnelConfig?.screenIds.join("\n") ?? "");
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`);
      applyPreview(result.preview);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load preview");
      setState("error");
    }
  }, [applyPreview, testId]);

  useEffect(() => { void load(); }, [load]);

  async function act(action: "publish" | "create_draft") {
    if (state === "working") return;
    setState("working");
    setError("");
    try {
      const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      applyPreview(result.preview);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
      setState("error");
    }
  }

  async function saveFunnel() {
    if (state === "working" || preview?.lifecycleStatus !== "draft") return;
    const screenIds = parseFunnelText(funnelText);
    if (screenIds.length < 2) {
      setError("Funnel requires at least two canonical screen IDs.");
      return;
    }
    setState("working");
    setError("");
    try {
      const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`, {
        method: "POST",
        body: JSON.stringify({ action: "save_funnel", screenIds }),
      });
      applyPreview(result.preview);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save funnel");
      setState("error");
    }
  }

  if (state === "loading" && !preview) return <main className={styles.shell}><p>Loading deterministic preview…</p></main>;
  if (!preview) {
    return <main className={styles.shell}><h1>Review & publish</h1><p role="alert">{error || "Preview unavailable"}</p><button onClick={() => void load()}>Retry</button></main>;
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Test Builder · Review</p>
          <h1>Version {preview.versionNo}</h1>
          <p className={styles.status} data-status={preview.lifecycleStatus}>{preview.lifecycleStatus}</p>
        </div>
        {preview.lifecycleStatus === "draft" ? (
          <button className={styles.primary} disabled={state === "working"} onClick={() => void act("publish")}>Publish immutable version</button>
        ) : (
          <button className={styles.primary} disabled={state === "working"} onClick={() => void act("create_draft")}>Create editable draft</button>
        )}
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.card} aria-labelledby="prototype-heading">
        <h2 id="prototype-heading">Prototype snapshot</h2>
        <dl className={styles.definition}>
          <div><dt>Exact public prototype</dt><dd><a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.sourceUrl}</a></dd></div>
          <div><dt>Start node</dt><dd><code>{preview.startNodeId}</code></dd></div>
          <div><dt>Internal version ID</dt><dd><code>{preview.testVersionId}</code></dd></div>
        </dl>
        <p className={styles.note}>Publishing freezes this internal snapshot and its task rows. Figma REST version metadata is not required in simplified V1.</p>
      </section>

      <section className={styles.card} aria-labelledby="funnel-heading">
        <h2 id="funnel-heading">Results funnel</h2>
        <p className={styles.note}>Define the ordered canonical screen IDs used for step conversion and drop-off. This configuration is frozen with the published test version; it is not inferred from participant paths.</p>
        {preview.lifecycleStatus === "draft" ? (
          <div className={styles.funnelEditor}>
            <label htmlFor="funnel-screen-ids">Canonical screen IDs · one per line or comma-separated</label>
            <textarea id="funnel-screen-ids" rows={5} value={funnelText} onChange={(event) => setFunnelText(event.target.value)} disabled={state === "working"} placeholder={"screen-A\nscreen-B\nscreen-C"} />
            <button className={styles.secondary} type="button" disabled={state === "working"} onClick={() => void saveFunnel()}>Save funnel definition</button>
          </div>
        ) : preview.funnelConfig ? (
          <ol className={styles.funnelSteps}>{preview.funnelConfig.screenIds.map((screenId) => <li key={screenId}><code>{screenId}</code></li>)}</ol>
        ) : (
          <p>No funnel definition is stored for this published version. Funnel Results will show No Data.</p>
        )}
      </section>

      <section aria-labelledby="task-heading">
        <div className={styles.sectionTitle}><h2 id="task-heading">Tasks</h2><span>{preview.tasks.length}</span></div>
        <div className={styles.tasks}>
          {preview.tasks.map((task) => {
            const questions = enabledQuestionLabels(task.postTaskQuestions);
            return (
              <article className={styles.task} key={task.id}>
                <div className={styles.ordinal}>{task.ordinal}</div>
                <div>
                  <h3>{task.title}</h3>
                  {task.scenario ? <p>{task.scenario}</p> : null}
                  {task.instruction ? <p className={styles.instruction}>{task.instruction}</p> : null}
                  <ul className={styles.meta}>
                    <li>Success rules: {ruleCount(task.successRule)}</li>
                    <li>Failure rules: {ruleCount(task.failureRule)}</li>
                    <li>Timeout: {task.timeoutSeconds ? `${task.timeoutSeconds}s` : "Not set"}</li>
                    <li>Post-task: {questions.length ? questions.join(", ") : "None"}</li>
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

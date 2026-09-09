"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultsModel, TaskDetailResult } from "../../../lib/analytics/results.ts";
import type { FindingRecord } from "../../../lib/findings/model.ts";
import styles from "./findings.module.css";

type LoadState = "loading" | "ready" | "error";
type MetricKey = "completionRate" | "misclickRate" | "giveUpRate" | "medianSuccessfulDurationMs";

function metricValue(task: TaskDetailResult, key: MetricKey): number | null {
  if (key === "completionRate") return task.completionRate;
  if (key === "misclickRate") return task.misclickRate;
  if (key === "giveUpRate") return task.giveUpRate;
  return task.successfulDuration.medianMs;
}

function snapshot(task: TaskDetailResult, key: MetricKey, testVersionId: string) {
  const trace = key === "misclickRate" ? task.trace.misclick : key === "medianSuccessfulDurationMs" ? task.trace.timeOnTask : task.trace.completion;
  return {
    metricKey: key,
    value: metricValue(task, key),
    sampleSize: key === "medianSuccessfulDurationMs" ? task.successfulDuration.sampleSize : task.eligible,
    technicalBlockedCount: task.technicalBlockedCount,
    testVersionId,
    aggregationVersion: trace.aggregationVersion,
    ruleVersions: trace.ruleVersions,
    sourceEventIds: trace.eventIds,
  };
}

function formatMetric(value: number | null): string {
  return value === null ? "No Data" : String(Math.round(value * 10) / 10);
}

export default function FindingsPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  const [testVersionId, setVersionId] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultsModel | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [taskId, setTaskId] = useState("");
  const [metricKey, setMetricKey] = useState<MetricKey>("completionRate");
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [screenId, setScreenId] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [evidenceSession, setEvidenceSession] = useState<Record<string, string>>({});

  useEffect(() => { void params.then((value) => setVersionId(value.testVersionId)); }, [params]);

  async function reload(versionId = testVersionId) {
    if (!versionId) return;
    setState("loading"); setError("");
    try {
      const [resultsResponse, findingsResponse] = await Promise.all([
        fetch(`/api/results/${encodeURIComponent(versionId)}`, { cache: "no-store" }),
        fetch(`/api/findings?testVersionId=${encodeURIComponent(versionId)}`, { cache: "no-store" }),
      ]);
      if (!resultsResponse.ok || !findingsResponse.ok) throw new Error(resultsResponse.status === 401 || findingsResponse.status === 401 ? "Sign in is required." : "Findings data could not be loaded.");
      const resultsPayload = await resultsResponse.json() as { results: ResultsModel };
      const findingsPayload = await findingsResponse.json() as { findings: FindingRecord[] };
      setResults(resultsPayload.results); setFindings(findingsPayload.findings);
      setTaskId((current) => current || resultsPayload.results.taskDetails[0]?.taskId || "");
      setState("ready");
    } catch (value) { setState("error"); setError(value instanceof Error ? value.message : "Findings data could not be loaded."); }
  }

  useEffect(() => { if (testVersionId) void reload(testVersionId); }, [testVersionId]);

  const selectedTask = useMemo(() => results?.taskDetails.find((task) => task.taskId === taskId) ?? null, [results, taskId]);

  async function createFinding(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTask || !title.trim() || !problem.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/findings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ testVersionId, taskId: selectedTask.taskId, screenId: screenId || null, title, problem, severity, metricSnapshot: snapshot(selectedTask, metricKey, testVersionId) }),
      });
      if (!response.ok) throw new Error("Finding could not be created.");
      setTitle(""); setProblem(""); setScreenId("");
      await reload();
    } catch (value) { setError(value instanceof Error ? value.message : "Finding could not be created."); }
    finally { setSaving(false); }
  }

  async function linkEvidence(finding: FindingRecord, type: "session" | "path") {
    const sessionId = evidenceSession[finding.id]?.trim();
    if (!sessionId || !results) return;
    const body: Record<string, unknown> = { type, sessionId };
    if (type === "path") {
      const path = results.paths.find((item) => item.sessionId === sessionId && (!finding.taskId || item.taskId === finding.taskId));
      if (!path) { setError("No canonical path evidence exists for this session/task."); return; }
      body.payload = { taskId: path.taskId, expectedPath: path.expectedPath, actualPath: path.actualPath, detourCount: path.detourCount, backtrackCount: path.backtrackCount, terminalOutcome: path.terminalOutcome };
    }
    const response = await fetch(`/api/findings/${finding.id}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setError("Evidence could not be linked."); return; }
    setError("");
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span>Findings · exact published version</span><h1>UX Findings</h1><p>Turn observed behavior into a version-traceable issue. Metric snapshots and evidence stay tied to the published version that produced them.</p></div><a href={`/results/${testVersionId}`}>Results</a></header>
    {state === "loading" ? <div className={styles.state}>Loading findings…</div> : null}
    {state === "error" ? <div className={styles.error} role="alert">{error}</div> : null}
    {state === "ready" && results ? <div className={styles.layout}>
      <form className={styles.form} onSubmit={createFinding}>
        <div><span className={styles.eyebrow}>Create actionable issue</span><h2>New finding</h2></div>
        <label>Task<select value={taskId} onChange={(event) => setTaskId(event.target.value)}>{results.taskDetails.map((task) => <option key={task.taskId} value={task.taskId}>{task.ordinal}. {task.title}</option>)}</select></label>
        <label>Primary metric<select value={metricKey} onChange={(event) => setMetricKey(event.target.value as MetricKey)}><option value="completionRate">Completion rate</option><option value="misclickRate">Misclick rate</option><option value="giveUpRate">Give-up rate</option><option value="medianSuccessfulDurationMs">Median successful duration</option></select></label>
        {selectedTask ? <div className={styles.snapshot}><strong>{formatMetric(metricValue(selectedTask, metricKey))}</strong><span>n={metricKey === "medianSuccessfulDurationMs" ? selectedTask.successfulDuration.sampleSize : selectedTask.eligible} · blocked={selectedTask.technicalBlockedCount}</span></div> : null}
        <label>Issue title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short observable issue" /></label>
        <label>Problem<textarea required value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="What participants struggled with and why it matters" /></label>
        <div className={styles.twoCol}><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Screen ID<input value={screenId} onChange={(event) => setScreenId(event.target.value)} placeholder="Optional canonical screen ID" /></label></div>
        <button disabled={saving || !selectedTask}>{saving ? "Creating…" : "Create finding"}</button>
      </form>
      <section className={styles.list}>
        <div className={styles.listHeader}><div><span className={styles.eyebrow}>S28 / S29</span><h2>Findings</h2></div><strong>{findings.length}</strong></div>
        {findings.length === 0 ? <div className={styles.empty}><strong>No findings yet</strong><p>Create one from a task metric snapshot. Empty is not treated as a zero-severity result.</p></div> : findings.map((finding) => <article key={finding.id} className={styles.card}>
          <div className={styles.cardHeader}><div><span className={styles.severity} data-severity={finding.severity}>{finding.severity}</span><h3>{finding.title}</h3></div><span className={styles.status}>{finding.status}</span></div>
          <p>{finding.problem}</p>
          <dl><div><dt>Metric</dt><dd>{finding.metricSnapshot.metricKey}: {formatMetric(finding.metricSnapshot.value)}</dd></div><div><dt>Sample</dt><dd>n={finding.metricSnapshot.sampleSize}, technical blocked={finding.metricSnapshot.technicalBlockedCount}</dd></div><div><dt>Version</dt><dd>{finding.testVersionId}</dd></div>{finding.screenId ? <div><dt>Screen</dt><dd>{finding.screenId}</dd></div> : null}</dl>
          <div className={styles.evidenceBox}><strong>Link evidence</strong><input value={evidenceSession[finding.id] ?? ""} onChange={(event) => setEvidenceSession((value) => ({ ...value, [finding.id]: event.target.value }))} placeholder="Session UUID" /><div><button type="button" onClick={() => void linkEvidence(finding, "session")}>Link session</button><button type="button" onClick={() => void linkEvidence(finding, "path")}>Link path</button><button type="button" disabled title="Task 47 heatmap remains capability-gated">Heatmap unavailable</button></div></div>
        </article>)}
      </section>
    </div> : null}
    {error && state === "ready" ? <div className={styles.inlineError} role="alert">{error}</div> : null}
  </main>;
}

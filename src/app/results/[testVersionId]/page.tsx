"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultsModel } from "../../../lib/analytics/results.ts";
import styles from "./results.module.css";

type View = "overview" | "tasks" | "paths" | "funnel" | "sessions";
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; results: ResultsModel };

function metric(value: number | null, suffix = ""): string {
  if (value === null) return "No Data";
  return `${Math.round(value * 10) / 10}${suffix}`;
}

function duration(value: number | null): string {
  if (value === null) return "No Data";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${Math.round(value / 100) / 10} s`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={styles.metricCard}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyState}><strong>No Data</strong><p>{children}</p></div>;
}

function Overview({ results }: { results: ResultsModel }) {
  const value = results.overview;
  return <div className={styles.stack}>
    <section className={styles.metricsGrid} aria-label="Overview metrics">
      <MetricCard label="Participants" value={String(value.participantCount)} detail={`${value.sessionCount} sessions`} />
      <MetricCard label="Completion" value={metric(value.completionRate, "%")} detail={`${value.eligibleTaskCount} eligible tasks`} />
      <MetricCard label="Median successful time" value={duration(value.medianSuccessfulDurationMs)} detail={`n=${value.successfulDurationSampleSize} successes`} />
      <MetricCard label="Misclick rate" value={metric(value.misclickRate, "%")} detail={`${value.misclickCount} derived misclicks`} />
      <MetricCard label="Give-up rate" value={metric(value.giveUpRate, "%")} detail={`${value.giveUpCount} give-ups`} />
      <MetricCard label="Technical blocked" value={String(value.technicalBlockedTaskCount)} detail="Excluded from usability denominator" />
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Key friction</span><h2>Observed derived friction</h2></div></div>
      <div className={styles.frictionGrid}>
        <div><strong>{value.misclickCount}</strong><span>Misclicks</span></div>
        <div><strong>{value.rageClickCount}</strong><span>Rage clicks</span></div>
        <div><strong>{value.backtrackCount}</strong><span>Backtracks</span></div>
        <div><strong>{value.giveUpCount}</strong><span>Give ups</span></div>
      </div>
    </section>
    <section className={styles.warningPanel} role="status">
      <strong>Heatmap capability gate</strong>
      <p>Heatmap remains unavailable until canonical pinned-coordinate evidence is release-proven. Funnel analysis is available only when a versioned funnel definition is stored with the published test version.</p>
    </section>
  </div>;
}

function Tasks({ results }: { results: ResultsModel }) {
  if (results.taskDetails.length === 0) return <EmptyState>No eligible task evidence exists for this published version.</EmptyState>;
  return <div className={styles.taskList}>{results.taskDetails.map((task) => <article key={task.taskId} className={styles.panel}>
    <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Task {task.ordinal}</span><h2>{task.title}</h2></div><span className={styles.badge}>n={task.eligible}</span></div>
    <div className={styles.metricsGrid}>
      <MetricCard label="Completion" value={metric(task.completionRate, "%")} detail={`${task.outcomes.success_direct + task.outcomes.success_indirect} successful`} />
      <MetricCard label="Median" value={duration(task.successfulDuration.medianMs)} detail={`n=${task.successfulDuration.sampleSize} successes`} />
      <MetricCard label="P75" value={duration(task.successfulDuration.p75Ms)} detail="Successful eligible sessions" />
      <MetricCard label="P90" value={duration(task.successfulDuration.p90Ms)} detail="Successful eligible sessions" />
      <MetricCard label="Misclick" value={metric(task.misclickRate, "%")} detail={`${task.misclickCount} derived events`} />
      <MetricCard label="Technical blocked" value={String(task.technicalBlockedCount)} detail="Reported separately" />
    </div>
    <div className={styles.seqBlock}>
      <strong>SEQ raw responses · n={task.seqSampleSize}</strong>
      {task.seqResponses.length === 0 ? <span>No Data</span> : <div className={styles.chips}>{task.seqResponses.map((response) => <span key={response.answerId}>{response.value}/7 · {response.scaleVersion}</span>)}</div>}
      <small>Raw score is shown with its scale version; no unapproved aggregate or scale inversion is introduced.</small>
    </div>
  </article>)}</div>;
}

function Paths({ results }: { results: ResultsModel }) {
  const paths = results.paths.filter((path) => path.actualPath.length > 0 || path.expectedPath.length > 0);
  if (paths.length === 0) return <EmptyState>No canonical screen path evidence exists for this version.</EmptyState>;
  return <div className={styles.taskList}>{paths.map((path) => <article key={`${path.sessionId}:${path.taskId}`} className={styles.panel}>
    <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Session {path.sessionId.slice(0, 8)}</span><h2>Expected vs actual path</h2></div><span className={path.expectedPathMatch ? styles.badgeSuccess : styles.badge}>{path.terminalOutcome ?? "No terminal"}</span></div>
    <div className={styles.pathCompare}>
      <div><strong>Expected</strong><div className={styles.pathRow}>{path.expectedPath.length ? path.expectedPath.map((screen, index) => <span key={`${screen}:${index}`}>{screen}</span>) : <em>No versioned expected path</em>}</div></div>
      <div><strong>Actual</strong><div className={styles.pathRow}>{path.actualPath.length ? path.actualPath.map((screen, index) => <span key={`${screen}:${index}`}>{screen}</span>) : <em>No path evidence</em>}</div></div>
    </div>
    <div className={styles.frictionGrid}>
      <div><strong>{path.detourCount}</strong><span>Detour visits</span></div>
      <div><strong>{path.backtrackCount}</strong><span>Backtracks</span></div>
      <div><strong>{path.repeatedScreenCount}</strong><span>Repeated screens</span></div>
    </div>
  </article>)}</div>;
}

function Funnel({ results }: { results: ResultsModel }) {
  const funnel = results.funnel;
  if (!funnel) return <EmptyState>No funnel definition is stored with this published version. Configure ordered canonical screen IDs before publishing to calculate conversion and drop-off.</EmptyState>;
  return <div className={styles.stack}>
    <section className={styles.metricsGrid} aria-label="Funnel summary">
      <MetricCard label="Eligible sessions" value={String(funnel.eligibleSessionCount)} detail="Technical blocks excluded" />
      <MetricCard label="Technical blocked" value={String(funnel.technicalBlockedSessionCount)} detail="Reported separately" />
      <MetricCard label="Largest drop" value={funnel.largestDrop ? metric(funnel.largestDrop.dropOffRate, "%") : "No Data"} detail={funnel.largestDrop ? `${funnel.largestDrop.fromScreenId} → ${funnel.largestDrop.toScreenId}` : "No entered transition"} />
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>{funnel.version}</span><h2>Step conversion & drop-off</h2></div></div>
      <ol className={styles.funnelList}>
        {funnel.transitions.map((transition) => <li key={`${transition.index}:${transition.fromScreenId}:${transition.toScreenId}`} className={styles.funnelTransition}>
          <div><strong>{transition.fromScreenId} → {transition.toScreenId}</strong><small>Entered {transition.entered} · Reached {transition.reached} · Dropped {transition.dropped}</small></div>
          <div className={styles.funnelRates}><span>Conversion <strong>{metric(transition.conversionRate, "%")}</strong></span><span>Drop-off <strong>{metric(transition.dropOffRate, "%")}</strong></span></div>
        </li>)}
      </ol>
    </section>
  </div>;
}

function Sessions({ results }: { results: ResultsModel }) {
  if (results.sessions.length === 0) return <EmptyState>No session evidence exists for this published version.</EmptyState>;
  return <div className={styles.taskList}>{results.sessions.map((session) => <details key={session.sessionId} className={styles.panel}>
    <summary className={styles.sessionSummary}><span><strong>{session.sessionId}</strong><small>Participant {session.participantId}</small></span><span className={styles.badge}>{session.terminal ?? "active"}</span></summary>
    <div className={styles.timeline}>{session.timeline.map((item) => <div key={`${item.kind}:${item.id}`} className={styles.timelineItem}>
      <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
      <div><strong>{item.eventType}</strong><small>{item.layer}{item.taskId ? ` · task ${item.taskId.slice(0, 8)}` : ""}{item.screenId ? ` · screen ${item.screenId}` : ""}</small></div>
    </div>)}</div>
  </details>)}</div>;
}

export default function ResultsPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  const [versionId, setVersionId] = useState("");
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => { void params.then((value) => setVersionId(value.testVersionId)); }, [params]);
  useEffect(() => {
    if (!versionId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/results/${encodeURIComponent(versionId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) throw new Error("Sign in is required to view Results.");
        if (response.status === 403) throw new Error("You do not have access to this workspace.");
        if (!response.ok) throw new Error("Results could not be loaded.");
        const payload = await response.json() as { results?: ResultsModel };
        if (!payload.results) throw new Error("Results response is incomplete.");
        setState({ status: "ready", results: payload.results });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Results could not be loaded." });
      });
    return () => controller.abort();
  }, [versionId]);

  const title = useMemo(() => versionId ? `Version ${versionId.slice(0, 8)}` : "Results", [versionId]);
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Results · published evidence</span><h1>{title}</h1><p>Metrics are reproduced from accepted canonical events. Technical blocks remain separate from usability outcomes and No Data is never displayed as zero.</p></div><a href="/projects" className={styles.backLink}>Projects</a></header>
    <nav className={styles.tabs} aria-label="Results views">{(["overview", "tasks", "paths", "funnel", "sessions"] as const).map((item) => <button key={item} type="button" aria-current={view === item ? "page" : undefined} className={view === item ? styles.tabActive : styles.tab} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
    {state.status === "loading" ? <div className={styles.loading} role="status">Loading canonical Results…</div> : null}
    {state.status === "error" ? <div className={styles.error} role="alert"><strong>Results unavailable</strong><p>{state.message}</p></div> : null}
    {state.status === "ready" ? <section className={styles.content}>{view === "overview" ? <Overview results={state.results} /> : view === "tasks" ? <Tasks results={state.results} /> : view === "paths" ? <Paths results={state.results} /> : view === "funnel" ? <Funnel results={state.results} /> : <Sessions results={state.results} />}</section> : null}
  </main>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MetricObservation,
  ReportAvailability,
  UsabilityReport,
} from "../../../lib/reports/model.ts";
import styles from "./report.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: UsabilityReport };

const availabilityLabels: Record<ReportAvailability, string> = {
  Available: "พร้อมใช้",
  Partial: "ข้อมูลบางส่วน",
  Unsupported: "ไม่รองรับ",
  "No Data": "ยังไม่มีข้อมูล",
};

const metricLabels: Record<string, string> = {
  completionRate: "อัตรางานสำเร็จ",
  medianSuccessfulDurationMs: "เวลามัธยฐานของงานสำเร็จ",
  p75SuccessfulDurationMs: "P75 ของเวลางานสำเร็จ",
  p90SuccessfulDurationMs: "P90 ของเวลางานสำเร็จ",
  giveUpRate: "อัตรายุติงาน",
  misclickRate: "อัตราคลิกพลาด",
  seqMedian: "SEQ มัธยฐาน",
};

const severityLabels: Record<string, string> = {
  critical: "วิกฤต",
  high: "สูง",
  medium: "กลาง",
  low: "ต่ำ",
};

function AvailabilityBadge({ value }: { value: ReportAvailability }) {
  return <span className={styles.availability} data-state={value}>{availabilityLabels[value]}</span>;
}

function formatDuration(value: number | null): string {
  if (value === null) return "ยังไม่มีข้อมูล";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${Math.round(value / 100) / 10} วินาที`;
}

function formatMetric(observation: MetricObservation): string {
  if (observation.availability === "Unsupported") return "ไม่รองรับ";
  if (observation.availability === "Partial") return observation.value === null ? "ข้อมูลบางส่วน" : String(Math.round(observation.value * 10) / 10);
  if (observation.availability === "No Data" || observation.value === null) return "ยังไม่มีข้อมูล";
  if (observation.metricKey.includes("DurationMs")) return formatDuration(observation.value);
  if (observation.metricKey === "seqMedian") return `${Math.round(observation.value * 10) / 10}/7`;
  return `${Math.round(observation.value * 10) / 10}%`;
}

function ObservationMeta({ item }: { item: MetricObservation }) {
  return <div className={styles.observationMeta}>
    <span>n={item.sampleSize}</span>
    {item.denominator !== null ? <span>denominator={item.denominator}</span> : null}
    {item.numerator !== null ? <span>numerator={item.numerator}</span> : null}
    <span>technical blocks={item.technicalBlockedCount}</span>
    <span>aggregation={item.aggregationVersion ?? "N/A"}</span>
    <span>definition={item.metricDefinitionVersion}</span>
  </div>;
}

function MetricCard({ item }: { item: MetricObservation }) {
  return <article className={styles.metricCard}>
    <div className={styles.metricHeader}>
      <span>{metricLabels[item.metricKey] ?? item.metricKey}</span>
      <AvailabilityBadge value={item.availability} />
    </div>
    <strong>{formatMetric(item)}</strong>
    <ObservationMeta item={item} />
    <details className={styles.trace}>
      <summary>ดูที่มาของข้อมูล</summary>
      <div>
        <p><b>Target:</b> {item.targetProvider ?? "ไม่พบ provider"} · snapshot {item.targetSnapshotVersion ?? "N/A"}</p>
        <p><b>Rule versions:</b> {item.ruleVersions.length ? item.ruleVersions.join(", ") : "ไม่มี derived rule"}</p>
        <p><b>Evidence refs:</b> {item.evidenceRefs.length ? item.evidenceRefs.join(", ") : "ไม่มีหลักฐานใน scope นี้"}</p>
      </div>
    </details>
  </article>;
}

function StudyContext({ report }: { report: UsabilityReport }) {
  const ctx = report.study.context;
  return <section className={styles.section} id="study-context">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>01 · Study Context</span><h2>บริบทของการทดสอบ</h2></div>
      <span className={styles.versionBadge}>Version {ctx.versionNo ?? "N/A"}</span>
    </div>
    <div className={styles.contextGrid}>
      <div><span>Test Version</span><strong>{ctx.testVersionId}</strong></div>
      <div><span>Target Provider</span><strong>{ctx.target.provider ?? "ยังไม่มีข้อมูล"}</strong></div>
      <div><span>Environment</span><strong>{ctx.target.environment ?? "—"}</strong></div>
      <div><span>Launch Mode</span><strong>{ctx.target.launchMode ?? "—"}</strong></div>
      <div><span>Participants</span><strong>{report.study.participantCount}</strong></div>
      <div><span>Sessions</span><strong>{report.study.sessionCount}</strong></div>
      <div><span>Eligible task attempts</span><strong>{report.study.eligibleTaskCount}</strong></div>
      <div><span>Technical blocks</span><strong>{report.study.technicalBlockedTaskCount}</strong></div>
    </div>
    {ctx.target.sourceUrl ? <p className={styles.sourceUrl}><b>Target snapshot:</b> {ctx.target.sourceUrl}</p> : null}
    <div className={styles.capabilityGrid}>
      {report.study.capabilityCoverage.length ? report.study.capabilityCoverage.map((item) =>
        <div key={item.capability}><span>{item.capability}</span><AvailabilityBadge value={item.state} /></div>,
      ) : <p className={styles.muted}>ยังไม่มี capability snapshot ที่อ่านได้ จึงถือบริบทนี้เป็น Partial จนกว่าจะพิสูจน์ได้</p>}
    </div>
  </section>;
}

function ExecutiveSummary({ report }: { report: UsabilityReport }) {
  const headline = report.metrics.filter((item) =>
    item.scope === "overall" &&
    ["completionRate", "medianSuccessfulDurationMs", "misclickRate", "giveUpRate"].includes(item.metricKey),
  );
  return <section className={styles.section} id="executive-summary">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>02 · Executive Summary</span><h2>สรุปเพื่อการตัดสินใจ</h2></div>
      <span className={styles.noteBadge}>Researcher-authored findings only</span>
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.executiveSummary.totalFindings}</strong><span>Findings ทั้งหมด</span></div>
      <div><strong>{report.executiveSummary.criticalHighFindings}</strong><span>Critical / High</span></div>
      <div><strong>{report.executiveSummary.openFindings}</strong><span>ยังต้องดำเนินการ</span></div>
    </div>
    <div className={styles.metricsGrid}>{headline.map((item) => <MetricCard key={item.metricKey} item={item} />)}</div>
    <p className={styles.integrityNote}>ระบบสรุปเฉพาะ metric และ Findings ที่มีอยู่จริง ไม่แปลง metric anomaly เป็นสาเหตุ, severity หรือ recommendation อัตโนมัติ</p>
  </section>;
}

function TaskOutcomes({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="task-outcomes">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>03 · Task Outcomes</span><h2>ผลลัพธ์รายงาน</h2></div>
      <span className={styles.versionBadge}>{report.tasks.length} tasks</span>
    </div>
    <div className={styles.taskStack}>
      {report.tasks.length === 0 ? <div className={styles.empty}>ยังไม่มี Task ในเวอร์ชันนี้</div> : report.tasks.map((task) =>
        <article className={styles.taskCard} key={task.taskId}>
          <header><div><span>Task {task.ordinal}</span><h3>{task.title}</h3></div><code>{task.taskId}</code></header>
          <div className={styles.outcomeGrid}>
            {Object.entries(task.outcomes).map(([key, value]) => <div key={key}><strong>{value}</strong><span>{key}</span></div>)}
          </div>
          <div className={styles.metricsGrid}>{task.observations.map((item) => <MetricCard key={item.metricKey} item={item} />)}</div>
        </article>,
      )}
    </div>
  </section>;
}

function Findings({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="findings">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>04 · Findings</span><h2>Evidence → Finding → Recommendation</h2></div>
      <a className={styles.actionLink} href={`/findings/${report.study.context.testVersionId}`}>จัดการ Findings</a>
    </div>
    <div className={styles.findingStack}>
      {report.findings.length === 0 ? <div className={styles.empty}><strong>ยังไม่มี Finding</strong><p>Metric หรือ friction signal ไม่ถูกแปลงเป็น Finding โดยอัตโนมัติ Researcher ต้องสร้าง interpretation และ recommendation เอง</p></div> : report.findings.map((item) =>
        <article className={styles.findingCard} key={item.finding.id} id={`finding-${item.finding.id}`}>
          <header>
            <div><span className={styles.severity} data-severity={item.finding.severity}>{severityLabels[item.finding.severity] ?? item.finding.severity}</span><h3>{item.finding.title}</h3></div>
            <span className={styles.statusBadge}>{item.finding.status}</span>
          </header>
          <div className={styles.findingGrid}>
            <div><span>Problem</span><p>{item.finding.problem}</p></div>
            <div><span>Researcher interpretation</span><p>{item.finding.researcherInterpretation ?? "ยังไม่ได้ระบุ"}</p></div>
            <div><span>Recommendation</span><p>{item.finding.recommendation ?? "ยังไม่ได้ระบุ"}</p></div>
          </div>
          {item.metricObservation ? <div className={styles.findingMetric}><MetricCard item={item.metricObservation} /></div> : <div className={styles.warning}>Metric snapshot ของ Finding นี้ยัง map กลับ Metric Observation ปัจจุบันไม่ได้</div>}
          <details className={styles.evidenceBundle}>
            <summary>Evidence Bundle · {item.evidence.length} linked records · {item.evidenceRefs.length} refs</summary>
            <div className={styles.evidenceList}>
              {item.evidence.length === 0 ? <p className={styles.muted}>ยังไม่มี linked evidence record เพิ่มเติม; metric snapshot ยังคงเก็บ source refs ของ Finding</p> : item.evidence.map((evidence) =>
                <div key={evidence.id}>
                  <strong>{evidence.type}</strong>
                  <span>session={evidence.sessionId ?? "—"}</span>
                  <span>event={evidence.eventId ?? "—"}</span>
                  <span>answer={evidence.answerId ?? "—"}</span>
                  {Object.keys(evidence.payload).length ? <pre>{JSON.stringify(evidence.payload, null, 2)}</pre> : null}
                </div>,
              )}
              <div className={styles.refs}><b>All trace refs:</b> {item.evidenceRefs.length ? item.evidenceRefs.join(", ") : "ยังไม่มี"}</div>
            </div>
          </details>
        </article>,
      )}
    </div>
  </section>;
}

function EvidenceExplorer({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="evidence-explorer">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>05 · Evidence Explorer</span><h2>ตรวจย้อนกลับถึงหลักฐาน</h2></div>
      <AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} />
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.evidenceExplorer.sessions.length}</strong><span>Sessions</span></div>
      <div><strong>{report.evidenceExplorer.paths.length}</strong><span>Task paths</span></div>
      <div><strong>{report.evidenceExplorer.feedbackCount}</strong><span>Feedback answers</span></div>
    </div>
    <div className={styles.explorerColumns}>
      <div>
        <h3>Sessions & Timeline</h3>
        {report.evidenceExplorer.sessions.length === 0 ? <p className={styles.muted}>ยังไม่มี session evidence</p> : report.evidenceExplorer.sessions.map((session) =>
          <details className={styles.session} key={session.sessionId}>
            <summary><span>{session.sessionId}</span><b>{session.terminal ?? "active"}</b></summary>
            <div className={styles.timeline}>
              {session.timeline.map((item) => <div key={`${item.kind}:${item.id}`}>
                <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString("th-TH")}</time>
                <span>{item.kind} · <code>{item.eventType}</code>{item.taskId ? ` · task ${item.taskId}` : ""}{item.screenId ? ` · screen ${item.screenId}` : ""}</span>
                <small>{item.id}</small>
              </div>)}
            </div>
          </details>,
        )}
      </div>
      <div>
        <h3>Paths</h3>
        {report.evidenceExplorer.paths.length === 0 ? <p className={styles.muted}>ยังไม่มี trusted screen path evidence</p> : report.evidenceExplorer.paths.map((path) =>
          <details className={styles.session} key={`${path.sessionId}:${path.taskId}`}>
            <summary><span>{path.sessionId}</span><b>{path.terminalOutcome ?? "active"}</b></summary>
            <div className={styles.pathInfo}>
              <p><b>Expected:</b> {path.expectedPath.length ? path.expectedPath.join(" → ") : "ไม่ได้กำหนด"}</p>
              <p><b>Actual:</b> {path.actualPath.length ? path.actualPath.join(" → ") : "No Data"}</p>
              <p>detour={path.detourCount} · backtrack={path.backtrackCount} · repeat={path.repeatedScreenCount}</p>
            </div>
          </details>,
        )}
        <div className={styles.heatmapState}>
          <b>Heatmap</b>
          <AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} />
          <p>{report.evidenceExplorer.heatmapReason ?? "ใช้เฉพาะ canonical coordinate evidence ที่ผ่าน capability gate"}</p>
        </div>
      </div>
    </div>
  </section>;
}

function Retest({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="retest">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>06 · Retest</span><h2>Baseline → Retest</h2></div>
      <span className={styles.versionBadge}>{report.retests.length} comparisons</span>
    </div>
    {report.retests.length === 0 ? <div className={styles.empty}>ยังไม่มี Retest comparison สำหรับเวอร์ชันนี้</div> : <div className={styles.retestGrid}>
      {report.retests.map((item) => <article key={item.retestId} className={styles.retestCard}>
        <header><strong>{metricLabels[item.comparison.metricKey] ?? item.comparison.metricKey}</strong><span>{item.status}</span></header>
        <div className={styles.retestValues}>
          <div><span>Baseline</span><strong>{item.comparison.baseline.value ?? "No Data"}</strong><small>n={item.comparison.baseline.sampleSize} · blocks={item.comparison.baseline.technicalBlockedCount}</small></div>
          <div><span>Retest</span><strong>{item.comparison.retest.value ?? "No Data"}</strong><small>n={item.comparison.retest.sampleSize} · blocks={item.comparison.retest.technicalBlockedCount}</small></div>
        </div>
        <p>Absolute delta: <b>{item.comparison.absoluteDelta ?? "N/A"}</b> · Relative delta: <b>{item.comparison.relativeDeltaPercent === null ? "N/A" : `${Math.round(item.comparison.relativeDeltaPercent * 10) / 10}%`}</b></p>
        <small>ไม่อ้าง statistical significance เพราะยังไม่มี approved method</small>
      </article>)}
    </div>}
  </section>;
}

export default function ReportPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  const [testVersionId, setTestVersionId] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => { void params.then((value) => setTestVersionId(value.testVersionId)); }, [params]);
  useEffect(() => {
    if (!testVersionId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/reports/${encodeURIComponent(testVersionId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) throw new Error("ต้องเข้าสู่ระบบเพื่อดูรายงาน");
        if (response.status === 403) throw new Error("คุณไม่มีสิทธิ์เข้าถึงเวิร์กสเปซนี้");
        if (!response.ok) throw new Error("สร้างรายงานจากหลักฐานไม่สำเร็จ");
        const payload = await response.json() as { report?: UsabilityReport };
        if (!payload.report) throw new Error("ข้อมูลรายงานไม่ครบถ้วน");
        setState({ status: "ready", report: payload.report });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "สร้างรายงานไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [testVersionId]);

  const title = useMemo(() => testVersionId ? `Usability Report · ${testVersionId.slice(0, 8)}` : "Usability Report", [testVersionId]);

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>Stage 12 · Understand</span><h1>{title}</h1><p>สังเคราะห์ Evidence → Metric → Finding → Recommendation ของ Published Test Version เดียวกัน โดยไม่สร้าง metric หรือข้อสรุปใหม่จากข้อมูลที่ไม่มีหลักฐาน</p></div>
      <div className={styles.heroActions}><a href={`/results/${testVersionId}`}>Results</a><a href={`/findings/${testVersionId}`}>Findings</a></div>
    </header>
    <nav className={styles.anchorNav} aria-label="ส่วนของรายงาน">
      <a href="#study-context">Study</a><a href="#executive-summary">Summary</a><a href="#task-outcomes">Tasks</a><a href="#findings">Findings</a><a href="#evidence-explorer">Evidence</a><a href="#retest">Retest</a>
    </nav>
    {state.status === "loading" ? <div className={styles.state}>กำลังสังเคราะห์รายงานจากหลักฐาน…</div> : null}
    {state.status === "error" ? <div className={styles.error} role="alert"><strong>ยังเปิดรายงานไม่ได้</strong><p>{state.message}</p></div> : null}
    {state.status === "ready" ? <div className={styles.report}>
      <StudyContext report={state.report} />
      <ExecutiveSummary report={state.report} />
      <TaskOutcomes report={state.report} />
      <Findings report={state.report} />
      <EvidenceExplorer report={state.report} />
      <Retest report={state.report} />
      <footer className={styles.footer}>Generated {new Date(state.report.generatedAt).toLocaleString("th-TH")} · {state.report.reportVersion}</footer>
    </div> : null}
  </main>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MetricObservation,
  ReportAvailability,
  ReportFinding,
  UsabilityReport,
} from "../../../lib/reports/model.ts";
import styles from "./report.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: UsabilityReport };

type ReportView = "summary" | "evidence";

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
  seqMedian: "ความง่ายในการทำงาน (SEQ)",
};

const severityLabels: Record<string, string> = {
  critical: "วิกฤต",
  high: "สูง",
  medium: "กลาง",
  low: "ต่ำ",
};

const providerLabels: Record<string, string> = {
  figma_prototype: "Figma Prototype",
  first_party_web: "เว็บไซต์ของทีม",
  external_web: "เว็บไซต์ภายนอก",
};

const eventLabels: Record<string, string> = {
  session_started: "เริ่มการทดสอบ",
  session_completed: "จบการทดสอบ",
  session_abandoned: "ออกจากการทดสอบ",
  session_technical_blocked: "ติดปัญหาทางเทคนิค",
  task_started: "เริ่มงาน",
  task_give_up: "ยุติงาน",
  task_timeout: "หมดเวลา",
  task_abandoned: "ออกจากงาน",
  task_technical_blocked: "งานติดปัญหาทางเทคนิค",
  screen_view: "เข้าหน้าจอ",
  pointer_interaction: "คลิก / แตะ",
  component_state_changed: "สถานะองค์ประกอบเปลี่ยน",
  completion_signal: "พบสัญญาณว่างานสำเร็จ",
  scroll: "เลื่อนหน้าจอ",
  question_viewed: "เห็นคำถาม",
  question_answered: "ตอบคำถาม",
  task_success: "งานสำเร็จ",
  task_failed: "งานไม่สำเร็จ",
  misclick: "คลิกพลาด",
  rage_click: "คลิกรัว",
  backtrack: "ย้อนกลับ",
};

function anchorId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function providerLabel(value: string | null): string {
  if (!value) return "ยังไม่ระบุ";
  return providerLabels[value] ?? value;
}

function metricValue(item: MetricObservation): string {
  if (item.availability === "Unsupported") return "ไม่รองรับ";
  if (item.availability === "Partial" && item.value === null) return "ข้อมูลบางส่วน";
  if (item.availability === "No Data" || item.value === null) return "ยังไม่มีข้อมูล";
  if (item.metricKey.includes("DurationMs")) {
    if (item.value < 1000) return `${Math.round(item.value)} มิลลิวินาที`;
    return `${Math.round(item.value / 100) / 10} วินาที`;
  }
  if (item.metricKey === "seqMedian") return `${Math.round(item.value * 10) / 10}/7`;
  return `${Math.round(item.value * 10) / 10}%`;
}

function observation(task: UsabilityReport["tasks"][number], key: string): MetricObservation | null {
  return task.observations.find((item) => item.metricKey === key) ?? null;
}

function findingTaskTitle(report: UsabilityReport, finding: ReportFinding): string {
  if (!finding.finding.taskId) return "ภาพรวม";
  return report.tasks.find((task) => task.taskId === finding.finding.taskId)?.title ?? "งานที่เกี่ยวข้อง";
}

function evidenceDestination(report: UsabilityReport, ref: string): string | null {
  const session = report.evidenceExplorer.sessions.find((item) => item.sessionId === ref);
  if (session) return `#session-${anchorId(ref)}`;
  for (const item of report.evidenceExplorer.sessions) {
    if (item.timeline.some((event) => event.id === ref)) return `#evidence-${anchorId(ref)}`;
  }
  return null;
}

function AvailabilityBadge({ value }: { value: ReportAvailability }) {
  return <span className={styles.availability} data-state={value}>{availabilityLabels[value]}</span>;
}

function StudyNav({ versionId }: { versionId: string }) {
  return <nav className={styles.studyNav} aria-label="เมนูการวิเคราะห์ของเวอร์ชันนี้">
    <a href={`/results/${versionId}`}>ผลการทดสอบ</a>
    <a href={`/findings/${versionId}`}>Findings</a>
    <a href={`/reports/${versionId}`} aria-current="page">รายงาน</a>
    <a href="#retest">Retest</a>
  </nav>;
}

function MetricCard({ item, report }: { item: MetricObservation; report: UsabilityReport }) {
  return <article className={styles.metricCard}>
    <div className={styles.metricHeader}>
      <span>{metricLabels[item.metricKey] ?? item.metricKey}</span>
      <AvailabilityBadge value={item.availability} />
    </div>
    <strong>{metricValue(item)}</strong>
    <div className={styles.metricSummary}>
      <span>n={item.sampleSize}</span>
      {item.technicalBlockedCount > 0 ? <span>{item.technicalBlockedCount} technical block</span> : null}
    </div>
    <details className={styles.trace}>
      <summary>วิธีคำนวณและหลักฐาน</summary>
      <div className={styles.traceBody}>
        <dl>
          <div><dt>ตัวตั้ง</dt><dd>{item.numerator ?? "—"}</dd></div>
          <div><dt>ตัวหาร</dt><dd>{item.denominator ?? "—"}</dd></div>
          <div><dt>Aggregation</dt><dd>{item.aggregationVersion ?? "N/A"}</dd></div>
          <div><dt>Definition</dt><dd>{item.metricDefinitionVersion}</dd></div>
        </dl>
        <p><b>Target:</b> {providerLabel(item.targetProvider)} · snapshot {item.targetSnapshotVersion ?? "N/A"}</p>
        <p><b>Rule version:</b> {item.ruleVersions.length ? item.ruleVersions.join(", ") : "ไม่มี derived rule"}</p>
        <div className={styles.traceRefs}>
          <b>หลักฐาน:</b>
          {item.evidenceRefs.length === 0 ? <span>ยังไม่มีหลักฐานใน scope นี้</span> : item.evidenceRefs.map((ref) => {
            const href = evidenceDestination(report, ref);
            return href
              ? <a key={ref} href={href}>{ref.slice(0, 12)}</a>
              : <span key={ref}>{ref.slice(0, 12)}</span>;
          })}
        </div>
      </div>
    </details>
  </article>;
}

function StudyContext({ report }: { report: UsabilityReport }) {
  const ctx = report.study.context;
  return <section className={styles.section} id="study-context">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>บริบทการทดสอบ</span><h2>Study snapshot</h2></div>
      <span className={styles.versionBadge}>Version {ctx.versionNo ?? "N/A"}</span>
    </div>
    <div className={styles.studySummary}>
      <div><span>Target</span><strong>{providerLabel(ctx.target.provider)}</strong></div>
      <div><span>ผู้เข้าร่วม</span><strong>{report.study.participantCount}</strong></div>
      <div><span>Sessions</span><strong>{report.study.sessionCount}</strong></div>
      <div><span>งานที่นำมาคำนวณ</span><strong>{report.study.eligibleTaskCount}</strong></div>
    </div>
    <details className={styles.advancedDetails}>
      <summary>รายละเอียดเวอร์ชันและ capability</summary>
      <div className={styles.contextGrid}>
        <div><span>Test Version</span><strong>{ctx.testVersionId}</strong></div>
        <div><span>Environment</span><strong>{ctx.target.environment ?? "—"}</strong></div>
        <div><span>Launch mode</span><strong>{ctx.target.launchMode ?? "—"}</strong></div>
        <div><span>Technical blocks</span><strong>{report.study.technicalBlockedTaskCount}</strong></div>
      </div>
      {ctx.target.sourceUrl ? <p className={styles.sourceUrl}><b>Target snapshot:</b> {ctx.target.sourceUrl}</p> : null}
      <div className={styles.capabilityGrid}>
        {report.study.capabilityCoverage.length ? report.study.capabilityCoverage.map((item) =>
          <div key={item.capability}><span>{item.capability}</span><AvailabilityBadge value={item.state} /></div>,
        ) : <p className={styles.muted}>ยังไม่มี capability snapshot ที่อ่านได้</p>}
      </div>
    </details>
  </section>;
}

function TopFinding({ item, report }: { item: ReportFinding; report: UsabilityReport }) {
  return <article className={styles.topFinding}>
    <div className={styles.findingTopLine}>
      <div>
        <span className={styles.severity} data-severity={item.finding.severity}>{severityLabels[item.finding.severity] ?? item.finding.severity}</span>
        <span className={styles.taskTag}>{findingTaskTitle(report, item)}</span>
      </div>
      <a href={`#finding-${anchorId(item.finding.id)}`}>ดูรายละเอียด</a>
    </div>
    <h3>{item.finding.title}</h3>
    <p>{item.finding.problem}</p>
    <div className={styles.actionBox}>
      <span>แนะนำให้ทำต่อ</span>
      <strong>{item.finding.recommendation ?? "ยังไม่ได้ระบุ recommendation"}</strong>
    </div>
  </article>;
}

function ExecutiveSummary({ report }: { report: UsabilityReport }) {
  const headline = report.metrics.filter((item) =>
    item.scope === "overall" &&
    ["completionRate", "medianSuccessfulDurationMs", "misclickRate", "giveUpRate"].includes(item.metricKey),
  );
  const topFindings = report.findings.slice(0, 5);
  return <section className={styles.section} id="executive-summary">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>สรุปสำหรับตัดสินใจ</span><h2>สิ่งสำคัญที่ควรรู้ตอนนี้</h2></div>
      <span className={styles.noteBadge}>Findings โดย Researcher</span>
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.executiveSummary.totalFindings}</strong><span>Findings ทั้งหมด</span></div>
      <div><strong>{report.executiveSummary.criticalHighFindings}</strong><span>ระดับสูงขึ้นไป</span></div>
      <div><strong>{report.executiveSummary.openFindings}</strong><span>ยังต้องดำเนินการ</span></div>
    </div>
    <div className={styles.metricsGrid}>{headline.map((item) => <MetricCard key={item.metricKey} item={item} report={report} />)}</div>
    <div className={styles.decisionHeader}>
      <div><span className={styles.eyebrow}>Top Findings</span><h3>ปัญหาที่ควรจัดการก่อน</h3></div>
      <a href="#findings">ดู Findings ทั้งหมด</a>
    </div>
    {topFindings.length === 0 ? <div className={styles.empty}>
      <strong>ยังไม่มี Finding ที่ Researcher ยืนยัน</strong>
      <p>Metric ไม่ถูกแปลงเป็นข้อสรุปอัตโนมัติ ให้สร้าง Finding เมื่อมี evidence เพียงพอ</p>
      <a className={styles.primaryAction} href={`/findings/${report.study.context.testVersionId}`}>สร้าง Finding</a>
    </div> : <div className={styles.topFindings}>{topFindings.map((item) => <TopFinding key={item.finding.id} item={item} report={report} />)}</div>}
  </section>;
}

function TaskOutcomes({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="task-outcomes">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Task Analysis</span><h2>ผลลัพธ์รายงาน</h2></div>
      <span className={styles.versionBadge}>{report.tasks.length} งาน</span>
    </div>
    <div className={styles.taskStack}>
      {report.tasks.length === 0 ? <div className={styles.empty}>ยังไม่มี Task ในเวอร์ชันนี้</div> : report.tasks.map((task) => {
        const completion = observation(task, "completionRate");
        const duration = observation(task, "medianSuccessfulDurationMs");
        const seq = observation(task, "seqMedian");
        const relatedFindings = report.findings.filter((item) => item.finding.taskId === task.taskId);
        return <details className={styles.taskCard} key={task.taskId}>
          <summary className={styles.taskSummary}>
            <div><span>Task {task.ordinal}</span><strong>{task.title}</strong></div>
            <div className={styles.taskSnapshot}>
              <span><b>{completion ? metricValue(completion) : "—"}</b> สำเร็จ</span>
              <span><b>{duration ? metricValue(duration) : "—"}</b> เวลา</span>
              <span><b>{seq ? metricValue(seq) : "—"}</b> SEQ</span>
              <span><b>{relatedFindings.length}</b> Findings</span>
            </div>
          </summary>
          <div className={styles.taskDetails}>
            <div className={styles.outcomeGrid}>
              {Object.entries(task.outcomes).map(([key, value]) => <div key={key}><strong>{value}</strong><span>{key}</span></div>)}
            </div>
            <div className={styles.metricsGrid}>{task.observations.map((item) => <MetricCard key={item.metricKey} item={item} report={report} />)}</div>
          </div>
        </details>;
      })}
    </div>
  </section>;
}

function Findings({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="findings">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Findings</span><h2>จาก Evidence ไปสู่สิ่งที่ควรแก้</h2></div>
      <a className={styles.actionLink} href={`/findings/${report.study.context.testVersionId}`}>จัดการ Findings</a>
    </div>
    <div className={styles.findingStack}>
      {report.findings.length === 0 ? <div className={styles.empty}>
        <strong>ยังไม่มี Finding</strong>
        <p>ระบบจะไม่สรุปสาเหตุหรือ severity จาก metric โดยอัตโนมัติ</p>
        <a className={styles.primaryAction} href={`/findings/${report.study.context.testVersionId}`}>สร้าง Finding จาก Evidence</a>
      </div> : report.findings.map((item) =>
        <article className={styles.findingCard} key={item.finding.id} id={`finding-${anchorId(item.finding.id)}`}>
          <header>
            <div>
              <div className={styles.findingTopLine}>
                <span className={styles.severity} data-severity={item.finding.severity}>{severityLabels[item.finding.severity] ?? item.finding.severity}</span>
                <span className={styles.taskTag}>{findingTaskTitle(report, item)}</span>
              </div>
              <h3>{item.finding.title}</h3>
              <p className={styles.findingProblem}>{item.finding.problem}</p>
            </div>
            <span className={styles.statusBadge}>{item.finding.status}</span>
          </header>
          <div className={styles.interpretationBlock}>
            <span>การตีความของ Researcher</span>
            <p>{item.finding.researcherInterpretation ?? "ยังไม่ได้ระบุ"}</p>
          </div>
          <div className={styles.actionBox}>
            <span>Recommendation</span>
            <strong>{item.finding.recommendation ?? "ยังไม่ได้ระบุ"}</strong>
          </div>
          {item.metricObservation ? <div className={styles.findingMetric}><MetricCard item={item.metricObservation} report={report} /></div> : <div className={styles.warning}>Metric snapshot ของ Finding นี้ยัง map กลับ Metric Observation ปัจจุบันไม่ได้</div>}
          <details className={styles.evidenceBundle}>
            <summary>ดู Evidence Bundle · {item.evidence.length} records · {item.evidenceRefs.length} refs</summary>
            <div className={styles.evidenceList}>
              {item.evidence.length === 0 ? <p className={styles.muted}>ยังไม่มี linked evidence record เพิ่มเติม</p> : item.evidence.map((evidence) => {
                const sessionHref = evidence.sessionId ? `#session-${anchorId(evidence.sessionId)}` : null;
                const eventHref = evidence.eventId ? `#evidence-${anchorId(evidence.eventId)}` : null;
                const answerHref = evidence.answerId ? `#evidence-${anchorId(evidence.answerId)}` : null;
                return <div key={evidence.id}>
                  <strong>{evidence.type}</strong>
                  {sessionHref ? <a href={sessionHref}>เปิด Session</a> : null}
                  {eventHref ? <a href={eventHref}>ไปที่ Event</a> : null}
                  {answerHref ? <a href={answerHref}>ไปที่ Feedback</a> : null}
                  {Object.keys(evidence.payload).length ? <details><summary>ดู payload</summary><pre>{JSON.stringify(evidence.payload, null, 2)}</pre></details> : null}
                </div>;
              })}
              <div className={styles.traceRefs}>
                <b>Trace refs:</b>
                {item.evidenceRefs.map((ref) => {
                  const href = evidenceDestination(report, ref);
                  return href ? <a key={ref} href={href}>{ref.slice(0, 12)}</a> : <span key={ref}>{ref.slice(0, 12)}</span>;
                })}
              </div>
            </div>
          </details>
        </article>,
      )}
    </div>
  </section>;
}

function EvidenceExplorer({ report }: { report: UsabilityReport }) {
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const sessions = showAllSessions ? report.evidenceExplorer.sessions : report.evidenceExplorer.sessions.slice(0, 5);
  const paths = showAllPaths ? report.evidenceExplorer.paths : report.evidenceExplorer.paths.slice(0, 5);

  return <section className={styles.section} id="evidence-explorer">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Evidence View</span><h2>ตรวจย้อนกลับถึงสิ่งที่เกิดขึ้นจริง</h2></div>
      <AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} />
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.evidenceExplorer.sessions.length}</strong><span>Sessions</span></div>
      <div><strong>{report.evidenceExplorer.paths.length}</strong><span>Task paths</span></div>
      <div><strong>{report.evidenceExplorer.feedbackCount}</strong><span>Feedback</span></div>
    </div>
    <div className={styles.explorerColumns}>
      <div>
        <h3>Participant journey</h3>
        {sessions.length === 0 ? <p className={styles.muted}>ยังไม่มี session evidence</p> : sessions.map((session) =>
          <details className={styles.session} key={session.sessionId} id={`session-${anchorId(session.sessionId)}`}>
            <summary>
              <span>Session {session.sessionId.slice(0, 8)}</span>
              <b>{session.terminal ?? "กำลังดำเนินการ"}</b>
            </summary>
            <div className={styles.timeline}>
              {session.timeline.map((item) => <div key={`${item.kind}:${item.id}`} id={`evidence-${anchorId(item.id)}`} className={styles.timelineItem}>
                <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString("th-TH")}</time>
                <div>
                  <strong>{eventLabels[item.eventType] ?? (item.kind === "feedback" ? "Feedback" : "เหตุการณ์")}</strong>
                  <span>{item.taskId ? `Task ${item.taskId.slice(0, 8)}` : "ระดับ Session"}{item.screenId ? ` · Screen ${item.screenId}` : ""}</span>
                </div>
                <details>
                  <summary>รายละเอียดเทคนิค</summary>
                  <code>{item.eventType} · {item.id}</code>
                </details>
              </div>)}
            </div>
          </details>,
        )}
        {report.evidenceExplorer.sessions.length > 5 ? <button className={styles.secondaryButton} type="button" onClick={() => setShowAllSessions((value) => !value)}>{showAllSessions ? "แสดงน้อยลง" : `แสดงทั้งหมด ${report.evidenceExplorer.sessions.length} Sessions`}</button> : null}
      </div>
      <div>
        <h3>เส้นทางการใช้งาน</h3>
        {paths.length === 0 ? <p className={styles.muted}>ยังไม่มี trusted screen path evidence</p> : paths.map((path) =>
          <details className={styles.session} key={`${path.sessionId}:${path.taskId}`}>
            <summary><span>Session {path.sessionId.slice(0, 8)}</span><b>{path.terminalOutcome ?? "active"}</b></summary>
            <div className={styles.pathInfo}>
              <p><b>เส้นทางที่คาดไว้:</b> {path.expectedPath.length ? path.expectedPath.join(" → ") : "ไม่ได้กำหนด"}</p>
              <p><b>เส้นทางจริง:</b> {path.actualPath.length ? path.actualPath.join(" → ") : "ยังไม่มีข้อมูล"}</p>
              <p>ออกนอกเส้นทาง {path.detourCount} · ย้อนกลับ {path.backtrackCount} · เข้าหน้าซ้ำ {path.repeatedScreenCount}</p>
            </div>
          </details>,
        )}
        {report.evidenceExplorer.paths.length > 5 ? <button className={styles.secondaryButton} type="button" onClick={() => setShowAllPaths((value) => !value)}>{showAllPaths ? "แสดงน้อยลง" : `แสดงทั้งหมด ${report.evidenceExplorer.paths.length} Paths`}</button> : null}
        <div className={styles.heatmapState}>
          <div><b>Heatmap</b><AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} /></div>
          <p>{report.evidenceExplorer.heatmapReason ?? "ใช้เฉพาะ canonical coordinates ที่ผ่าน capability gate"}</p>
          <a href={`/results/${report.study.context.testVersionId}`}>เปิด Heatmap ใน Results</a>
        </div>
      </div>
    </div>
  </section>;
}

function Methodology({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="methodology">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Methodology</span><h2>กติกาการตีความข้อมูล</h2></div>
    </div>
    <div className={styles.methodGrid}>
      <div><strong>No Data ≠ 0</strong><p>ค่าศูนย์จะแสดงเมื่อมี evidence และ denominator ที่รองรับเท่านั้น</p></div>
      <div><strong>Technical block แยกจาก usability</strong><p>ปัญหาการเข้าถึงหรือ provider failure ไม่ถูกรวมเป็น usability failure</p></div>
      <div><strong>Finding ต้องมาจาก Researcher</strong><p>Metric anomaly ไม่ถูกเปลี่ยนเป็น cause, severity หรือ recommendation อัตโนมัติ</p></div>
      <div><strong>Exact version only</strong><p>ทุก claim ผูกกับ published test version และ target snapshot เดียวกัน</p></div>
    </div>
    <details className={styles.advancedDetails}>
      <summary>Capability coverage</summary>
      <div className={styles.capabilityGrid}>{report.study.capabilityCoverage.map((item) =>
        <div key={item.capability}><span>{item.capability}</span><AvailabilityBadge value={item.state} /></div>,
      )}</div>
    </details>
  </section>;
}

function Retest({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="retest">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Retest</span><h2>ก่อนแก้เทียบกับหลังแก้</h2></div>
      <span className={styles.versionBadge}>{report.retests.length} comparisons</span>
    </div>
    {report.retests.length === 0 ? <div className={styles.empty}>
      <strong>ยังไม่มี Retest comparison</strong>
      <p>เมื่อมีเวอร์ชัน Retest ระบบจะแสดง baseline, retest, sample size และ technical blocks โดยไม่สรุป significance เอง</p>
    </div> : <div className={styles.retestGrid}>
      {report.retests.map((item) => <article key={item.retestId} className={styles.retestCard}>
        <header><strong>{metricLabels[item.comparison.metricKey] ?? item.comparison.metricKey}</strong><span>{item.status}</span></header>
        <div className={styles.retestValues}>
          <div><span>Baseline</span><strong>{item.comparison.baseline.value ?? "No Data"}</strong><small>n={item.comparison.baseline.sampleSize} · blocks={item.comparison.baseline.technicalBlockedCount}</small></div>
          <div><span>Retest</span><strong>{item.comparison.retest.value ?? "No Data"}</strong><small>n={item.comparison.retest.sampleSize} · blocks={item.comparison.retest.technicalBlockedCount}</small></div>
        </div>
        <p>Absolute delta: <b>{item.comparison.absoluteDelta ?? "N/A"}</b> · Relative delta: <b>{item.comparison.relativeDeltaPercent === null ? "N/A" : `${Math.round(item.comparison.relativeDeltaPercent * 10) / 10}%`}</b></p>
      </article>)}
    </div>}
  </section>;
}

export default function ReportPage({ params }: { params: Promise<{ testVersionId: string }> }) {
  const [testVersionId, setTestVersionId] = useState("");
  const [view, setView] = useState<ReportView>("summary");
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
    <a className={styles.skipLink} href="#report-content">ข้ามไปเนื้อหารายงาน</a>
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>Stage 12 · Understand</span>
        <h1>{title}</h1>
        <p>สรุปสิ่งที่เกิดขึ้น สิ่งที่ควรแก้ และหลักฐานที่รองรับ โดยคงการ trace กลับ exact version ไว้ครบ</p>
      </div>
      {testVersionId ? <StudyNav versionId={testVersionId} /> : null}
    </header>

    <div className={styles.viewSwitch} role="group" aria-label="รูปแบบการดูรายงาน">
      <button type="button" aria-pressed={view === "summary"} className={view === "summary" ? styles.viewActive : styles.viewButton} onClick={() => setView("summary")}>สรุปเพื่อการตัดสินใจ</button>
      <button type="button" aria-pressed={view === "evidence"} className={view === "evidence" ? styles.viewActive : styles.viewButton} onClick={() => setView("evidence")}>Evidence & Methodology</button>
    </div>

    {state.status === "loading" ? <div className={styles.state} role="status" aria-live="polite">กำลังสังเคราะห์รายงานจากหลักฐาน…</div> : null}
    {state.status === "error" ? <div className={styles.error} role="alert">
      <strong>ยังเปิดรายงานไม่ได้</strong><p>{state.message}</p>
      <div className={styles.errorActions}>
        <button type="button" onClick={() => window.location.reload()}>ลองอีกครั้ง</button>
        <a href={testVersionId ? `/results/${testVersionId}` : "/projects"}>กลับไปผลการทดสอบ</a>
      </div>
    </div> : null}

    {state.status === "ready" ? <div className={styles.report} id="report-content">
      {view === "summary" ? <>
        <StudyContext report={state.report} />
        <ExecutiveSummary report={state.report} />
        <TaskOutcomes report={state.report} />
        <Findings report={state.report} />
        <Retest report={state.report} />
      </> : <>
        <EvidenceExplorer report={state.report} />
        <Methodology report={state.report} />
      </>}
      <footer className={styles.footer}>สร้างจากข้อมูล ณ {new Date(state.report.generatedAt).toLocaleString("th-TH")} · {state.report.reportVersion}</footer>
    </div> : null}
  </main>;
}

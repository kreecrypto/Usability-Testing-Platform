"use client";

import { authenticatedFetch } from "../../../lib/auth/client.ts";

import { useEffect, useMemo, useState } from "react";
import { availabilityLabel } from "../../../lib/analytics/presentation.ts";
import type {
  MetricObservation,
  ReportAvailability,
  ReportFinding,
  UsabilityReport,
} from "../../../lib/reports/model.ts";
import ResultsNavigation from "../../../components/navigation/results-navigation";
import NavigationContext from "../../../components/navigation/study-context";
import styles from "./report.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: UsabilityReport };

type ReportView = "summary" | "evidence";

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

const findingStatusLabels: Record<string, string> = {
  open: "รอดำเนินการ",
  fixed: "แก้ไขแล้ว",
  retest_needed: "รอทดสอบซ้ำ",
  verified: "ยืนยันผลแล้ว",
  dismissed: "ปิดประเด็น",
};

const retestStatusLabels: Record<string, string> = {
  running: "กำลังทดสอบซ้ำ",
  completed: "ทดสอบซ้ำแล้ว",
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
  return <span className={styles.availability} data-state={value}>{availabilityLabel(value)}</span>;
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
      {item.technicalBlockedCount > 0 ? <span>ติดปัญหาทางเทคนิค {item.technicalBlockedCount}</span> : null}
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
      <div><span className={styles.eyebrow}>บริบทการทดสอบ</span><h2>แบบทดสอบที่เผยแพร่</h2></div>
      <span className={styles.versionBadge}>เวอร์ชัน {ctx.versionNo ?? "ไม่ทราบ"}</span>
    </div>
    <div className={styles.studySummary}>
      <div><span>เป้าหมายทดสอบ</span><strong>{providerLabel(ctx.target.provider)}</strong></div>
      <div><span>ผู้เข้าร่วม</span><strong>{report.study.participantCount}</strong></div>
      <div><span>เซสชัน</span><strong>{report.study.sessionCount}</strong></div>
      <div><span>งานที่นำมาคำนวณ</span><strong>{report.study.eligibleTaskCount}</strong></div>
    </div>
    <details className={styles.advancedDetails}>
      <summary>ที่มาและรายละเอียดเวอร์ชัน</summary>
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
        ) : <p className={styles.muted}>ยังไม่มีข้อมูลความสามารถของเป้าหมายทดสอบ</p>}
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
      <span className={styles.noteBadge}>ประเด็นที่ผู้วิจัยยืนยัน</span>
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.executiveSummary.totalFindings}</strong><span>ข้อค้นพบทั้งหมด</span></div>
      <div><strong>{report.executiveSummary.criticalHighFindings}</strong><span>ระดับสูงขึ้นไป</span></div>
      <div><strong>{report.executiveSummary.openFindings}</strong><span>ยังต้องดำเนินการ</span></div>
    </div>
    <div className={styles.metricsGrid}>{headline.map((item) => <MetricCard key={item.metricKey} item={item} report={report} />)}</div>
    <div className={styles.decisionHeader}>
      <div><span className={styles.eyebrow}>ประเด็นสำคัญ</span><h3>ปัญหาที่ควรจัดการก่อน</h3></div>
      <a href="#findings">ดูประเด็นทั้งหมด</a>
    </div>
    {topFindings.length === 0 ? <div className={styles.empty}>
      <strong>ยังไม่มีประเด็นที่ผู้วิจัยยืนยัน</strong>
      <p>ระบบไม่สรุปปัญหาจากตัวเลขอัตโนมัติ เมื่อมีหลักฐานเพียงพอให้บันทึกข้อค้นพบ</p>
      <a className={styles.primaryAction} href={`/findings/${report.study.context.testVersionId}`}>บันทึกข้อค้นพบ</a>
    </div> : <div className={styles.topFindings}>{topFindings.map((item) => <TopFinding key={item.finding.id} item={item} report={report} />)}</div>}
  </section>;
}

function TaskOutcomes({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="task-outcomes">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>วิเคราะห์รายงาน</span><h2>ผลลัพธ์รายงาน</h2></div>
      <span className={styles.versionBadge}>{report.tasks.length} งาน</span>
    </div>
    <div className={styles.taskStack}>
      {report.tasks.length === 0 ? <div className={styles.empty}>ยังไม่มีงานทดสอบในเวอร์ชันนี้</div> : report.tasks.map((task) => {
        const completion = observation(task, "completionRate");
        const duration = observation(task, "medianSuccessfulDurationMs");
        const seq = observation(task, "seqMedian");
        const relatedFindings = report.findings.filter((item) => item.finding.taskId === task.taskId);
        return <details className={styles.taskCard} key={task.taskId}>
          <summary className={styles.taskSummary}>
            <div><span>งาน {task.ordinal}</span><strong>{task.title}</strong></div>
            <div className={styles.taskSnapshot}>
              <span><b>{completion ? metricValue(completion) : "—"}</b> สำเร็จ</span>
              <span><b>{duration ? metricValue(duration) : "—"}</b> เวลา</span>
              <span><b>{seq ? metricValue(seq) : "—"}</b> SEQ</span>
              <span><b>{relatedFindings.length}</b> ข้อค้นพบ</span>
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
      <div><span className={styles.eyebrow}>ข้อค้นพบ</span><h2>จากหลักฐานไปสู่สิ่งที่ควรแก้</h2></div>
      <a className={styles.actionLink} href={`/findings/${report.study.context.testVersionId}`}>จัดการข้อค้นพบ</a>
    </div>
    <div className={styles.findingStack}>
      {report.findings.length === 0 ? <div className={styles.empty}>
        <strong>ยังไม่มีข้อค้นพบ</strong>
        <p>ระบบไม่สรุปสาเหตุหรือความรุนแรงจากตัวชี้วัดโดยอัตโนมัติ</p>
        <a className={styles.primaryAction} href={`/findings/${report.study.context.testVersionId}`}>บันทึกประเด็นจากหลักฐาน</a>
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
            <span className={styles.statusBadge}>{findingStatusLabels[item.finding.status] ?? item.finding.status}</span>
          </header>
          <div className={styles.interpretationBlock}>
            <span>การตีความของผู้วิจัย</span>
            <p>{item.finding.researcherInterpretation ?? "ยังไม่ได้ระบุ"}</p>
          </div>
          <div className={styles.actionBox}>
            <span>ข้อเสนอแนะ</span>
            <strong>{item.finding.recommendation ?? "ยังไม่ได้ระบุ"}</strong>
          </div>
          {item.metricObservation ? <div className={styles.findingMetric}><MetricCard item={item.metricObservation} report={report} /></div> : <div className={styles.warning}>ยังเชื่อมตัวชี้วัดของประเด็นนี้กับหลักฐานในเวอร์ชันปัจจุบันไม่ได้</div>}
          <details className={styles.evidenceBundle}>
            <summary>ดูชุดหลักฐาน · {item.evidence.length} รายการ · {item.evidenceRefs.length} แหล่งอ้างอิง</summary>
            <div className={styles.evidenceList}>
              {item.evidence.length === 0 ? <p className={styles.muted}>ยังไม่มีหลักฐานเพิ่มเติมที่เชื่อมกับประเด็นนี้</p> : item.evidence.map((evidence) => {
                const sessionHref = evidence.sessionId ? `#session-${anchorId(evidence.sessionId)}` : null;
                const eventHref = evidence.eventId ? `#evidence-${anchorId(evidence.eventId)}` : null;
                const answerHref = evidence.answerId ? `#evidence-${anchorId(evidence.answerId)}` : null;
                return <div key={evidence.id}>
                  <strong>{evidence.type}</strong>
                  {sessionHref ? <a href={sessionHref}>เปิดเซสชัน</a> : null}
                  {eventHref ? <a href={eventHref}>ไปที่เหตุการณ์</a> : null}
                  {answerHref ? <a href={answerHref}>ไปที่คำตอบ</a> : null}
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
      <div><span className={styles.eyebrow}>ตรวจหลักฐาน</span><h2>ตรวจย้อนกลับถึงสิ่งที่เกิดขึ้นจริง</h2></div>
      <AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} />
    </div>
    <div className={styles.summaryStrip}>
      <div><strong>{report.evidenceExplorer.sessions.length}</strong><span>เซสชัน</span></div>
      <div><strong>{report.evidenceExplorer.paths.length}</strong><span>เส้นทางการทำงาน</span></div>
      <div><strong>{report.evidenceExplorer.feedbackCount}</strong><span>คำตอบ</span></div>
    </div>
    <div className={styles.explorerColumns}>
      <div>
        <h3>การทำงานของผู้เข้าร่วม</h3>
        {sessions.length === 0 ? <p className={styles.muted}>ยังไม่มีหลักฐานจากเซสชัน</p> : sessions.map((session) =>
          <details className={styles.session} key={session.sessionId} id={`session-${anchorId(session.sessionId)}`}>
            <summary>
              <span>เซสชัน {session.sessionId.slice(0, 8)}</span>
              <b>{session.terminal ?? "กำลังดำเนินการ"}</b>
            </summary>
            <div className={styles.timeline}>
              {session.timeline.map((item) => <div key={`${item.kind}:${item.id}`} id={`evidence-${anchorId(item.id)}`} className={styles.timelineItem}>
                <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString("th-TH")}</time>
                <div>
                  <strong>{eventLabels[item.eventType] ?? (item.kind === "feedback" ? "คำตอบ" : "เหตุการณ์")}</strong>
                  <span>{item.taskId ? `งาน ${item.taskId.slice(0, 8)}` : "ทั้งเซสชัน"}{item.screenId ? ` · หน้าจอ ${item.screenId}` : ""}</span>
                </div>
                <details>
                  <summary>รายละเอียดเทคนิค</summary>
                  <code>{item.eventType} · {item.id}</code>
                </details>
              </div>)}
            </div>
          </details>,
        )}
        {report.evidenceExplorer.sessions.length > 5 ? <button className={styles.secondaryButton} type="button" onClick={() => setShowAllSessions((value) => !value)}>{showAllSessions ? "แสดงน้อยลง" : `แสดงเซสชันทั้งหมด ${report.evidenceExplorer.sessions.length} รายการ`}</button> : null}
      </div>
      <div>
        <h3>เส้นทางการใช้งาน</h3>
        {paths.length === 0 ? <p className={styles.muted}>ยังไม่มีหลักฐานเส้นทางหน้าจอที่ตรวจสอบได้</p> : paths.map((path) =>
          <details className={styles.session} key={`${path.sessionId}:${path.taskId}`}>
            <summary><span>เซสชัน {path.sessionId.slice(0, 8)}</span><b>{path.terminalOutcome ? eventLabels[path.terminalOutcome] ?? path.terminalOutcome : "กำลังทำ"}</b></summary>
            <div className={styles.pathInfo}>
              <p><b>เส้นทางที่คาดไว้:</b> {path.expectedPath.length ? path.expectedPath.join(" → ") : "ไม่ได้กำหนด"}</p>
              <p><b>เส้นทางจริง:</b> {path.actualPath.length ? path.actualPath.join(" → ") : "ยังไม่มีข้อมูล"}</p>
              <p>ออกนอกเส้นทาง {path.detourCount} · ย้อนกลับ {path.backtrackCount} · เข้าหน้าซ้ำ {path.repeatedScreenCount}</p>
            </div>
          </details>,
        )}
        {report.evidenceExplorer.paths.length > 5 ? <button className={styles.secondaryButton} type="button" onClick={() => setShowAllPaths((value) => !value)}>{showAllPaths ? "แสดงน้อยลง" : `แสดงเส้นทางทั้งหมด ${report.evidenceExplorer.paths.length} รายการ`}</button> : null}
        <div className={styles.heatmapState}>
          <div><b>ฮีตแมป</b><AvailabilityBadge value={report.evidenceExplorer.heatmapStatus} /></div>
          <p>{report.evidenceExplorer.heatmapStatus === "Unsupported" ? "เป้าหมายทดสอบนี้ไม่ส่งตำแหน่งที่ตรวจสอบได้" : report.evidenceExplorer.heatmapStatus === "No Data" ? "ยังไม่มีหลักฐานตำแหน่งสำหรับฮีตแมป" : "แสดงเฉพาะตำแหน่งที่ตรวจสอบได้จากเป้าหมายทดสอบ"}</p>
          <a href={`/results/${report.study.context.testVersionId}`}>เปิดฮีตแมปในผลการทดสอบ</a>
        </div>
      </div>
    </div>
  </section>;
}

function Methodology({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="methodology">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>วิธีอ่านผล</span><h2>กติกาการตีความข้อมูล</h2></div>
    </div>
    <div className={styles.methodGrid}>
      <div><strong>ไม่มีข้อมูลต่างจากค่า 0</strong><p>ระบบจะแสดงค่า 0 เมื่อมีหลักฐานและจำนวนตัวอย่างที่คำนวณได้เท่านั้น</p></div>
      <div><strong>แยกปัญหาทางเทคนิค</strong><p>ปัญหาการเข้าถึงเป้าหมายทดสอบไม่นับเป็นความล้มเหลวด้านการใช้งาน</p></div>
      <div><strong>ผู้วิจัยยืนยันข้อค้นพบ</strong><p>ระบบไม่สรุปสาเหตุหรือความรุนแรงจากตัวเลขเพียงอย่างเดียว</p></div>
      <div><strong>อ้างอิงเวอร์ชันเดียวกัน</strong><p>ข้อสรุปทุกข้อผูกกับแบบทดสอบที่เผยแพร่และเป้าหมายทดสอบเวอร์ชันเดียวกัน</p></div>
    </div>
    <details className={styles.advancedDetails}>
      <summary>ความสามารถในการเก็บหลักฐาน</summary>
      <div className={styles.capabilityGrid}>{report.study.capabilityCoverage.map((item) =>
        <div key={item.capability}><span>{item.capability}</span><AvailabilityBadge value={item.state} /></div>,
      )}</div>
    </details>
  </section>;
}

function Retest({ report }: { report: UsabilityReport }) {
  return <section className={styles.section} id="retest">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>ทดสอบซ้ำ</span><h2>ก่อนแก้เทียบกับหลังแก้</h2></div>
      <span className={styles.versionBadge}>เปรียบเทียบ {report.retests.length} รายการ</span>
    </div>
    {report.retests.length === 0 ? <div className={styles.empty}>
      <strong>ยังไม่มีการเปรียบเทียบผลทดสอบซ้ำ</strong>
      <p>เมื่อมีผลทดสอบหลังแก้ไข ระบบจะแสดงค่าก่อนและหลังพร้อมจำนวนตัวอย่าง โดยไม่สรุปนัยสำคัญทางสถิติเอง</p>
    </div> : <div className={styles.retestGrid}>
      {report.retests.map((item) => <article key={item.retestId} className={styles.retestCard}>
        <header><strong>{metricLabels[item.comparison.metricKey] ?? item.comparison.metricKey}</strong><span>{retestStatusLabels[item.status] ?? item.status}</span></header>
        <div className={styles.retestValues}>
          <div><span>ก่อนแก้</span><strong>{item.comparison.baseline.value ?? "ยังไม่มีข้อมูล"}</strong><small>n={item.comparison.baseline.sampleSize} · ติดปัญหาทางเทคนิค {item.comparison.baseline.technicalBlockedCount}</small></div>
          <div><span>หลังแก้</span><strong>{item.comparison.retest.value ?? "ยังไม่มีข้อมูล"}</strong><small>n={item.comparison.retest.sampleSize} · ติดปัญหาทางเทคนิค {item.comparison.retest.technicalBlockedCount}</small></div>
        </div>
        <p>ผลต่าง: <b>{item.comparison.absoluteDelta ?? "ยังไม่มีข้อมูล"}</b> · เปลี่ยนแปลงเทียบกับก่อนแก้: <b>{item.comparison.relativeDeltaPercent === null ? "ยังไม่มีข้อมูล" : `${Math.round(item.comparison.relativeDeltaPercent * 10) / 10}%`}</b></p>
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
    void authenticatedFetch(`/api/reports/${encodeURIComponent(testVersionId)}`, { cache: "no-store", signal: controller.signal })
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

  const title = useMemo(() => testVersionId ? `รายงานการทดสอบ · ${testVersionId.slice(0, 8)}` : "รายงานการทดสอบ", [testVersionId]);

  return <main className={styles.page}>
    <NavigationContext testId={state.status === "ready" ? state.report.study.context.testId : null} versionId={testVersionId} versionNo={state.status === "ready" ? state.report.study.context.versionNo : null} />
    <a className={styles.skipLink} href="#report-content">ข้ามไปเนื้อหารายงาน</a>
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>สรุปผลจากหลักฐาน</span>
        <h1>{title}</h1>
        <p>สรุปสิ่งที่เกิดขึ้น สิ่งที่ควรแก้ และหลักฐานที่รองรับในเวอร์ชันนี้</p>
      </div>
      {testVersionId ? <ResultsNavigation versionId={testVersionId} current="reports" /> : null}
    </header>

    <div className={styles.viewSwitch} role="group" aria-label="รูปแบบการดูรายงาน">
      <button type="button" aria-pressed={view === "summary"} className={view === "summary" ? styles.viewActive : styles.viewButton} onClick={() => setView("summary")}>สรุปเพื่อการตัดสินใจ</button>
      <button type="button" aria-pressed={view === "evidence"} className={view === "evidence" ? styles.viewActive : styles.viewButton} onClick={() => setView("evidence")}>หลักฐานและวิธีอ่านผล</button>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultsModel } from "../../../lib/analytics/results.ts";
import { capabilityAvailability, observationFor, presentMetric } from "../../../lib/analytics/presentation.ts";
import styles from "./results.module.css";

type View = "overview" | "tasks" | "paths" | "heatmap" | "funnel" | "sessions";
type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; results: ResultsModel };

const viewLabels: Record<View, string> = { overview: "ภาพรวม", tasks: "งานทดสอบ", paths: "เส้นทาง", heatmap: "ฮีตแมป", funnel: "ลำดับขั้น", sessions: "เซสชัน" };
const outcomeLabels: Record<string, string> = {
  success_direct: "สำเร็จตามเส้นทาง", success_indirect: "สำเร็จด้วยเส้นทางอื่น", failed: "ไม่สำเร็จ", give_up: "ยุติงาน", timeout: "หมดเวลา", abandoned: "ออกจากแบบทดสอบ", technical_blocked: "ติดปัญหาทางเทคนิค", active: "กำลังทำ",
};

function metric(value: number | null, suffix = ""): string { return value === null ? "ยังไม่มีข้อมูล" : `${Math.round(value * 10) / 10}${suffix}`; }
function duration(value: number | null): string { if (value === null) return "ยังไม่มีข้อมูล"; if (value < 1000) return `${Math.round(value)} มิลลิวินาที`; return `${Math.round(value / 100) / 10} วินาที`; }
function outcomeLabel(value: string | null): string { return value ? outcomeLabels[value] ?? value : "ยังไม่จบ"; }
function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className={styles.metricCard}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function ObservationCard({ results, metricKey, taskId = null, label, format }: { results: ResultsModel; metricKey: string; taskId?: string | null; label: string; format: (value: number) => string }) {
  const observed = presentMetric(observationFor(results, metricKey, taskId), format);
  return <article className={styles.metricCard} data-availability={observed.availability}>
    <span>{label} · {observed.availability}</span><strong>{observed.value}</strong><small>{observed.detail}</small>
    <details><summary>ที่มาและหลักฐาน · {observed.evidenceRefs.length} รายการ</summary><small className={styles.evidenceRefs}>{observed.provenance}</small>{observed.evidenceRefs.length ? <small className={styles.evidenceRefs}>{observed.evidenceRefs.join(", ")}</small> : null}</details>
  </article>;
}
function EmptyState({ title = "ยังไม่มีข้อมูล", children }: { title?: string; children: React.ReactNode }) { return <div className={styles.emptyState}><strong>{title}</strong><p>{children}</p></div>; }

function Overview({ results }: { results: ResultsModel }) {
  const value = results.overview;
  return <div className={styles.stack}>
    <section className={styles.metricsGrid} aria-label="ตัวชี้วัดภาพรวม">
      <MetricCard label="ผู้เข้าร่วม" value={value.sessionCount ? String(value.participantCount) : "ยังไม่มีข้อมูล"} detail={`${value.sessionCount} เซสชัน`} />
      <ObservationCard results={results} label="งานที่สำเร็จ" metricKey="completionRate" format={(n) => metric(n, "%")} />
      <ObservationCard results={results} label="เวลามัธยฐานของงานที่สำเร็จ" metricKey="medianSuccessfulDurationMs" format={duration} />
      <ObservationCard results={results} label="อัตราคลิกพลาด" metricKey="misclickRate" format={(n) => metric(n, "%")} />
      <ObservationCard results={results} label="อัตรายุติงาน" metricKey="giveUpRate" format={(n) => metric(n, "%")} />
      <MetricCard label="ติดปัญหาทางเทคนิค" value={value.sessionCount ? String(value.technicalBlockedTaskCount) : "ยังไม่มีข้อมูล"} detail="ไม่นำมารวมในผลด้านการใช้งาน" />
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>จุดติดขัดที่พบ</span><h2>พฤติกรรมที่ตรวจพบจากหลักฐาน</h2></div></div>
      <div className={styles.frictionGrid}>
        <div><strong>{capabilityAvailability(results, "pointer") === "Available" && value.eligiblePointerInteractionCount ? value.misclickCount : "–"}</strong><span>คลิกพลาด</span></div>
        <div><strong>{capabilityAvailability(results, "pointer") === "Available" && value.eligiblePointerInteractionCount ? value.rageClickCount : "–"}</strong><span>คลิกรัว</span></div>
        <div><strong>{capabilityAvailability(results, "path") === "Available" && results.paths.some((path) => path.actualPath.length) ? value.backtrackCount : "–"}</strong><span>ย้อนกลับ</span></div>
        <div><strong>{value.eligibleTaskCount ? value.giveUpCount : "–"}</strong><span>ยุติงาน</span></div>
      </div>
    </section>
    <section className={styles.warningPanel} role="status">
      <strong>คุณภาพของหลักฐานภาพ</strong>
      <p>Target: {results.context?.target.provider ?? "ไม่ทราบ"} · snapshot v{results.context?.target.snapshotVersion ?? "–"} · เวอร์ชันทดสอบ {results.testVersionId}. ฮีตแมปใช้เฉพาะพิกัดมาตรฐานที่ตรวจสอบได้ หากไม่มี geometry จะแสดง Unsupported/No Data.</p>
    </section>
  </div>;
}

function Tasks({ results }: { results: ResultsModel }) {
  if (results.taskDetails.length === 0) return <EmptyState title="ยังไม่มีผลงานทดสอบ">ยังไม่มีหลักฐานของงานที่นำมาคำนวณได้ในเวอร์ชันนี้</EmptyState>;
  return <div className={styles.taskList}>{results.taskDetails.map((task) => <article key={task.taskId} className={styles.panel}>
    <div className={styles.panelHeader}><div><span className={styles.eyebrow}>งาน {task.ordinal}</span><h2>{task.title}</h2></div><span className={styles.badge}>n={task.eligible}</span></div>
    <div className={styles.metricsGrid}>
      <ObservationCard results={results} taskId={task.taskId} label="สำเร็จ" metricKey="completionRate" format={(n) => metric(n, "%")} />
      <ObservationCard results={results} taskId={task.taskId} label="เวลามัธยฐาน" metricKey="medianSuccessfulDurationMs" format={duration} />
      <ObservationCard results={results} taskId={task.taskId} label="P75" metricKey="p75SuccessfulDurationMs" format={duration} />
      <ObservationCard results={results} taskId={task.taskId} label="P90" metricKey="p90SuccessfulDurationMs" format={duration} />
      <ObservationCard results={results} taskId={task.taskId} label="คลิกพลาด" metricKey="misclickRate" format={(n) => metric(n, "%")} />
      <MetricCard label="ปัญหาทางเทคนิค" value={String(task.technicalBlockedCount)} detail="รายงานแยกจากผลด้านการใช้งาน" />
    </div>
    <div className={styles.seqBlock}>
      <strong>คำตอบ SEQ ดิบ · n={task.seqSampleSize}</strong>
      {task.seqResponses.length === 0 ? <span>ยังไม่มีข้อมูล</span> : <div className={styles.chips}>{task.seqResponses.map((response) => <span key={response.answerId}>{response.value}/7 · {response.scaleVersion}</span>)}</div>}
      <small>แสดงคะแนนดิบพร้อมเวอร์ชันของสเกล โดยไม่สร้างค่าเฉลี่ยหรือกลับทิศสเกลที่ยังไม่ได้รับการอนุมัติ</small>
    </div>
  </article>)}</div>;
}

function Paths({ results }: { results: ResultsModel }) {
  const pathCapability = capabilityAvailability(results, "path");
  if (pathCapability !== "Available") return <EmptyState title={pathCapability === "Unsupported" ? "ไม่รองรับเส้นทาง" : pathCapability === "No Data" ? "ยังไม่มีข้อมูลเส้นทาง" : "ข้อมูลเส้นทางยังไม่ครบ"}>Target เวอร์ชันนี้ยังไม่มี capability ที่ยืนยันข้อมูลเส้นทางได้</EmptyState>;
  const paths = results.paths.filter((path) => path.actualPath.length > 0 || path.expectedPath.length > 0);
  if (paths.length === 0) return <EmptyState title="ยังไม่มีข้อมูลเส้นทาง">ยังไม่มีหลักฐานเส้นทางหน้าจอที่ใช้วิเคราะห์ได้ในเวอร์ชันนี้</EmptyState>;
  return <div className={styles.taskList}>{paths.map((path) => <article key={`${path.sessionId}:${path.taskId}`} className={styles.panel}>
    <div className={styles.panelHeader}><div><span className={styles.eyebrow}>เซสชัน {path.sessionId.slice(0, 8)}</span><h2>เส้นทางที่คาดไว้เทียบกับที่เกิดขึ้นจริง</h2></div><span className={path.expectedPathMatch ? styles.badgeSuccess : styles.badge}>{outcomeLabel(path.terminalOutcome)}</span></div>
    <div className={styles.pathCompare}>
      <div><strong>เส้นทางที่คาดไว้</strong><div className={styles.pathRow}>{path.expectedPath.length ? path.expectedPath.map((screen, index) => <span key={`${screen}:${index}`}>{screen}</span>) : <em>เวอร์ชันนี้ไม่ได้เก็บเส้นทางที่คาดไว้</em>}</div></div>
      <div><strong>เส้นทางที่เกิดขึ้นจริง</strong><div className={styles.pathRow}>{path.actualPath.length ? path.actualPath.map((screen, index) => <span key={`${screen}:${index}`}>{screen}</span>) : <em>ยังไม่มีหลักฐานเส้นทาง</em>}</div></div>
    </div>
    {path.actualPath.length ? <div className={styles.frictionGrid}>
      <div><strong>{path.detourCount}</strong><span>ออกนอกเส้นทาง</span></div>
      <div><strong>{path.backtrackCount}</strong><span>ย้อนกลับ</span></div>
      <div><strong>{path.repeatedScreenCount}</strong><span>เข้าหน้าซ้ำ</span></div>
    </div> : <small>ยังไม่มี screen_view ที่ใช้คำนวณเส้นทาง</small>}
  </article>)}</div>;
}

function Heatmap({ results }: { results: ResultsModel }) {
  const dataset = results.heatmap;
  const [taskId, setTaskId] = useState("");
  const [screenId, setScreenId] = useState(dataset.filters.screenIds[0] ?? "");
  const [deviceClass, setDeviceClass] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    if (!screenId && dataset.filters.screenIds[0]) setScreenId(dataset.filters.screenIds[0]);
  }, [dataset.filters.screenIds, screenId]);

  const heatmapCapability = capabilityAvailability(results, "pointer", "coordinates");
  if (heatmapCapability !== "Available") return <EmptyState title={heatmapCapability === "Unsupported" ? "ไม่รองรับฮีตแมป" : heatmapCapability === "No Data" ? "ยังไม่มีข้อมูลฮีตแมป" : "ข้อมูลฮีตแมปยังไม่ครบ"}>Target เวอร์ชันนี้ไม่มี capability ที่ยืนยันพิกัดได้</EmptyState>;
  if (dataset.status === "unsupported") return <EmptyState title="ฮีตแมปยังไม่พร้อม">พบ {dataset.rawPointerCount} pointer events แต่ไม่มี canonical geometry ที่ตรวจสอบได้ ระบบจึงไม่ใช้พิกัด browser/CSS เป็น fallback.</EmptyState>;
  if (dataset.status === "no_data") return <EmptyState title="ยังไม่มีข้อมูลฮีตแมป">ยังไม่มี pointer interaction ในเวอร์ชันนี้</EmptyState>;

  const points = dataset.points.filter((point) =>
    (!taskId || point.taskId === taskId)
    && (!screenId || point.screenId === screenId)
    && (!deviceClass || point.deviceClass === deviceClass)
    && (!outcome || point.terminalOutcome === outcome)
  );
  const frame = points[0] ?? dataset.points.find((point) => point.screenId === screenId) ?? dataset.points[0];
  const taskLabel = (id: string) => results.taskDetails.find((task) => task.taskId === id)?.title ?? id;

  return <div className={styles.stack}>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Screen Heatmap · {dataset.canonicalPointerCount}/{dataset.rawPointerCount} canonical</span><h2>ตำแหน่งคลิกบน Prototype</h2></div><span className={styles.badge}>เวอร์ชัน {results.testVersionId.slice(0, 8)}</span></div>
      <div className={styles.heatmapFilters}>
        <label>งาน<select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">ทั้งหมด</option>{dataset.filters.taskIds.map((id) => <option value={id} key={id}>{taskLabel(id)}</option>)}</select></label>
        <label>หน้าจอ<select value={screenId} onChange={(event) => setScreenId(event.target.value)}>{dataset.filters.screenIds.map((id) => <option value={id} key={id}>{id}</option>)}</select></label>
        <label>อุปกรณ์<select value={deviceClass} onChange={(event) => setDeviceClass(event.target.value)}><option value="">ทั้งหมด</option>{dataset.filters.deviceClasses.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>ผลลัพธ์<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">ทั้งหมด</option>{dataset.filters.outcomes.map((value) => <option value={value} key={value}>{outcomeLabel(value)}</option>)}</select></label>
      </div>
    </section>
    {points.length === 0 || !frame ? <EmptyState title="ไม่มีข้อมูลตามตัวกรอง">ลองเปลี่ยนงาน หน้าจอ อุปกรณ์ หรือผลลัพธ์</EmptyState> : <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>{frame.transformVersion} · geometry {frame.geometryVersionId.slice(0, 8)}</span><h2>หน้าจอ {frame.screenId}</h2></div><span className={styles.badge}>n={points.length}</span></div>
      <div className={styles.heatmapStageWrap}>
        <div className={styles.heatmapStage} style={{ aspectRatio: `${frame.frameWidth} / ${frame.frameHeight}` }} aria-label={`ฮีตแมปหน้าจอ ${frame.screenId}`}>
          {points.map((point) => <span key={point.eventId} className={styles.heatmapPoint} style={{ left: `${point.normalizedX * 100}%`, top: `${point.normalizedY * 100}%` }} title={`session ${point.sessionId.slice(0, 8)} · ${outcomeLabel(point.terminalOutcome)}`} aria-label={`คลิกที่ ${Math.round(point.normalizedX * 100)}%, ${Math.round(point.normalizedY * 100)}%`} />)}
        </div>
      </div>
      <small className={styles.heatmapNote}>จุดทั้งหมดวางจาก canonical normalized coordinates 0–1 ของ geometry snapshot นี้เท่านั้น ไม่ใช้ browser CSS pixels.</small>
    </section>}
  </div>;
}

function Funnel({ results }: { results: ResultsModel }) {
  const funnelCapability = capabilityAvailability(results, "path");
  if (funnelCapability !== "Available") return <EmptyState title={funnelCapability === "Unsupported" ? "ไม่รองรับ Funnel" : funnelCapability === "No Data" ? "ยังไม่มีข้อมูล Funnel" : "ข้อมูล Funnel ยังไม่ครบ"}>Target เวอร์ชันนี้ไม่มีข้อมูลเส้นทางที่ยืนยันได้</EmptyState>;
  const funnel = results.funnel;
  if (!funnel) return <EmptyState title="ยังไม่มี Funnel">เวอร์ชันนี้ยังไม่ได้กำหนดลำดับ Screen ID สำหรับคำนวณ Conversion และ Drop-off</EmptyState>;
  if (!funnel.eligibleSessionCount) return <EmptyState title="ยังไม่มีข้อมูล Funnel">ยังไม่มีเซสชันที่มีหลักฐาน screen_view สำหรับคำนวณขั้นตอน</EmptyState>;
  return <div className={styles.stack}>
    <section className={styles.metricsGrid} aria-label="สรุป Funnel">
      <MetricCard label="เซสชันที่นำมาคำนวณ" value={String(funnel.eligibleSessionCount)} detail="ไม่รวมเซสชันที่ติดปัญหาทางเทคนิค" />
      <MetricCard label="ติดปัญหาทางเทคนิค" value={String(funnel.technicalBlockedSessionCount)} detail="รายงานแยกต่างหาก" />
      <MetricCard label="จุดที่หลุดมากที่สุด" value={funnel.largestDrop ? metric(funnel.largestDrop.dropOffRate, "%") : "ยังไม่มีข้อมูล"} detail={funnel.largestDrop ? `${funnel.largestDrop.fromScreenId} → ${funnel.largestDrop.toScreenId}` : "ยังไม่มีการเปลี่ยนขั้นที่คำนวณได้"} />
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>{funnel.version}</span><h2>Conversion และ Drop-off รายขั้น</h2></div></div>
      <ol className={styles.funnelList}>{funnel.transitions.map((transition) => <li key={`${transition.index}:${transition.fromScreenId}:${transition.toScreenId}`} className={styles.funnelTransition}>
        <div><strong>{transition.fromScreenId} → {transition.toScreenId}</strong><small>เข้า {transition.entered} · ถึง {transition.reached} · หลุด {transition.dropped}</small></div>
        <div className={styles.funnelRates}><span>Conversion <strong>{metric(transition.conversionRate, "%")}</strong></span><span>Drop-off <strong>{metric(transition.dropOffRate, "%")}</strong></span></div>
      </li>)}</ol>
    </section>
  </div>;
}

function Sessions({ results }: { results: ResultsModel }) {
  if (results.sessions.length === 0) return <EmptyState title="ยังไม่มีเซสชัน">ยังไม่มีหลักฐานเซสชันในเวอร์ชันที่เผยแพร่นี้</EmptyState>;
  return <div className={styles.taskList}>{results.sessions.map((session) => <details key={session.sessionId} className={styles.panel}>
    <summary className={styles.sessionSummary}><span><strong>{session.sessionId}</strong><small>ผู้เข้าร่วม {session.participantId}</small></span><span className={styles.badge}>{outcomeLabel(session.terminal)}</span></summary>
    <div className={styles.timeline}>{session.timeline.map((item) => <div key={`${item.kind}:${item.id}`} className={styles.timelineItem}>
      <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString("th-TH")}</time>
      <div><strong>{item.kind === "feedback" ? "คำตอบหลังงาน" : "เหตุการณ์การใช้งาน"}</strong><small><code>{item.eventType}</code> · {item.layer}{item.taskId ? ` · งาน ${item.taskId.slice(0, 8)}` : ""}{item.screenId ? ` · หน้าจอ ${item.screenId}` : ""}</small></div>
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
        if (response.status === 401) throw new Error("ต้องเข้าสู่ระบบเพื่อดูผลการทดสอบ");
        if (response.status === 403) throw new Error("คุณไม่มีสิทธิ์เข้าถึงเวิร์กสเปซนี้");
        if (!response.ok) throw new Error("โหลดผลการทดสอบไม่สำเร็จ");
        const payload = await response.json() as { results?: ResultsModel };
        if (!payload.results) throw new Error("ข้อมูลผลการทดสอบไม่ครบถ้วน");
        setState({ status: "ready", results: payload.results });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "โหลดผลการทดสอบไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [versionId]);

  const title = useMemo(() => versionId ? `เวอร์ชัน ${versionId.slice(0, 8)}` : "วิเคราะห์ผล", [versionId]);
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>วิเคราะห์ผล · หลักฐานจากเวอร์ชันที่เผยแพร่</span><h1>{title}</h1><p>ดูผลการทดสอบจากหลักฐานที่ระบบยอมรับ โดยแยกปัญหาทางเทคนิคออกจากผลด้านการใช้งาน และไม่ใช้ศูนย์แทนข้อมูลที่ไม่มี</p></div><a href="/projects" className={styles.backLink}>โปรเจกต์</a></header>
    <nav className={styles.studyNav} aria-label="เมนูการวิเคราะห์ของเวอร์ชันนี้"><a href={`/results/${versionId}`} aria-current="page">ผลการทดสอบ</a><a href={`/findings/${versionId}`}>Findings</a><a href={`/reports/${versionId}`}>รายงาน</a><a href={`/reports/${versionId}#retest`}>Retest</a></nav>
    <nav className={styles.tabs} aria-label="มุมมองการวิเคราะห์ผล">{(["overview", "tasks", "paths", "heatmap", "funnel", "sessions"] as const).map((item) => <button key={item} type="button" aria-current={view === item ? "page" : undefined} className={view === item ? styles.tabActive : styles.tab} onClick={() => setView(item)}>{viewLabels[item]}</button>)}</nav>
    {state.status === "loading" ? <div className={styles.loading} role="status">กำลังโหลดผลการทดสอบ…</div> : null}
    {state.status === "error" ? <div className={styles.error} role="alert"><strong>ยังเปิดผลการทดสอบไม่ได้</strong><p>{state.message}</p></div> : null}
    {state.status === "ready" ? <section className={styles.content}>{view === "overview" ? <Overview results={state.results} /> : view === "tasks" ? <Tasks results={state.results} /> : view === "paths" ? <Paths results={state.results} /> : view === "heatmap" ? <Heatmap results={state.results} /> : view === "funnel" ? <Funnel results={state.results} /> : <Sessions results={state.results} />}</section> : null}
  </main>;
}

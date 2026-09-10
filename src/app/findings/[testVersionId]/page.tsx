"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultsModel, TaskDetailResult } from "../../../lib/analytics/results.ts";
import type { FindingRecord } from "../../../lib/findings/model.ts";
import styles from "./findings.module.css";

type LoadState = "loading" | "ready" | "error";
type MetricKey = "completionRate" | "misclickRate" | "giveUpRate" | "medianSuccessfulDurationMs";

const metricLabels: Record<MetricKey, string> = {
  completionRate: "อัตรางานสำเร็จ",
  misclickRate: "อัตราคลิกพลาด",
  giveUpRate: "อัตรายุติงาน",
  medianSuccessfulDurationMs: "เวลามัธยฐานของงานที่สำเร็จ",
};
const severityLabels: Record<string, string> = { critical: "วิกฤต", high: "สูง", medium: "กลาง", low: "ต่ำ" };
const statusLabels: Record<string, string> = { open: "เปิดอยู่", resolved: "แก้ไขแล้ว", closed: "ปิดแล้ว" };

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

function formatMetric(value: number | null): string { return value === null ? "ยังไม่มีข้อมูล" : String(Math.round(value * 10) / 10); }

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
      if (!resultsResponse.ok || !findingsResponse.ok) throw new Error(resultsResponse.status === 401 || findingsResponse.status === 401 ? "ต้องเข้าสู่ระบบก่อนใช้งาน" : "โหลดข้อมูลประเด็นที่พบไม่สำเร็จ");
      const resultsPayload = await resultsResponse.json() as { results: ResultsModel };
      const findingsPayload = await findingsResponse.json() as { findings: FindingRecord[] };
      setResults(resultsPayload.results); setFindings(findingsPayload.findings);
      setTaskId((current) => current || resultsPayload.results.taskDetails[0]?.taskId || "");
      setState("ready");
    } catch (value) { setState("error"); setError(value instanceof Error ? value.message : "โหลดข้อมูลประเด็นที่พบไม่สำเร็จ"); }
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
      if (!response.ok) throw new Error("สร้างประเด็นที่พบไม่สำเร็จ");
      setTitle(""); setProblem(""); setScreenId("");
      await reload();
    } catch (value) { setError(value instanceof Error ? value.message : "สร้างประเด็นที่พบไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function linkEvidence(finding: FindingRecord, type: "session" | "path") {
    const sessionId = evidenceSession[finding.id]?.trim();
    if (!sessionId || !results) return;
    const body: Record<string, unknown> = { type, sessionId };
    if (type === "path") {
      const path = results.paths.find((item) => item.sessionId === sessionId && (!finding.taskId || item.taskId === finding.taskId));
      if (!path) { setError("ไม่พบหลักฐานเส้นทางของเซสชันและงานนี้"); return; }
      body.payload = { taskId: path.taskId, expectedPath: path.expectedPath, actualPath: path.actualPath, detourCount: path.detourCount, backtrackCount: path.backtrackCount, terminalOutcome: path.terminalOutcome };
    }
    const response = await fetch(`/api/findings/${finding.id}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setError("เชื่อมหลักฐานไม่สำเร็จ"); return; }
    setError("");
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span>วิเคราะห์ผล · ประเด็นจากเวอร์ชันที่เผยแพร่</span><h1>ประเด็น UX ที่พบ</h1><p>เปลี่ยนพฤติกรรมที่สังเกตได้เป็นประเด็นที่นำไปแก้ไข โดยเก็บตัวชี้วัดและหลักฐานผูกกับเวอร์ชันที่สร้างข้อมูลนั้น</p></div><a href={`/results/${testVersionId}`}>กลับไปผลการทดสอบ</a></header>
    {state === "loading" ? <div className={styles.state}>กำลังโหลดประเด็นที่พบ…</div> : null}
    {state === "error" ? <div className={styles.error} role="alert">{error}</div> : null}
    {state === "ready" && results ? <div className={styles.layout}>
      <form className={styles.form} onSubmit={createFinding}>
        <div><span className={styles.eyebrow}>จากหลักฐานสู่สิ่งที่ต้องแก้</span><h2>สร้างประเด็นใหม่</h2></div>
        <label>งาน<select value={taskId} onChange={(event) => setTaskId(event.target.value)}>{results.taskDetails.map((task) => <option key={task.taskId} value={task.taskId}>{task.ordinal}. {task.title}</option>)}</select></label>
        <label>ตัวชี้วัดหลัก<select value={metricKey} onChange={(event) => setMetricKey(event.target.value as MetricKey)}>{Object.entries(metricLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {selectedTask ? <div className={styles.snapshot}><strong>{formatMetric(metricValue(selectedTask, metricKey))}</strong><span>n={metricKey === "medianSuccessfulDurationMs" ? selectedTask.successfulDuration.sampleSize : selectedTask.eligible} · ติดปัญหาทางเทคนิค={selectedTask.technicalBlockedCount}</span></div> : null}
        <label>ชื่อประเด็น<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="สรุปปัญหาที่สังเกตได้แบบสั้น ๆ" /></label>
        <label>ปัญหา<textarea required value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="ผู้เข้าร่วมติดขัดตรงไหน และเหตุใดจึงสำคัญ" /></label>
        <div className={styles.twoCol}><label>ความรุนแรง<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="critical">วิกฤต</option><option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option></select></label><label>Screen ID<input value={screenId} onChange={(event) => setScreenId(event.target.value)} placeholder="ไม่บังคับ · Screen ID มาตรฐาน" /></label></div>
        <button disabled={saving || !selectedTask}>{saving ? "กำลังสร้าง…" : "สร้างประเด็น"}</button>
      </form>

      <section className={styles.list}>
        <div className={styles.listHeader}><div><span className={styles.eyebrow}>ประเด็นที่ตรวจพบ</span><h2>ประเด็นทั้งหมด</h2></div><strong>{findings.length}</strong></div>
        {findings.length === 0 ? <div className={styles.empty}><strong>ยังไม่มีประเด็นที่พบ</strong><p>สร้างประเด็นจากตัวชี้วัดและหลักฐานเมื่อพบสิ่งที่ควรแก้ไข การไม่มีประเด็นยังไม่เท่ากับความรุนแรงเป็นศูนย์</p></div> : findings.map((finding) => <article key={finding.id} className={styles.card}>
          <div className={styles.cardHeader}><div><span className={styles.severity} data-severity={finding.severity}>{severityLabels[finding.severity] ?? finding.severity}</span><h3>{finding.title}</h3></div><span className={styles.status}>{statusLabels[finding.status] ?? finding.status}</span></div>
          <p>{finding.problem}</p>
          <dl><div><dt>ตัวชี้วัด</dt><dd>{metricLabels[finding.metricSnapshot.metricKey as MetricKey] ?? finding.metricSnapshot.metricKey}: {formatMetric(finding.metricSnapshot.value)}</dd></div><div><dt>ตัวอย่าง</dt><dd>n={finding.metricSnapshot.sampleSize}, ติดปัญหาทางเทคนิค={finding.metricSnapshot.technicalBlockedCount}</dd></div><div><dt>เวอร์ชัน</dt><dd>{finding.testVersionId}</dd></div>{finding.screenId ? <div><dt>หน้าจอ</dt><dd>{finding.screenId}</dd></div> : null}</dl>
          <div className={styles.evidenceBox}><strong>เชื่อมหลักฐาน</strong><input value={evidenceSession[finding.id] ?? ""} onChange={(event) => setEvidenceSession((value) => ({ ...value, [finding.id]: event.target.value }))} placeholder="Session UUID" /><div><button type="button" onClick={() => void linkEvidence(finding, "session")}>เชื่อมเซสชัน</button><button type="button" onClick={() => void linkEvidence(finding, "path")}>เชื่อมเส้นทาง</button><button type="button" disabled title="ฮีตแมปยังติด capability gate">ฮีตแมปยังใช้ไม่ได้</button></div></div>
        </article>)}
      </section>
    </div> : null}
    {error && state === "ready" ? <div className={styles.inlineError} role="alert">{error}</div> : null}
  </main>;
}

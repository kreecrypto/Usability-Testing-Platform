"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../results/[testVersionId]/results.module.css";

type Block = { blockId: string; kind: string; title: string; sampleSize: number };
type Evidence = { id: string; sessionId: string; blockId: string };
type Results = { blocks: Block[]; evidence: Evidence[] };
type Finding = { id: string; title: string; problem: string; severity: string; researcherInterpretation: string | null; recommendation: string | null; metricSnapshot: { sampleSize: number } };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json" } : undefined });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error(body.error ?? "request_failed");
  return body as T;
}

export default function MethodFindingsClient({ testVersionId }: { testVersionId: string }) {
  const [results, setResults] = useState<Results | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [blockId, setBlockId] = useState("");
  const [responseId, setResponseId] = useState("");
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [result, found] = await Promise.all([
        api<{ results: Results }>(`/api/methods/results/${encodeURIComponent(testVersionId)}`),
        api<{ findings: Finding[] }>(`/api/findings?testVersionId=${encodeURIComponent(testVersionId)}`),
      ]);
      setResults(result.results); setFindings(found.findings);
      setBlockId((current) => current || result.results.blocks[0]?.blockId || "");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลด Findings ไม่สำเร็จ"); }
  }, [testVersionId]);
  useEffect(() => { void load(); }, [load]);
  const block = results?.blocks.find((item) => item.blockId === blockId);
  const evidence = results?.evidence.filter((item) => item.blockId === blockId) ?? [];
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!block || !responseId || busy) return;
    setBusy(true); setError("");
    try {
      await api<{ findingId: string }>("/api/methods/findings", { method: "POST", body: JSON.stringify({
        testVersionId, studyResponseId: responseId, title, problem,
        researcherInterpretation: interpretation, recommendation, severity,
      }) });
      setTitle(""); setProblem(""); setInterpretation(""); setRecommendation(""); setResponseId(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้าง Finding ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className={styles.shell}><header><p className={styles.kicker}>Evidence → Finding</p><h1>ประเด็นจากวิธีวิจัย</h1><p><a href={`/methods/results/${encodeURIComponent(testVersionId)}`}>← Results</a> · <a href={`/methods/reports/${encodeURIComponent(testVersionId)}`}>Report →</a></p></header>
    {error ? <p role="alert">{error}</p> : null}
    {!results ? <p role="status">กำลังโหลด…</p> : <section className={styles.panel}><h2>สร้าง Finding</h2><form onSubmit={(event) => void create(event)}>
      <p>ใช้คำตอบจริงเป็นหลักฐาน และแยกสิ่งที่สังเกตได้ออกจากการตีความ</p>
      <label>กิจกรรม<select value={blockId} onChange={(event) => { setBlockId(event.target.value); setResponseId(""); }}>{results.blocks.map((item) => <option key={item.blockId} value={item.blockId}>{item.title}</option>)}</select></label>
      <label>หลักฐานระดับคำตอบ<select required value={responseId} onChange={(event) => setResponseId(event.target.value)}><option value="">เลือกคำตอบที่เป็นหลักฐาน</option>{evidence.map((item) => <option key={item.id} value={item.id}>Response {item.id.slice(0, 8)} · session {item.sessionId.slice(0, 8)}</option>)}</select></label>
      <label>ชื่อประเด็น<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>ปัญหาที่สังเกตได้<textarea required value={problem} onChange={(event) => setProblem(event.target.value)} /></label>
      <label>การตีความ<textarea required value={interpretation} onChange={(event) => setInterpretation(event.target.value)} /></label>
      <label>ข้อเสนอแนะ<textarea required value={recommendation} onChange={(event) => setRecommendation(event.target.value)} /></label>
      <label>ความรุนแรง<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="critical">วิกฤต</option><option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option></select></label>
      <button disabled={busy || !block || !responseId}>บันทึก Finding</button>
    </form></section>}
    <section className={styles.panel}><h2>Findings ({findings.length})</h2>{findings.length ? <ul>{findings.map((finding) => <li key={finding.id}><strong>{finding.title}</strong> · {finding.severity}<p>{finding.problem}</p><small>n={finding.metricSnapshot.sampleSize || "ยังไม่มีข้อมูล"}</small></li>)}</ul> : <p>ยังไม่มี Finding จากหลักฐานในเวอร์ชันนี้</p>}</section>
  </main>;
}

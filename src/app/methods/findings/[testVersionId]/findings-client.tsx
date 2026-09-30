"use client";

import { authenticatedFetch, SESSION_MESSAGE } from "../../../../lib/auth/client.ts";

import { useCallback, useEffect, useState } from "react";
import ResultsNavigation from "../../../../components/navigation/results-navigation";
import StudyContext from "../../../../components/navigation/study-context";
import { severityLabels, friendlyError } from "../../../../components/navigation/labels";
import styles from "../../results/[testVersionId]/results.module.css";

type Block = { blockId: string; kind: string; title: string; sampleSize: number };
type Evidence = { id: string; sessionId: string; blockId: string };
type Results = { testId: string; versionNo: number; blocks: Block[]; evidence: Evidence[] };
type Finding = { id: string; title: string; problem: string; severity: string; researcherInterpretation: string | null; recommendation: string | null; metricSnapshot: { sampleSize: number } };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json" } : undefined });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { throw new Error(SESSION_MESSAGE); }
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
    } catch (cause) { setError(cause instanceof Error ? friendlyError(cause) : "โหลดข้อค้นพบไม่สำเร็จ"); }
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
    } catch (cause) { setError(cause instanceof Error ? friendlyError(cause) : "บันทึกข้อค้นพบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className={styles.shell}><StudyContext testId={results?.testId} versionId={testVersionId} versionNo={results?.versionNo} /><ResultsNavigation versionId={testVersionId} methods current="findings" /><header><p className={styles.kicker}>จากหลักฐานสู่ข้อค้นพบ</p><h1>ข้อค้นพบจากการทดสอบ</h1><p><a href={`/methods/results/${encodeURIComponent(testVersionId)}`}>← ผลการทดสอบ</a> · <a href={`/methods/reports/${encodeURIComponent(testVersionId)}`}>รายงาน →</a></p></header>
    {error ? <p role="alert">{error}</p> : null}
    {!results ? <p role="status">กำลังโหลด…</p> : <section className={styles.panel}><h2>บันทึกข้อค้นพบ</h2><form onSubmit={(event) => void create(event)}>
      <p>ใช้คำตอบที่ส่งสำเร็จเป็นหลักฐาน และแยกสิ่งที่สังเกตได้ออกจากการตีความ</p>
      <label>กิจกรรม<select value={blockId} onChange={(event) => { setBlockId(event.target.value); setResponseId(""); }}>{results.blocks.map((item) => <option key={item.blockId} value={item.blockId}>{item.title}</option>)}</select></label>
      <label>หลักฐานระดับคำตอบ<select required value={responseId} onChange={(event) => setResponseId(event.target.value)}><option value="">เลือกคำตอบที่เป็นหลักฐาน</option>{evidence.map((item) => <option key={item.id} value={item.id}>คำตอบ {item.id.slice(0, 8)} · รอบ {item.sessionId.slice(0, 8)}</option>)}</select></label>
      <label>ชื่อข้อค้นพบ<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>ปัญหาที่สังเกตได้<textarea required value={problem} onChange={(event) => setProblem(event.target.value)} /></label>
      <label>การตีความ<textarea required value={interpretation} onChange={(event) => setInterpretation(event.target.value)} /></label>
      <label>ข้อเสนอแนะ<textarea required value={recommendation} onChange={(event) => setRecommendation(event.target.value)} /></label>
      <label>ความรุนแรง<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="critical">วิกฤต</option><option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option></select></label>
      <button disabled={busy || !block || !responseId}>บันทึกข้อค้นพบ</button>
    </form></section>}
    <section className={styles.panel}><h2>ข้อค้นพบ ({findings.length})</h2>{findings.length ? <ul>{findings.map((finding) => <li key={finding.id}><strong>{finding.title}</strong> · {severityLabels[finding.severity] ?? finding.severity}<p>{finding.problem}</p><small>{finding.metricSnapshot.sampleSize ? `ตัวอย่าง ${finding.metricSnapshot.sampleSize} รายการ` : "ยังไม่มีข้อมูลที่นับได้"}</small></li>)}</ul> : <p>ยังไม่มีข้อค้นพบสำหรับเวอร์ชันนี้ ตรวจผลและเลือกคำตอบที่เป็นหลักฐานก่อนบันทึก</p>}</section>
  </main>;
}

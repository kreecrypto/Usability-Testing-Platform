"use client";

import { useEffect, useState } from "react";
import styles from "../../results/[testVersionId]/results.module.css";

type Block = { blockId: string; ordinal: number; kind: string; title: string; comparisonKey: string; sampleSize: number; availability: string;
  questions?: { prompt: string; sampleSize: number; counts: { value: string; count: number }[] }[];
  cards?: { label: string; groups: { value: string; count: number }[] }[];
  prompts?: { title: string; sampleSize: number; successPercent: number | null; directPercent: number | null }[] };
type ReportData = { testId: string; testVersionId: string; versionNo: number; title: string; description: string | null; blocks: Block[]; evidence: { id: string; sessionId: string; blockId: string }[] };
type Finding = { id: string; title: string; problem: string; severity: string; researcherInterpretation: string | null; recommendation: string | null };

function percent(value: number | null): string { return value === null ? "ยังไม่มีข้อมูล" : `${Math.round(value * 10) / 10}%`; }

export default function MethodReportClient({ testVersionId }: { testVersionId: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState("");
  const [baselineId, setBaselineId] = useState("");
  const [baseline, setBaseline] = useState<ReportData | null>(null);
  const [compareError, setCompareError] = useState("");
  async function compare(event: React.FormEvent) {
    event.preventDefault(); setCompareError(""); setBaseline(null);
    if (!data || baselineId === data.testVersionId) { setCompareError("เลือกเวอร์ชันก่อนหน้าที่ต่างจากเวอร์ชันปัจจุบัน"); return; }
    try {
      const response = await fetch(`/api/methods/results/${encodeURIComponent(baselineId.trim())}`, { cache: "no-store" });
      if (!response.ok) throw new Error("โหลดเวอร์ชันเปรียบเทียบไม่สำเร็จ");
      const value = (await response.json() as { results: ReportData }).results;
      if (value.testId !== data.testId || value.versionNo >= data.versionNo) throw new Error("ต้องเป็นเวอร์ชันก่อนหน้าของแบบทดสอบเดียวกัน");
      setBaseline(value);
    } catch (cause) { setCompareError(cause instanceof Error ? cause.message : "เปรียบเทียบไม่สำเร็จ"); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/methods/results/${encodeURIComponent(testVersionId)}`, { cache: "no-store" }),
      fetch(`/api/findings?testVersionId=${encodeURIComponent(testVersionId)}`, { cache: "no-store" }),
    ]).then(async ([resultResponse, findingResponse]) => {
      if (resultResponse.status === 401 || findingResponse.status === 401) { window.location.assign("/login"); return; }
      if (!resultResponse.ok || !findingResponse.ok) throw new Error("report_unavailable");
      const result = await resultResponse.json() as { results: ReportData };
      const found = await findingResponse.json() as { findings: Finding[] };
      if (active) { setData(result.results); setFindings(found.findings); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "โหลดรายงานไม่สำเร็จ"); });
    return () => { active = false; };
  }, [testVersionId]);
  if (error) return <main className={styles.shell}><h1>เปิดรายงานไม่ได้</h1><p role="alert">{error}</p></main>;
  if (!data) return <main className={styles.shell}><p role="status">กำลังโหลดรายงาน…</p></main>;
  return <main className={styles.shell}>
    <header><p className={styles.kicker}>Research Report · เวอร์ชัน {data.versionNo}</p><h1>{data.title}</h1><p>{data.description || "การศึกษาวิธีวิจัย"}</p><p><a href={`/methods/results/${encodeURIComponent(testVersionId)}`}>Results และหลักฐาน →</a> · <a href={`/methods/findings/${encodeURIComponent(testVersionId)}`}>Findings →</a></p></header>
    <section className={styles.panel}><h2>ภาพรวม</h2><p>รายงานนี้สรุปคำตอบที่ส่งสำเร็จจากเวอร์ชัน <code>{data.testVersionId}</code> เท่านั้น ไม่รวมคำตอบที่ยังไม่ส่งหรือเวอร์ชันอื่น</p><p>กิจกรรม {data.blocks.length} รายการ · หลักฐานระดับคำตอบ {data.evidence.length || "ยังไม่มีข้อมูล"} รายการ</p></section>
    {data.blocks.map((block) => <section className={styles.panel} key={block.blockId}><p className={styles.kicker}>กิจกรรม {block.ordinal} · {block.kind}</p><h2>{block.title}</h2><p>{block.availability === "No Data" ? "ยังไม่มีข้อมูล" : `n=${block.sampleSize}`}</p>
      {block.questions?.map((question) => <div className={styles.subsection} key={question.prompt}><h3>{question.prompt}</h3><p>ผู้ตอบ n={question.sampleSize || "ยังไม่มีข้อมูล"}</p>{question.counts.length ? <ul>{question.counts.map((count) => <li key={count.value}>{count.value}: {count.count}</li>)}</ul> : null}</div>)}
      {block.cards?.map((card) => <div className={styles.subsection} key={card.label}><h3>{card.label}</h3>{card.groups.length ? <ul>{card.groups.map((group) => <li key={group.value}>{group.value}: {group.count}</li>)}</ul> : <p>ยังไม่มีข้อมูล</p>}</div>)}
      {block.prompts?.map((prompt) => <div className={styles.subsection} key={prompt.title}><h3>{prompt.title}</h3><p>สำเร็จ {percent(prompt.successPercent)} · ไปตรง {percent(prompt.directPercent)} · n={prompt.sampleSize || "ยังไม่มีข้อมูล"}</p></div>)}
    </section>)}
    <section className={styles.panel}><h2>Findings และการตัดสินใจ UX</h2>{findings.length ? <ol>{findings.map((finding) => <li key={finding.id}><h3>{finding.title} · {finding.severity}</h3><p><strong>ปัญหา:</strong> {finding.problem}</p><p><strong>การตีความ:</strong> {finding.researcherInterpretation || "ยังไม่ระบุ"}</p><p><strong>ข้อเสนอแนะ:</strong> {finding.recommendation || "ยังไม่ระบุ"}</p></li>)}</ol> : <p>ยังไม่มี Finding ที่ผู้วิจัยยืนยันจากหลักฐาน รายงานจะไม่สร้างข้อสรุปให้อัตโนมัติ</p>}</section>
    <section className={styles.panel}><h2>Retest</h2><p>ใส่รหัสเวอร์ชันก่อนหน้าของแบบทดสอบเดียวกัน ระบบจะเทียบเฉพาะกิจกรรมที่มีลำดับ วิธี และการตั้งค่าเหมือนกันทุกประการ</p>
      <form onSubmit={(event) => void compare(event)}><label>รหัสเวอร์ชันก่อนหน้า <input required value={baselineId} onChange={(event) => setBaselineId(event.target.value)} /></label><button type="submit">เปรียบเทียบ</button></form>
      {compareError ? <p role="alert">{compareError}</p> : null}
      {baseline ? <div><h3>เวอร์ชัน {baseline.versionNo} → {data.versionNo}</h3><ul>{data.blocks.map((block) => {
        const previous = baseline.blocks.find((item) => item.comparisonKey === block.comparisonKey);
        return <li key={block.blockId}><strong>{block.title}</strong>: {!previous ? "นิยามกิจกรรมต่างกัน — เปรียบเทียบไม่ได้" : block.sampleSize === 0 || previous.sampleSize === 0 ? "ยังไม่มีข้อมูลทั้งสองฝั่งสำหรับการเปรียบเทียบ" : <span>n={previous.sampleSize} → n={block.sampleSize}{block.kind === "tree_test" ? block.prompts?.map((prompt, index) => {
          const old = previous.prompts?.[index];
          return old ? <span key={prompt.title}> · {prompt.title}: สำเร็จ {percent(old.successPercent)} → {percent(prompt.successPercent)}</span> : null;
        }) : null}</span>}</li>;
      })}</ul><p>จำนวนตัวอย่างและอัตราสำเร็จเป็นคำอธิบายเชิงพรรณนา ยังไม่สรุปว่าสิ่งที่แก้ทำให้ผลดีขึ้นโดยอัตโนมัติ</p></div> : null}
    </section>
  </main>;
}

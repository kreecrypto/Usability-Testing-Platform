"use client";

import { authenticatedFetch, SESSION_MESSAGE } from "../../../../lib/auth/client.ts";

import { useEffect, useState } from "react";
import styles from "./results.module.css";

type Count = { value: string; count: number; evidenceIds: string[] };
type Block = { blockId: string; ordinal: number; kind: "survey" | "card_sort" | "tree_test"; title: string; sampleSize: number; availability: "Available" | "No Data";
  questions?: { id: string; prompt: string; sampleSize: number; counts: Count[]; textEvidence: { responseId: string; sessionId: string; value: string }[] }[];
  cards?: { cardId: string; label: string; groups: Count[] }[];
  similarity?: { leftCardId: string; rightCardId: string; together: number; sampleSize: number; percent: number | null; evidenceIds: string[] }[];
  prompts?: { id: string; title: string; sampleSize: number; successCount: number; directCount: number; successPercent: number | null; directPercent: number | null; paths: Count[] }[] };
type Model = { testVersionId: string; versionNo: number; title: string; description: string | null; blocks: Block[]; evidence: { id: string; sessionId: string; blockId: string; submittedAt: string }[] };

function percent(value: number | null): string { return value === null ? "ยังไม่มีข้อมูล" : `${Math.round(value * 10) / 10}%`; }
function evidenceLinks(ids: string[]): React.ReactNode { return ids.length ? <details><summary>หลักฐาน {ids.length} คำตอบ</summary><ul>{ids.map((id) => <li key={id}><code>{id}</code></li>)}</ul></details> : null; }

export default function MethodResultsClient({ testVersionId }: { testVersionId: string }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    authenticatedFetch(`/api/methods/results/${encodeURIComponent(testVersionId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { throw new Error(SESSION_MESSAGE); }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "results_unavailable");
        return body.results as Model;
      })
      .then((result) => { if (active && result) setModel(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "โหลดผลไม่สำเร็จ"); });
    return () => { active = false; };
  }, [testVersionId]);
  if (error) return <main className={styles.shell}><h1>เปิดผลการทดสอบไม่ได้</h1><p role="alert">{error}</p></main>;
  if (!model) return <main className={styles.shell}><p role="status">กำลังโหลดผลการทดสอบ…</p></main>;
  return <main className={styles.shell}>
    <header><p className={styles.kicker}>Results · เวอร์ชัน {model.versionNo}</p><h1>{model.title}</h1>{model.description ? <p>{model.description}</p> : null}<p><a href={`/methods/findings/${encodeURIComponent(testVersionId)}`}>สร้าง Findings →</a> · <a href={`/methods/reports/${encodeURIComponent(testVersionId)}`}>เปิด Report →</a></p></header>
    {model.blocks.map((block) => <section className={styles.panel} key={block.blockId}>
      <div className={styles.head}><div><span className={styles.kicker}>กิจกรรม {block.ordinal} · {block.kind}</span><h2>{block.title}</h2></div><span className={styles.badge}>{block.availability === "No Data" ? "ยังไม่มีข้อมูล" : `n=${block.sampleSize}`}</span></div>
      {block.availability === "No Data" ? <p>ยังไม่มีคำตอบที่ส่งสำเร็จในเวอร์ชันนี้ จึงไม่แสดงตัวเลข 0 แทนผลการทดสอบ</p> : null}
      {block.questions?.map((question) => <article className={styles.subsection} key={question.id}><h3>{question.prompt}</h3><p>ผู้ตอบคำถาม n={question.sampleSize || "ยังไม่มีข้อมูล"}</p>{question.counts.length ? <ul>{question.counts.map((count) => <li key={count.value}><strong>{count.value}</strong> · {count.count} คำตอบ {evidenceLinks(count.evidenceIds)}</li>)}</ul> : null}{question.textEvidence.length ? <ul>{question.textEvidence.map((item) => <li key={item.responseId}><blockquote>{item.value}</blockquote><small>session {item.sessionId.slice(0, 8)} · response {item.responseId.slice(0, 8)}</small></li>)}</ul> : null}</article>)}
      {block.cards?.map((card) => <article className={styles.subsection} key={card.cardId}><h3>{card.label}</h3>{card.groups.length ? <ul>{card.groups.map((group) => <li key={group.value}>{group.value} · {group.count} คำตอบ {evidenceLinks(group.evidenceIds)}</li>)}</ul> : <p>ยังไม่มีข้อมูล</p>}</article>)}
      {block.similarity?.length ? <details className={styles.subsection}><summary>ความคล้ายกันของการจัดกลุ่ม</summary><ul>{block.similarity.map((pair) => <li key={`${pair.leftCardId}:${pair.rightCardId}`}>{pair.leftCardId} + {pair.rightCardId}: {percent(pair.percent)} · {pair.together}/{pair.sampleSize} คำตอบ {evidenceLinks(pair.evidenceIds)}</li>)}</ul></details> : null}
      {block.prompts?.map((prompt) => <article className={styles.subsection} key={prompt.id}><h3>{prompt.title}</h3><div className={styles.metrics}><span>สำเร็จ <strong>{percent(prompt.successPercent)}</strong><small>{prompt.sampleSize ? `${prompt.successCount}/${prompt.sampleSize}` : "ไม่มีตัวอย่าง"}</small></span><span>ไปตรง <strong>{percent(prompt.directPercent)}</strong><small>{prompt.sampleSize ? `${prompt.directCount}/${prompt.sampleSize}` : "ไม่มีตัวอย่าง"}</small></span></div>{prompt.paths.length ? <details><summary>เส้นทางที่เลือก</summary><ul>{prompt.paths.map((path) => <li key={path.value}>{path.value} · {path.count} {evidenceLinks(path.evidenceIds)}</li>)}</ul></details> : null}</article>)}
    </section>)}
    <section className={styles.panel}><h2>หลักฐานระดับเซสชัน</h2>{model.evidence.length ? <ul>{model.evidence.map((item) => <li key={item.id}><code>{item.id}</code> · session {item.sessionId.slice(0, 8)} · block {item.blockId.slice(0, 8)}</li>)}</ul> : <p>ยังไม่มีหลักฐาน</p>}</section>
  </main>;
}

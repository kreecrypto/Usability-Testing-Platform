"use client";

import { useEffect, useState } from "react";
import type { RetestMetricComparison } from "../../../lib/findings/model.ts";
import styles from "./retest.module.css";

type Payload = { retest: { retestId: string; status: string; comparison: RetestMetricComparison } };

function value(input: number | null): string {
  return input === null ? "ยังไม่มีข้อมูล" : String(Math.round(input * 100) / 100);
}

function delta(input: number | null, suffix = ""): string {
  if (input === null) return "ใช้ไม่ได้กับข้อมูลชุดนี้";
  const rounded = Math.round(input * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}

export default function RetestPage({ params }: { params: Promise<{ retestId: string }> }) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: Payload["retest"] | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ retestId }) => {
      try {
        const response = await fetch(`/api/retests/${encodeURIComponent(retestId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "ต้องเข้าสู่ระบบก่อนดูผลการทดสอบซ้ำ" : "โหลดผลเปรียบเทียบการทดสอบซ้ำไม่สำเร็จ");
        const payload = await response.json() as Payload;
        if (!cancelled) setState({ loading: false, error: "", data: payload.retest });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "โหลดผลเปรียบเทียบการทดสอบซ้ำไม่สำเร็จ", data: null });
      }
    });
    return () => { cancelled = true; };
  }, [params]);

  return <main className={styles.page}>
    <header className={styles.header}><div><span>ทดสอบซ้ำ</span><h1>ก่อนปรับเทียบกับการทดสอบซ้ำ</h1><p>เปรียบเทียบผลโดยคงรหัสเวอร์ชัน จำนวนตัวอย่าง และจำนวนเซสชันที่ติดปัญหาทางเทคนิคไว้ให้ตรวจสอบได้ ระบบจะไม่สรุปนัยสำคัญทางสถิติจนกว่าจะมีวิธีที่กำหนดไว้ใน Requirement</p></div></header>
    {state.loading ? <div className={styles.state}>กำลังโหลดผลเปรียบเทียบ…</div> : null}
    {state.error ? <div className={styles.error} role="alert">{state.error}</div> : null}
    {state.data ? <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span>ตัวชี้วัด</span><h2>{state.data.comparison.metricKey}</h2></div><strong>{state.data.status}</strong></div>
      <div className={styles.compareGrid}>
        <article><span>ก่อนปรับ</span><strong>{value(state.data.comparison.baseline.value)}</strong><small>n={state.data.comparison.baseline.sampleSize} · ติดปัญหาทางเทคนิค={state.data.comparison.baseline.technicalBlockedCount}</small><code>{state.data.comparison.baseline.testVersionId}</code></article>
        <article><span>ทดสอบซ้ำ</span><strong>{value(state.data.comparison.retest.value)}</strong><small>n={state.data.comparison.retest.sampleSize} · ติดปัญหาทางเทคนิค={state.data.comparison.retest.technicalBlockedCount}</small><code>{state.data.comparison.retest.testVersionId}</code></article>
      </div>
      <div className={styles.deltaGrid}><div><span>ผลต่างแบบสัมบูรณ์</span><strong>{delta(state.data.comparison.absoluteDelta)}</strong></div><div><span>ผลต่างสัมพัทธ์</span><strong>{delta(state.data.comparison.relativeDeltaPercent, "%")}</strong></div><div><span>นัยสำคัญทางสถิติ</span><strong>ไม่ได้สรุป</strong></div></div>
      <p className={styles.note}>ผลต่างสัมพัทธ์จะแสดงเมื่อทั้งสองฝั่งมีข้อมูลและค่าก่อนปรับไม่เป็นศูนย์ ระบบไม่ติดป้ายว่า “ดีขึ้น” หรือ “แย่ลง” เพราะไม่ได้อนุมานว่าทิศทางใดดีกว่าสำหรับตัวชี้วัดแต่ละชนิด</p>
    </section> : null}
  </main>;
}

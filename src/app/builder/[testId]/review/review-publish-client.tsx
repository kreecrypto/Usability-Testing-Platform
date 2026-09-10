"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./review-publish.module.css";

type Task = { id: string; ordinal: number; title: string; scenario: string | null; instruction: string | null; timeoutSeconds: number | null; successRule: Record<string, unknown>; failureRule: Record<string, unknown>; postTaskQuestions: Record<string, unknown> };
type FunnelConfig = { version: "screen-funnel-v1"; screenIds: string[] };
type Preview = { testId: string; testVersionId: string; versionNo: number; lifecycleStatus: "draft" | "published"; sourceUrl: string; embedUrl: string; fileKey: string; startNodeId: string; funnelConfig: FunnelConfig | null; tasks: Task[] };
type State = "loading" | "ready" | "working" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

function enabledQuestionLabels(config: Record<string, unknown>): string[] {
  const labels: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (Reflect.get(value, "enabled") === true) labels.push(key === "open_feedback" ? "ความคิดเห็นเพิ่มเติม" : "SEQ");
  }
  return labels;
}
function ruleCount(rule: Record<string, unknown>): number { const targets = Reflect.get(rule, "targetNodeIds"); return Array.isArray(targets) ? targets.length : Object.keys(rule).length > 0 ? 1 : 0; }
function parseFunnelText(value: string): string[] { return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean); }

export default function ReviewPublishClient({ testId }: { testId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [funnelText, setFunnelText] = useState("");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  const applyPreview = useCallback((value: Preview) => { setPreview(value); setFunnelText(value.funnelConfig?.screenIds.join("\n") ?? ""); }, []);
  const load = useCallback(async () => {
    setState("loading"); setError("");
    try { const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`); applyPreview(result.preview); setState("ready"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดพรีวิวไม่สำเร็จ"); setState("error"); }
  }, [applyPreview, testId]);
  useEffect(() => { void load(); }, [load]);

  async function act(action: "publish" | "create_draft") {
    if (state === "working") return;
    setState("working"); setError("");
    try { const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`, { method: "POST", body: JSON.stringify({ action }) }); applyPreview(result.preview); setState("ready"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ"); setState("error"); }
  }

  async function saveFunnel() {
    if (state === "working" || preview?.lifecycleStatus !== "draft") return;
    const screenIds = parseFunnelText(funnelText);
    if (screenIds.length < 2) { setError("Funnel ต้องมี Screen ID อย่างน้อย 2 จุด"); return; }
    setState("working"); setError("");
    try { const result = await api<{ preview: Preview }>(`/api/tests/${encodeURIComponent(testId)}/publish`, { method: "POST", body: JSON.stringify({ action: "save_funnel", screenIds }) }); applyPreview(result.preview); setState("ready"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึก Funnel ไม่สำเร็จ"); setState("error"); }
  }

  if (state === "loading" && !preview) return <main className={styles.shell}><p>กำลังเตรียมพรีวิว…</p></main>;
  if (!preview) return <main className={styles.shell}><h1>ตรวจสอบก่อนเผยแพร่</h1><p role="alert">{error || "ยังเปิดพรีวิวไม่ได้"}</p><button onClick={() => void load()}>ลองอีกครั้ง</button></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>สร้างการทดสอบ · ตรวจสอบก่อนเผยแพร่</p><h1>เวอร์ชัน {preview.versionNo}</h1><p className={styles.status} data-status={preview.lifecycleStatus}>{preview.lifecycleStatus === "draft" ? "ฉบับร่าง" : "เผยแพร่แล้ว"}</p></div>
        {preview.lifecycleStatus === "draft"
          ? <button className={styles.primary} disabled={state === "working"} onClick={() => void act("publish")}>เผยแพร่เวอร์ชันนี้</button>
          : <button className={styles.primary} disabled={state === "working"} onClick={() => void act("create_draft")}>สร้างฉบับร่างใหม่</button>}
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.card} aria-labelledby="prototype-heading">
        <h2 id="prototype-heading">ต้นแบบที่จะเผยแพร่</h2>
        <dl className={styles.definition}>
          <div><dt>ต้นแบบสาธารณะ</dt><dd><a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.sourceUrl}</a></dd></div>
          <div><dt>Node เริ่มต้น</dt><dd><code>{preview.startNodeId}</code></dd></div>
          <div><dt>รหัสเวอร์ชันภายใน</dt><dd><code>{preview.testVersionId}</code></dd></div>
        </dl>
        <p className={styles.note}>เมื่อเผยแพร่ ระบบจะล็อก snapshot และงานของเวอร์ชันนี้ เพื่อให้ผลการทดสอบอ้างอิงการตั้งค่าชุดเดิมได้</p>
      </section>

      <section className={styles.card} aria-labelledby="funnel-heading">
        <h2 id="funnel-heading">Funnel ของผลการทดสอบ</h2>
        <p className={styles.note}>กำหนด Screen ID ตามลำดับที่ต้องการวัด conversion และ drop-off ค่านี้จะถูกเก็บกับเวอร์ชันที่เผยแพร่ และไม่เดาจากเส้นทางจริงของผู้เข้าร่วม</p>
        {preview.lifecycleStatus === "draft" ? (
          <div className={styles.funnelEditor}>
            <label htmlFor="funnel-screen-ids">Screen ID ตามลำดับ — 1 บรรทัดต่อ 1 จุด หรือคั่นด้วยจุลภาค</label>
            <textarea id="funnel-screen-ids" rows={5} value={funnelText} onChange={(event) => setFunnelText(event.target.value)} disabled={state === "working"} placeholder={"screen-A\nscreen-B\nscreen-C"} />
            <button className={styles.secondary} type="button" disabled={state === "working"} onClick={() => void saveFunnel()}>บันทึก Funnel</button>
          </div>
        ) : preview.funnelConfig ? (
          <ol className={styles.funnelSteps}>{preview.funnelConfig.screenIds.map((screenId) => <li key={screenId}><code>{screenId}</code></li>)}</ol>
        ) : <p>เวอร์ชันนี้ยังไม่มี Funnel จึงยังไม่มีข้อมูล Funnel ให้แสดง</p>}
      </section>

      <section aria-labelledby="task-heading">
        <div className={styles.sectionTitle}><h2 id="task-heading">งานทดสอบ</h2><span>{preview.tasks.length}</span></div>
        <div className={styles.tasks}>
          {preview.tasks.map((task) => {
            const questions = enabledQuestionLabels(task.postTaskQuestions);
            return <article className={styles.task} key={task.id}><div className={styles.ordinal}>{task.ordinal}</div><div><h3>{task.title}</h3>{task.scenario ? <p>{task.scenario}</p> : null}{task.instruction ? <p className={styles.instruction}>{task.instruction}</p> : null}<ul className={styles.meta}><li>เกณฑ์สำเร็จ: {ruleCount(task.successRule)}</li><li>เกณฑ์ไม่สำเร็จ: {ruleCount(task.failureRule)}</li><li>เวลาสูงสุด: {task.timeoutSeconds ? `${task.timeoutSeconds} วินาที` : "ไม่ได้กำหนด"}</li><li>คำถามหลังงาน: {questions.length ? questions.join(", ") : "ไม่มี"}</li></ul></div></article>;
          })}
        </div>
      </section>
    </main>
  );
}

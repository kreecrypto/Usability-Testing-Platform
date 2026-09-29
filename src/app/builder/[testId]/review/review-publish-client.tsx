"use client";

import { authenticatedFetch, SESSION_MESSAGE } from "../../../../lib/auth/client.ts";

import { useCallback, useEffect, useState } from "react";
import styles from "./review-publish.module.css";

type Task = { id: string; ordinal: number; title: string; scenario: string | null; instruction: string | null; timeoutSeconds: number | null; successRule: Record<string, unknown>; failureRule: Record<string, unknown>; postTaskQuestions: Record<string, unknown> };
type FunnelConfig = { version: "screen-funnel-v1"; screenIds: string[] };
type Preview = { testId: string; testVersionId: string; versionNo: number; lifecycleStatus: "draft" | "published"; studyMode: "usability" | "methods" | "mixed"; target: { provider: "figma_prototype" | "first_party_web" | "external_web"; sourceUrl: string; environment: "uat" | "production" | "external" | null; providerConfig: Record<string, unknown> } | null; funnelConfig: FunnelConfig | null; tasks: Task[]; blocks: { id: string; ordinal: number; kind: string; title: string }[] };
type State = "loading" | "ready" | "working" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) { throw new Error(SESSION_MESSAGE); }
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
  const [copyMessage, setCopyMessage] = useState("");

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

  async function copyParticipantLink() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${preview.studyMode === "methods" ? "m" : "t"}/${encodeURIComponent(preview.testVersionId)}`);
      setCopyMessage("คัดลอกลิงก์ผู้เข้าร่วมแล้ว");
    } catch { setCopyMessage("คัดลอกไม่สำเร็จ โปรดเปิดลิงก์แล้วคัดลอกจากแถบที่อยู่"); }
  }

  if (state === "loading" && !preview) return <main className={styles.shell}><p>กำลังเตรียมพรีวิว…</p></main>;
  if (!preview) return <main className={styles.shell}><h1>ตรวจสอบก่อนเผยแพร่</h1><p role="alert">{error === "target_preflight_required" ? "เป้าหมายทดสอบยังไม่ผ่านการตรวจความพร้อมก่อนเผยแพร่" : error || "ยังเปิดพรีวิวไม่ได้"}</p><button onClick={() => void load()}>ลองอีกครั้ง</button><p><a href={`/builder/${encodeURIComponent(testId)}/prototype`}>กลับไปตรวจเป้าหมายทดสอบ</a></p></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>สร้างการทดสอบ · ตรวจสอบก่อนเผยแพร่</p><h1>เวอร์ชัน {preview.versionNo}</h1><p className={styles.status} data-status={preview.lifecycleStatus}>{preview.lifecycleStatus === "draft" ? "ฉบับร่าง" : "เผยแพร่แล้ว"}</p></div>
        {preview.lifecycleStatus === "draft"
          ? <button className={styles.primary} disabled={state === "working"} onClick={() => void act("publish")}>เผยแพร่เวอร์ชันนี้</button>
          : <button className={styles.primary} disabled={state === "working"} onClick={() => void act("create_draft")}>สร้างฉบับร่างใหม่</button>}
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {preview.lifecycleStatus === "published" ? <section className={styles.card} aria-labelledby="share-heading">
        <h2 id="share-heading">ส่งลิงก์ให้ผู้เข้าร่วม</h2>
        <p><a href={`/${preview.studyMode === "methods" ? "m" : "t"}/${encodeURIComponent(preview.testVersionId)}`} target="_blank" rel="noreferrer">เปิดลิงก์ User Test เวอร์ชัน {preview.versionNo}</a></p>
        <button className={styles.secondary} type="button" onClick={() => void copyParticipantLink()}>คัดลอกลิงก์ผู้เข้าร่วม</button>
        {copyMessage ? <p role="status">{copyMessage}</p> : null}
        <p><a href={`/${preview.studyMode === "methods" ? "methods/results" : "results"}/${encodeURIComponent(preview.testVersionId)}`}>ดู Results</a> · <a href={`/${preview.studyMode === "methods" ? "methods/reports" : "reports"}/${encodeURIComponent(preview.testVersionId)}`}>ดู Report</a></p>
      </section> : null}

      {preview.target ? <section className={styles.card} aria-labelledby="prototype-heading">
        <h2 id="prototype-heading">เป้าหมายทดสอบ</h2>
        <dl className={styles.definition}>
          <div><dt>ประเภท</dt><dd>{preview.target.provider === "figma_prototype" ? "Figma Prototype" : preview.target.provider === "first_party_web" ? "เว็บไซต์ของทีม" : "เว็บไซต์ภายนอก"}</dd></div>
          <div><dt>URL</dt><dd><a href={preview.target.sourceUrl} target="_blank" rel="noreferrer">{preview.target.sourceUrl}</a></dd></div>
          {typeof preview.target.providerConfig.startNodeId === "string" ? <div><dt>Node เริ่มต้น</dt><dd><code>{preview.target.providerConfig.startNodeId}</code></dd></div> : null}
          <div><dt>รหัสเวอร์ชันภายใน</dt><dd><code>{preview.testVersionId}</code></dd></div>
        </dl>
        <p className={styles.note}>เมื่อเผยแพร่ ระบบจะล็อก snapshot และงานของเวอร์ชันนี้ เพื่อให้ผลการทดสอบอ้างอิงการตั้งค่าชุดเดิมได้</p>
      </section> : <section className={styles.card}><h2>วิธีวิจัย</h2><p>เวอร์ชันนี้ไม่ต้องใช้ Prototype หรือเว็บไซต์เป็นเป้าหมาย</p><p><a href={`/builder/${encodeURIComponent(testId)}/methods`}>จัดการ Survey / Card Sort / Tree Test</a></p></section>}

      {preview.target ? <section className={styles.card} aria-labelledby="funnel-heading">
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
      </section> : null}

      {preview.blocks?.length ? <section className={styles.card}><h2>กิจกรรมวิจัย ({preview.blocks.length})</h2><ol>{preview.blocks.map((block) => <li key={block.id}>{block.title} — {block.kind}</li>)}</ol></section> : null}

      {preview.tasks.length ? <section aria-labelledby="task-heading">
        <div className={styles.sectionTitle}><h2 id="task-heading">งานทดสอบ</h2><span>{preview.tasks.length}</span></div>
        <div className={styles.tasks}>
          {preview.tasks.map((task) => {
            const questions = enabledQuestionLabels(task.postTaskQuestions);
            return <article className={styles.task} key={task.id}><div className={styles.ordinal}>{task.ordinal}</div><div><h3>{task.title}</h3>{task.scenario ? <p>{task.scenario}</p> : null}{task.instruction ? <p className={styles.instruction}>{task.instruction}</p> : null}<ul className={styles.meta}><li>เกณฑ์สำเร็จ: {ruleCount(task.successRule)}</li><li>เกณฑ์ไม่สำเร็จ: {ruleCount(task.failureRule)}</li><li>เวลาสูงสุด: {task.timeoutSeconds ? `${task.timeoutSeconds} วินาที` : "ไม่ได้กำหนด"}</li><li>คำถามหลังงาน: {questions.length ? questions.join(", ") : "ไม่มี"}</li></ul></div></article>;
          })}
        </div>
      </section> : null}
    </main>
  );
}

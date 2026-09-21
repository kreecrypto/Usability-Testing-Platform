"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./prototype-import.module.css";

type CapabilityState = "Available" | "Partial" | "Unsupported" | "No Data";
type Target = Readonly<{
  provider: "figma_prototype" | "first_party_web" | "external_web";
  sourceUrl: string;
  environment: "uat" | "production" | null;
  launchMode: "embed" | "new_tab" | "same_tab" | "unsupported";
  capabilities: Readonly<{ access: CapabilityState; embed: CapabilityState; instrumentation: CapabilityState; screen: CapabilityState; path: CapabilityState; pointer: CapabilityState; scroll: CapabilityState; coordinates: CapabilityState; publishBlocked: boolean; reasons: readonly string[] }>;
  providerConfig: Readonly<Record<string, unknown>>;
  snapshotVersion: 1;
}>;
type Draft = Readonly<{ id: string; workspaceId: string; testId: string; versionNo: number; target: Target }>;
type RequestState = "idle" | "validating" | "valid" | "saving" | "saved" | "error";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

export default function PrototypeImportClient({ testId }: { testId: string }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [ownership, setOwnership] = useState<"external" | "owned">("external");
  const [environment, setEnvironment] = useState<"uat" | "production">("uat");
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jsonRequest<{ draft: Draft | null }>(`/api/tests/${encodeURIComponent(testId)}/prototype`).then(({ draft: loaded }) => {
      if (!active || !loaded) return;
      setDraft(loaded); setTarget(loaded.target); setTargetUrl(loaded.target.sourceUrl); setState("saved");
      setMessage(`โหลด Test Target ของฉบับร่าง v${loaded.versionNo} แล้ว`);
    }).catch((error) => { if (!active || String(error).includes("authentication_required")) return; setState("error"); setMessage("โหลด Test Target ของฉบับร่างไม่สำเร็จ"); });
    return () => { active = false; };
  }, [testId]);

  const requestBody = () => ({ targetUrl, ownership, ...(ownership === "owned" ? { environment } : {}) });

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("validating"); setMessage(null); setTarget(null);
    try {
      const result = await jsonRequest<{ target: Target }>("/api/test-target/preflight", { method: "POST", body: JSON.stringify(requestBody()) });
      setTarget(result.target); setState("valid");
      setMessage(result.target.capabilities.publishBlocked ? "ตรวจสอบเบื้องต้นแล้ว แต่ยังมี capability ที่ต้องยืนยันก่อน Publish" : "Test Target ผ่าน preflight เบื้องต้นและพร้อมบันทึกลงฉบับร่าง");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "URL หรือการตั้งค่า Test Target ไม่ถูกต้อง"); }
  }

  async function save() {
    if (!target) return; setState("saving"); setMessage(null);
    try {
      const result = await jsonRequest<{ draft: Draft }>(`/api/tests/${encodeURIComponent(testId)}/prototype`, { method: "PUT", body: JSON.stringify(requestBody()) });
      setDraft(result.draft); setTarget(result.draft.target); setTargetUrl(result.draft.target.sourceUrl); setState("saved"); setMessage(`บันทึก Test Target ลงฉบับร่างเวอร์ชัน ${result.draft.versionNo} แล้ว`);
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "บันทึก Test Target ไม่สำเร็จ"); }
  }

  const busy = state === "validating" || state === "saving";
  const providerLabel = target?.provider === "figma_prototype" ? "Figma Prototype" : target?.provider === "first_party_web" ? "Owned Website" : target ? "External Website" : "—";
  const embedUrl = target?.provider === "figma_prototype" ? String(target.providerConfig.embedUrl ?? "") : "";

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/projects" className={styles.backLink}>← โปรเจกต์</a><p className={styles.eyebrow}>สร้างการทดสอบ · Test Target</p><h1>เชื่อมต่อ Test Target</h1><p>รองรับ Figma Prototype, เว็บไซต์ UAT/Production ที่ทีมควบคุม และเว็บไซต์ภายนอกที่รองรับ โดย capability ที่ตรวจไม่ได้จะถูกแสดงเป็น Partial/Unsupported แทนการสร้าง evidence ขึ้นเอง</p></header>
    <section className={styles.card} aria-labelledby="import-title"><h2 id="import-title">1. เพิ่ม URL เป้าหมาย</h2><form onSubmit={validate} className={styles.form}>
      <label><span>Test Target URL</span><textarea value={targetUrl} onChange={(event) => { setTargetUrl(event.target.value); setTarget(null); setState("idle"); setMessage(null); }} rows={3} placeholder="https://…" required disabled={busy} /></label>
      <label><span>ความเป็นเจ้าของเว็บไซต์</span><select value={ownership} onChange={(event) => { setOwnership(event.target.value as "external" | "owned"); setTarget(null); }} disabled={busy}><option value="external">เว็บไซต์ภายนอก / ไม่ได้ควบคุม</option><option value="owned">เว็บไซต์ที่ทีมควบคุม</option></select></label>
      {ownership === "owned" ? <label><span>Environment</span><select value={environment} onChange={(event) => setEnvironment(event.target.value as "uat" | "production")} disabled={busy}><option value="uat">UAT</option><option value="production">Production</option></select></label> : null}
      <button type="submit" disabled={busy || targetUrl.trim() === ""}>{state === "validating" ? "กำลังตรวจสอบ…" : "ตรวจสอบ Test Target"}</button>
    </form>{message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}</section>
    <section className={styles.card} aria-labelledby="preview-title"><div className={styles.sectionHeading}><div><h2 id="preview-title">2. Preflight & Preview</h2><p>ตรวจ provider, launch mode และ capability ก่อน Publish</p></div><span className={styles.status}>{target ? "ตรวจแล้ว" : "ยังไม่พร้อม"}</span></div>
      {target ? <><dl className={styles.meta}><div><dt>Provider</dt><dd>{providerLabel}</dd></div><div><dt>Environment</dt><dd>{target.environment ?? "N/A"}</dd></div><div><dt>Launch</dt><dd>{target.launchMode}</dd></div><div><dt>Publish gate</dt><dd>{target.capabilities.publishBlocked ? "ต้องยืนยันเพิ่ม" : "ไม่ถูก block จาก preflight นี้"}</dd></div></dl>
      <dl className={styles.meta}>{(["access","embed","instrumentation","screen","path","pointer","scroll","coordinates"] as const).map((key) => <div key={key}><dt>{key}</dt><dd>{target.capabilities[key]}</dd></div>)}</dl>
      {target.capabilities.reasons.length ? <div className={styles.notice} role="status">{target.capabilities.reasons.join(" ")}</div> : null}
      {embedUrl ? <div className={styles.previewFrame}><iframe title="พรีวิว Test Target" src={embedUrl} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div> : <div className={styles.empty}>Target นี้ใช้ {target.launchMode}; ไม่มีการอ้างว่าอ่าน DOM/click/path ข้าม origin ได้</div>}</> : <div className={styles.empty}>ตรวจสอบ URL เพื่อดู provider และ capability</div>}
    </section>
    <section className={styles.card} aria-labelledby="save-title"><div className={styles.sectionHeading}><div><h2 id="save-title">3. บันทึกลงฉบับร่าง</h2><p>บันทึก provider-neutral target snapshot; Publish จะตรวจ capability gate อีกครั้ง</p></div>{draft ? <span className={styles.status}>ฉบับร่าง v{draft.versionNo}</span> : null}</div><button className={styles.primaryButton} type="button" onClick={save} disabled={!target || busy}>{state === "saving" ? "กำลังบันทึก…" : "บันทึก Test Target"}</button></section>
  </main>;
}

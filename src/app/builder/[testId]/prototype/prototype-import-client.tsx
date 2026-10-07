"use client";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      setMessage(`โหลดสิ่งที่จะทดสอบในฉบับร่าง v${loaded.versionNo} แล้ว`);
    }).catch((error) => { if (!active || String(error).includes("authentication_required")) return; setState("error"); setMessage("โหลดสิ่งที่จะทดสอบในฉบับร่างไม่สำเร็จ ลองโหลดหน้าใหม่อีกครั้ง"); });
    return () => { active = false; };
  }, [testId]);

  const requestBody = () => ({ targetUrl, ownership, ...(ownership === "owned" ? { environment } : {}) });

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("validating"); setMessage(null); setTarget(null);
    try {
      const result = await jsonRequest<{ target: Target }>("/api/test-target/preflight", { method: "POST", body: JSON.stringify(requestBody()) });
      setTarget(result.target); setState("valid");
      setMessage(result.target.capabilities.publishBlocked ? "ตรวจสอบแล้ว แต่ยังต้องยืนยันข้อมูลบางอย่างก่อนเผยแพร่" : "ตรวจสอบลิงก์แล้ว บันทึกลงฉบับร่างได้");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "ตรวจลิงก์และการตั้งค่าสิ่งที่จะทดสอบอีกครั้ง"); }
  }

  async function save() {
    if (!target) return; setState("saving"); setMessage(null);
    try {
      const result = await jsonRequest<{ draft: Draft }>(`/api/tests/${encodeURIComponent(testId)}/prototype`, { method: "PUT", body: JSON.stringify(requestBody()) });
      setDraft(result.draft); setTarget(result.draft.target); setTargetUrl(result.draft.target.sourceUrl); setState("saved"); setMessage(`บันทึกสิ่งที่จะทดสอบลงฉบับร่างเวอร์ชัน ${result.draft.versionNo} แล้ว`);
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "บันทึกสิ่งที่จะทดสอบไม่สำเร็จ ลองอีกครั้ง"); }
  }

  const busy = state === "validating" || state === "saving";
  const providerLabel = target?.provider === "figma_prototype" ? "ต้นแบบ Figma" : target?.provider === "first_party_web" ? "เว็บไซต์ของทีม" : target ? "เว็บไซต์ภายนอก" : "—";
  const embedUrl = target?.provider === "figma_prototype" ? String(target.providerConfig.embedUrl ?? "") : "";

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/projects" className={styles.backLink}>← โปรเจกต์</a><p className={styles.eyebrow}>ตั้งค่าแบบทดสอบ · สิ่งที่จะทดสอบ</p><h1>ระบุสิ่งที่จะทดสอบ</h1><p>วางลิงก์ต้นแบบหรือเว็บไซต์ที่ผู้เข้าร่วมจะใช้งาน ระบบจะตรวจว่าบันทึกพฤติกรรมประเภทใดได้ก่อนเผยแพร่</p></header>
    <Card asChild appearance="legacy" ><section className={styles.card} aria-labelledby="import-title"><h2 id="import-title">1. เพิ่มลิงก์</h2><form onSubmit={validate} className={styles.form}>
      <label><span>ลิงก์ต้นแบบหรือเว็บไซต์</span><textarea value={targetUrl} onChange={(event) => { setTargetUrl(event.target.value); setTarget(null); setState("idle"); setMessage(null); }} rows={3} placeholder="https://…" required disabled={busy} /></label>
      <label><span>ความเป็นเจ้าของเว็บไซต์</span><select value={ownership} onChange={(event) => { setOwnership(event.target.value as "external" | "owned"); setTarget(null); }} disabled={busy}><option value="external">เว็บไซต์ภายนอก / ไม่ได้ควบคุม</option><option value="owned">เว็บไซต์ที่ทีมควบคุม</option></select></label>
      {ownership === "owned" ? <label><span>สภาพแวดล้อมของเว็บไซต์</span><select value={environment} onChange={(event) => setEnvironment(event.target.value as "uat" | "production")} disabled={busy}><option value="uat">UAT</option><option value="production">Production</option></select></label> : null}
      <Button variant="legacy" type="submit" disabled={busy || targetUrl.trim() === ""}>{state === "validating" ? "กำลังตรวจสอบ…" : "ตรวจสอบลิงก์"}</Button>
    </form>{message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}</section></Card>
    <Card asChild appearance="legacy" ><section className={styles.card} aria-labelledby="preview-title"><div className={styles.sectionHeading}><div><h2 id="preview-title">2. ตรวจความพร้อม</h2><p>ดูวิธีเปิดลิงก์และข้อมูลพฤติกรรมที่เก็บได้ก่อนเผยแพร่</p></div><span className={styles.status}>{target ? "ตรวจแล้ว" : "ยังไม่พร้อม"}</span></div>
      {target ? <><dl className={styles.meta}><div><dt>ประเภท</dt><dd>{providerLabel}</dd></div><div><dt>สภาพแวดล้อม</dt><dd>{target.environment ?? "ไม่ระบุ"}</dd></div><div><dt>วิธีเปิด</dt><dd>{target.launchMode}</dd></div><div><dt>การเผยแพร่</dt><dd>{target.capabilities.publishBlocked ? "ต้องยืนยันเพิ่ม" : "ผ่านการตรวจขั้นนี้"}</dd></div></dl>
      <dl className={styles.meta}>{(["access","embed","instrumentation","screen","path","pointer","scroll","coordinates"] as const).map((key) => <div key={key}><dt>{key}</dt><dd>{target.capabilities[key]}</dd></div>)}</dl>
      {target.capabilities.reasons.length ? <div className={styles.notice} role="status">{target.capabilities.reasons.join(" ")}</div> : null}
      {embedUrl ? <div className={styles.previewFrame}><iframe title="ตัวอย่างสิ่งที่จะทดสอบ" src={embedUrl} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div> : <div className={styles.empty}>ลิงก์นี้เปิดแบบ {target.launchMode} ระบบอาจอ่านการคลิกและเส้นทางบนเว็บไซต์ภายนอกไม่ได้</div>}</> : <div className={styles.empty}>ตรวจสอบลิงก์เพื่อดูว่ารองรับข้อมูลพฤติกรรมใดบ้าง</div>}
    </section></Card>
    <Card asChild appearance="legacy" ><section className={styles.card} aria-labelledby="save-title"><div className={styles.sectionHeading}><div><h2 id="save-title">3. บันทึกลงฉบับร่าง</h2><p>ระบบจะตรวจความพร้อมอีกครั้งเมื่อเผยแพร่เวอร์ชันนี้</p></div>{draft ? <span className={styles.status}>ฉบับร่าง v{draft.versionNo}</span> : null}</div><Button variant="legacy" className={styles.primaryButton} type="button" onClick={save} disabled={!target || busy}>{state === "saving" ? "กำลังบันทึก…" : "บันทึกสิ่งที่จะทดสอบ"}</Button></section></Card>
  </main>;
}

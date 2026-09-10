"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./prototype-import.module.css";

type PrototypeConfig = Readonly<{
  schemaVersion: 1;
  provider: "figma";
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  nodeId?: string;
  startingPointNodeId?: string;
}>;

type Draft = Readonly<{
  id: string;
  workspaceId: string;
  testId: string;
  versionNo: number;
  prototype: PrototypeConfig;
}>;

type RequestState = "idle" | "validating" | "valid" | "saving" | "saved" | "error";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

export default function PrototypeImportClient({ testId }: { testId: string }) {
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [prototype, setPrototype] = useState<PrototypeConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jsonRequest<{ draft: Draft | null }>(`/api/tests/${encodeURIComponent(testId)}/prototype`)
      .then(({ draft: loaded }) => {
        if (!active || !loaded) return;
        setDraft(loaded);
        setPrototype(loaded.prototype);
        setPrototypeUrl(loaded.prototype.sourceUrl);
        setState("saved");
        setMessage(`โหลดการตั้งค่าต้นแบบของฉบับร่าง v${loaded.versionNo} แล้ว`);
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage("โหลดการตั้งค่าต้นแบบของฉบับร่างไม่สำเร็จ");
      });
    return () => { active = false; };
  }, [testId]);

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("validating");
    setMessage(null);
    setPrototype(null);
    try {
      const result = await jsonRequest<{ prototype: PrototypeConfig }>("/api/figma/public-prototype/validate", {
        method: "POST",
        body: JSON.stringify({ prototypeUrl }),
      });
      setPrototype(result.prototype);
      setState("valid");
      setMessage("ลิงก์ต้นแบบใช้ได้ ตรวจสอบพรีวิวแล้วบันทึกลงฉบับร่างของการทดสอบนี้");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "กรอก URL ต้นแบบ Figma แบบสาธารณะที่ถูกต้อง");
    }
  }

  async function save() {
    if (!prototype) return;
    setState("saving");
    setMessage(null);
    try {
      const result = await jsonRequest<{ draft: Draft }>(`/api/tests/${encodeURIComponent(testId)}/prototype`, {
        method: "PUT",
        body: JSON.stringify({ prototypeUrl: prototype.sourceUrl }),
      });
      setDraft(result.draft);
      setPrototype(result.draft.prototype);
      setPrototypeUrl(result.draft.prototype.sourceUrl);
      setState("saved");
      setMessage(`บันทึกลงฉบับร่างเวอร์ชัน ${result.draft.versionNo} แล้ว`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "บันทึกการตั้งค่าต้นแบบไม่สำเร็จ");
    }
  }

  const busy = state === "validating" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href="/projects" className={styles.backLink}>← โปรเจกต์</a>
        <p className={styles.eyebrow}>สร้างการทดสอบ · ต้นแบบ</p>
        <h1>เชื่อมต่อต้นแบบ Figma</h1>
        <p>วางลิงก์ <code>figma.com/proto/…</code> ที่ผู้เข้าร่วมเปิดได้ ระบบจะตรวจสอบและพรีวิวลิงก์สาธารณะโดยไม่ต้องเชื่อม Researcher OAuth</p>
      </header>

      <section className={styles.card} aria-labelledby="import-title">
        <h2 id="import-title">1. เพิ่มลิงก์ต้นแบบ</h2>
        <form onSubmit={validate} className={styles.form}>
          <label>
            <span>URL ต้นแบบ Figma</span>
            <textarea
              value={prototypeUrl}
              onChange={(event) => {
                setPrototypeUrl(event.target.value);
                setPrototype(null);
                setState("idle");
                setMessage(null);
              }}
              rows={3}
              placeholder="https://www.figma.com/proto/FILE_KEY/Prototype?node-id=1-2"
              required
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={busy || prototypeUrl.trim() === ""}>{state === "validating" ? "กำลังตรวจสอบ…" : "ตรวจสอบต้นแบบ"}</button>
        </form>
        {message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}
      </section>

      <section className={styles.card} aria-labelledby="preview-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="preview-title">2. พรีวิว</h2><p>พรีวิวจะแสดงเมื่อ URL ผ่านการตรวจสอบเดียวกับที่ใช้ตอนบันทึก</p></div>
          <span className={styles.status}>{prototype ? "พร้อม" : "ยังไม่พร้อม"}</span>
        </div>
        {prototype ? (
          <>
            <dl className={styles.meta}>
              <div><dt>File key</dt><dd>{prototype.fileKey}</dd></div>
              <div><dt>Node</dt><dd>{prototype.nodeId ?? "ค่าเริ่มต้นของ Figma"}</dd></div>
              <div><dt>จุดเริ่มต้น</dt><dd>{prototype.startingPointNodeId ?? "ค่าเริ่มต้นของ Figma"}</dd></div>
            </dl>
            <div className={styles.previewFrame}><iframe title="พรีวิวต้นแบบ Figma" src={prototype.embedUrl} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
          </>
        ) : <div className={styles.empty}>ตรวจสอบ URL ต้นแบบ Figma เพื่อแสดงพรีวิว</div>}
      </section>

      <section className={styles.card} aria-labelledby="save-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="save-title">3. บันทึกลงฉบับร่าง</h2><p>ขั้นตอนนี้บันทึกเฉพาะการตั้งค่าต้นแบบ การเผยแพร่และการล็อกเวอร์ชันจะทำในขั้นตอนตรวจสอบก่อนเผยแพร่</p></div>
          {draft ? <span className={styles.status}>ฉบับร่าง v{draft.versionNo}</span> : null}
        </div>
        <button className={styles.primaryButton} type="button" onClick={save} disabled={!prototype || busy}>{state === "saving" ? "กำลังบันทึก…" : "บันทึกต้นแบบ"}</button>
      </section>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function LoginPage() {
  const [working, setWorking] = useState(true);
  const [message, setMessage] = useState("กำลังเปิด Researcher Workspace…");

  const enterWorkspace = useCallback(async () => {
    if (working === false) setWorking(true);
    setMessage("กำลังเปิด Researcher Workspace…");
    try {
      const current = await fetch("/api/auth/session", { cache: "no-store" });
      if (current.ok) {
        window.location.replace("/projects");
        return;
      }

      const response = await fetch("/api/auth/guest", {
        method: "POST",
        cache: "no-store",
      });
      const body = await readJson(response);
      if (!response.ok) {
        const code = typeof body.error === "string" ? body.error : "request_failed";
        setMessage(code === "anonymous_auth_unavailable"
          ? "Temporary Researcher Session ยังไม่พร้อมในระบบ Auth"
          : "เปิด Researcher Workspace ไม่สำเร็จ โปรดลองอีกครั้ง");
        return;
      }
      window.location.replace("/projects");
    } catch {
      setMessage("เชื่อมต่อ Researcher Workspace ไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  }, [working]);

  useEffect(() => {
    void enterWorkspace();
    // Run once on entry; retry remains explicit below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(460px, 100%)", background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: "var(--ah-radius-lg)", padding: 28, boxShadow: "var(--ah-shadow-card)" }}>
        <p className="eyebrow">UT Platform</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Researcher Workspace</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ah-slate)" }}>
          V1 ข้ามขั้นสร้างบัญชี ระบบจะใช้ Temporary Researcher Session เพื่อเริ่มสร้าง Study ได้ทันที
        </p>

        <p role="status" style={{ margin: "0 0 16px" }}>{message}</p>
        <button
          className="primaryButton"
          type="button"
          disabled={working}
          onClick={() => void enterWorkspace()}
          style={{ width: "100%" }}
        >
          {working ? "กำลังเปิด Workspace…" : "เข้า Researcher Workspace"}
        </button>

        <p style={{ margin: "14px 0 0", color: "var(--ah-slate)", fontSize: 13 }}>
          Session นี้เป็นแบบชั่วคราวบนอุปกรณ์ปัจจุบัน ยังไม่มีอีเมล รหัสผ่าน หรือขั้นสมัครสมาชิก
        </p>
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><a href="/">กลับหน้าหลัก</a></p>
      </section>
    </main>
  );
}

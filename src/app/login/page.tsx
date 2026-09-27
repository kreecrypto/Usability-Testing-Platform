"use client";

import { useCallback, useEffect, useState } from "react";
import { guestSessionHistory, markGuestSessionStarted } from "../../lib/auth/guest-client.ts";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function LoginPage() {
  const [working, setWorking] = useState(true);
  const [message, setMessage] = useState("กำลังเปิด Researcher Workspace…");
  const [expired, setExpired] = useState(false);
  const [hasError, setHasError] = useState(false);

  const enterWorkspace = useCallback(async (startNew = false) => {
    setWorking(true);
    setHasError(false);
    setMessage("กำลังตรวจการเข้าใช้งาน…");
    try {
      const current = await fetch("/api/auth/session", { cache: "no-store" });
      if (current.ok) {
        window.location.replace("/projects");
        return;
      }
      if (current.status !== 401) throw new Error("session_unavailable");

      const history = guestSessionHistory();
      if (history !== "new" && !startNew) {
        setExpired(true);
        setHasError(true);
        setMessage(history === "previous"
          ? "เซสชันก่อนหน้าหมดอายุแล้ว คุณจะกลับไปแก้งานเดิมไม่ได้ เริ่มเซสชันใหม่เพื่อสร้างการทดสอบครั้งใหม่"
          : "ตรวจประวัติเซสชันไม่ได้ คุณอาจกลับไปแก้งานเดิมไม่ได้ หากต้องการดำเนินการต่อ ให้เริ่มเซสชันใหม่");
        return;
      }

      const response = await fetch("/api/auth/guest", {
        method: "POST",
        cache: "no-store",
      });
      const body = await readJson(response);
      if (!response.ok) {
        const code = typeof body.error === "string" ? body.error : "request_failed";
        setHasError(true);
        setMessage(code === "anonymous_auth_unavailable"
          ? "ยังเริ่มเซสชันชั่วคราวไม่ได้ โปรดติดต่อผู้ดูแลระบบ"
          : "เปิดพื้นที่ทำงานไม่สำเร็จ โปรดลองอีกครั้ง");
        return;
      }
      markGuestSessionStarted();
      window.location.replace("/projects");
    } catch {
      setHasError(true);
      setMessage("เชื่อมต่อพื้นที่ทำงานไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setWorking(false);
    }
  }, []);

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
          เริ่มสร้างการทดสอบได้โดยไม่ต้องสมัครบัญชี
        </p>

        <p role={hasError ? "alert" : "status"} style={{ margin: "0 0 16px" }}>{message}</p>
        <button
          className="primaryButton"
          type="button"
          disabled={working}
          onClick={() => void enterWorkspace(expired)}
          style={{ width: "100%" }}
        >
          {working ? "กำลังเปิดพื้นที่ทำงาน…" : expired ? "เริ่มเซสชันใหม่" : "เข้าพื้นที่ทำงาน"}
        </button>

        <p style={{ margin: "14px 0 0", color: "var(--ah-slate)", fontSize: 13 }}>
          เซสชันนี้ใช้ได้ชั่วคราว เมื่อหมดอายุหรือล้างข้อมูลเบราว์เซอร์ คุณจะกลับมาแก้งานเดิมไม่ได้
        </p>
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><a href="/">กลับหน้าหลัก</a></p>
      </section>
    </main>
  );
}

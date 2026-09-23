"use client";

import { useEffect, useState, type FormEvent } from "react";

type Mode = "login" | "signup";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => {
      if (response.ok) window.location.replace("/projects");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await readJson(response);
      if (response.ok && body.confirmationRequired === true) {
        setMessage("สร้างบัญชีแล้ว โปรดยืนยันอีเมลก่อนเข้าสู่ระบบ");
        return;
      }
      if (!response.ok) {
        const code = typeof body.error === "string" ? body.error : "request_failed";
        setMessage(code === "invalid_credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : code === "signup_unavailable"
            ? "ยังสร้างบัญชีด้วยอีเมลนี้ไม่ได้"
            : "ดำเนินการไม่สำเร็จ โปรดลองอีกครั้ง");
        return;
      }
      window.location.replace("/projects");
    } catch {
      setMessage("เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(460px, 100%)", background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: "var(--ah-radius-lg)", padding: 28, boxShadow: "var(--ah-shadow-card)" }}>
        <p className="eyebrow">UT Platform</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Researcher Workspace</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ah-slate)" }}>
          {mode === "login" ? "เข้าสู่ระบบเพื่อสร้างและเผยแพร่ usability study" : "สร้างบัญชี Researcher สำหรับ workspace ของคุณ"}
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>อีเมล</span>
            <input aria-label="อีเมล" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ minHeight: 44, border: "1px solid var(--ah-hairline)", borderRadius: 8, padding: "0 12px", background: "white" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>รหัสผ่าน</span>
            <input aria-label="รหัสผ่าน" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ minHeight: 44, border: "1px solid var(--ah-hairline)", borderRadius: 8, padding: "0 12px", background: "white" }} />
          </label>
          {message ? <p role="alert" style={{ margin: 0, color: "var(--ah-danger, #b42318)" }}>{message}</p> : null}
          <button className="primaryButton" type="submit" disabled={working} style={{ width: "100%" }}>
            {working ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
          </button>
        </form>

        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}
          style={{ width: "100%", marginTop: 12, minHeight: 42, border: 0, background: "transparent", color: "var(--ah-primary)" }}>
          {mode === "login" ? "ยังไม่มีบัญชี? สร้างบัญชี" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><a href="/">กลับหน้าหลัก</a></p>
      </section>
    </main>
  );
}

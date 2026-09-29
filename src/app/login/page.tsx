"use client";

import { useEffect, useState, type FormEvent } from "react";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function LoginPage() {
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        if (response.ok) { window.location.replace("/projects"); return; }
        if (response.status !== 401) setMessage("ตรวจสอบการเข้าใช้งานไม่สำเร็จ โปรดลองอีกครั้ง");
      })
      .catch(() => { if (active) setMessage("เชื่อมต่อระบบไม่สำเร็จ โปรดลองอีกครั้ง"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: "no-store",
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage(body.error === "invalid_credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง"
          : "เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง");
        return;
      }
      window.location.replace("/projects");
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(460px, 100%)", boxSizing: "border-box", background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: "var(--ah-radius-lg)", padding: 28, boxShadow: "var(--ah-shadow-card)" }}>
        <p className="eyebrow">UT Platform</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Researcher Workspace</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ah-slate)" }}>เข้าสู่ระบบเพื่อสร้างและดูการทดสอบของคุณ</p>

        {checking ? <p role="status">กำลังตรวจสอบการเข้าใช้งาน…</p> : <form onSubmit={(event) => void signIn(event)} style={{ display: "grid", gap: 14 }}>
          <label htmlFor="researcher-email">อีเมล</label>
          <input id="researcher-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={working} style={{ width: "100%", minHeight: 44, boxSizing: "border-box", padding: "10px 12px" }} />
          <label htmlFor="researcher-password">รหัสผ่าน</label>
          <input id="researcher-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={working} style={{ width: "100%", minHeight: 44, boxSizing: "border-box", padding: "10px 12px" }} />
          {message ? <p role="alert" style={{ margin: 0 }}>{message}</p> : null}
          <button className="primaryButton" type="submit" disabled={working} style={{ width: "100%", minHeight: 44 }}>{working ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
        </form>}
        {checking && message ? <p role="alert">{message}</p> : null}
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><a href="/">กลับหน้าหลัก</a></p>
      </section>
    </main>
  );
}

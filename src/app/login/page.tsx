"use client";

import { useEffect, useState } from "react";
import AuthForm, { type AuthMode } from "../../components/auth/auth-form";
import { authenticatedFetch } from "../../lib/auth/client.ts";
import { safeReturnPath } from "../../lib/auth/redirect.ts";
import styles from "../../components/auth/auth.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [next, setNext] = useState("/projects");
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const destination = safeReturnPath(params.get("next"));
    const requestedMode = params.get("mode");
    const chosen = requestedMode === "signup" || requestedMode === "recover" ? requestedMode : "login";
    setMode(chosen); setNext(destination);
    if (params.get("notice") === "link_invalid") setNotice("ลิงก์ยืนยันหมดอายุหรือเปิดต่างเบราว์เซอร์ หากยืนยันอีเมลแล้วให้ลองเข้าสู่ระบบ หรือขอลิงก์กู้รหัสผ่านใหม่");
    // Older implicit confirmation links may contain tokens. Never retain them in the URL.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (chosen !== "login" || params.has("notice")) { setChecking(false); return () => controller.abort(); }
    void authenticatedFetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }, false)
      .then((response) => { if (active && response.ok) window.location.replace(destination); })
      .catch(() => { if (active) setNotice("ตรวจสอบการเข้าใช้งานไม่สำเร็จ คุณลองเข้าสู่ระบบด้านล่างได้"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; controller.abort(); };
  }, []);
  const href = (value: AuthMode) => `/login?mode=${value}&next=${encodeURIComponent(next)}`;
  return <main className={styles.shell}><section className={styles.card} aria-labelledby="auth-title">
    <a className={styles.brand} href="/">UT Platform</a>
    <h1 id="auth-title">{mode === "signup" ? "สร้างบัญชี UTP" : mode === "recover" ? "ลืมรหัสผ่าน" : "เข้าสู่ระบบ UTP"}</h1>
    <p className={styles.lead}>{mode === "signup" ? "เริ่มสร้างการทดสอบและเรียนรู้จากผู้ใช้งานจริง" : mode === "recover" ? "กรอกอีเมลของบัญชี เราจะส่งลิงก์ให้คุณตั้งรหัสผ่านใหม่" : "ใช้บัญชี UTP เพื่อสร้างการทดสอบและดูผลของคุณ"}</p>
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    {checking ? <p role="status">กำลังตรวจสอบการเข้าใช้งาน…</p> : <AuthForm key={mode} mode={mode} next={next} onSuccess={() => window.location.replace(next)} />}
    <nav className={styles.links} aria-label="ตัวเลือกบัญชี">
      {mode !== "login" ? <a href={href("login")}>มีบัญชีแล้ว เข้าสู่ระบบ</a> : <a href={href("signup")}>ยังไม่มีบัญชี สร้างบัญชี</a>}
      {mode !== "recover" ? <a href={href("recover")}>ลืมรหัสผ่าน</a> : <a href={href("signup")}>สร้างบัญชีใหม่</a>}
    </nav><a className={styles.home} href="/">← กลับหน้าหลัก</a>
  </section></main>;
}

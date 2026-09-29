"use client";

import { useState, type FormEvent } from "react";
import { authenticatedFetch, withAuthLock } from "../../lib/auth/client.ts";
import styles from "./auth.module.css";

export type AuthMode = "login" | "signup" | "recover" | "reset";
export type AuthUser = { id: string; email: string | null };
const messages: Record<string, string> = {
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง",
  email_not_confirmed: "กรุณาเปิดอีเมลยืนยันบัญชีก่อนเข้าสู่ระบบ หากหาไม่พบ ให้ตรวจโฟลเดอร์สแปม",
  signup_unavailable: "สร้างบัญชีไม่สำเร็จ หากเคยสมัครแล้ว ให้เข้าสู่ระบบหรือใช้ลืมรหัสผ่าน",
  weak_password: "รหัสผ่านยังใช้ไม่ได้ ลองใช้รหัสผ่านใหม่ที่ยาวอย่างน้อย 8 ตัวอักษรและคาดเดาได้ยาก",
  rate_limited: "มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง",
  account_mismatch: "บัญชีนี้ไม่ตรงกับงานที่เปิดอยู่ กรุณาใช้บัญชีเดิมเพื่อรักษาข้อมูลที่กำลังแก้ไข",
  authentication_required: "ลิงก์หรือการเข้าใช้งานหมดอายุแล้ว กรุณาขอลิงก์กู้รหัสผ่านใหม่",
  invalid_session: "ลิงก์หรือการเข้าใช้งานหมดอายุแล้ว กรุณาขอลิงก์ใหม่หรือติดต่อผู้ดูแล",
};
export default function AuthForm({ mode = "login", next = "/projects", expectedUser, onSuccess }: {
  mode?: AuthMode; next?: string; expectedUser?: AuthUser | null; onSuccess: (user?: AuthUser) => void;
}) {
  const [email, setEmail] = useState(expectedUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const needsPassword = mode !== "recover";
  const newPassword = mode === "signup" || mode === "reset";
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError("");
    if (newPassword && password !== confirmation) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง"); return; }
    setBusy(true);
    try {
      const send = () => (mode === "reset" ? authenticatedFetch : fetch)(`/api/auth/${mode === "reset" ? "password" : mode}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ email: email.trim(), password, next, ...(expectedUser ? { expectedUserId: expectedUser.id } : {}) }),
      });
      const response = await (mode === "reset" ? send() : withAuthLock(send));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(messages[body.error] ?? "เชื่อมต่อระบบไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง"); return; }
      setPassword(""); setConfirmation("");
      if (mode === "recover" || body.confirmationRequired) setSent(true);
      else onSuccess(body.user);
    } catch { setError("เชื่อมต่อระบบไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ โปรดลองอีกครั้ง"); }
    finally { setBusy(false); }
  }
  if (sent) return <div className={styles.notice} role="status"><h2>ตรวจสอบอีเมลของคุณ</h2><p>{mode === "recover" ? "หากอีเมลนี้มีบัญชีอยู่ คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่" : "หากบัญชีนี้ต้องยืนยันอีเมล คุณจะได้รับลิงก์ยืนยันก่อนเข้าใช้งาน"}</p><p>เปิดลิงก์ล่าสุดในเบราว์เซอร์เดียวกับที่ใช้หน้านี้ และตรวจโฟลเดอร์สแปมหากยังไม่พบ</p><button className={styles.secondary} type="button" onClick={() => setSent(false)}>แก้ไขอีเมลหรือลองอีกครั้ง</button></div>;
  return <form className={styles.form} onSubmit={(event) => void submit(event)} aria-busy={busy}>
    {mode !== "reset" ? <label htmlFor="auth-email">อีเมล<input id="auth-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} readOnly={Boolean(expectedUser?.email)} /></label> : null}
    {needsPassword ? <><label htmlFor="auth-password">{newPassword ? "รหัสผ่านใหม่" : "รหัสผ่าน"}<input id="auth-password" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} aria-describedby={newPassword ? "password-hint" : undefined} /></label><button type="button" className={styles.reveal} aria-controls="auth-password" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}</button></> : null}
    {newPassword ? <><p id="password-hint" className={styles.hint}>อย่างน้อย 8 ตัวอักษร ใช้รหัสผ่านเฉพาะสำหรับบัญชีนี้</p><label htmlFor="auth-confirm">ยืนยันรหัสผ่านใหม่<input id="auth-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label></> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <button className={styles.primary} disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "signup" ? "สร้างบัญชี" : mode === "recover" ? "ส่งลิงก์กู้รหัสผ่าน" : mode === "reset" ? "บันทึกรหัสผ่านใหม่" : "เข้าสู่ระบบ"}</button>
  </form>;
}

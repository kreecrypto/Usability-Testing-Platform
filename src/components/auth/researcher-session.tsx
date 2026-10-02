"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthForm, { type AuthUser } from "./auth-form";
import { authenticatedFetch, redirectToLogin, setCurrentResearcher, withAuthLock, SESSION_EXPIRED_EVENT, SESSION_RESTORED_EVENT } from "../../lib/auth/client.ts";
import styles from "./auth.module.css";

export default function ResearcherSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const protectedPage = /^\/(projects|tests|builder|methods|findings|reports|results|retests)(\/|$)/.test(pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authenticatedFetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(15000) }, false);
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) throw new Error();
      const body = await response.json();
      setCurrentResearcher(body.user.id);
      setUser(body.user);
    } catch { setError("ตรวจสอบการเข้าใช้งานไม่สำเร็จ โปรดลองเชื่อมต่ออีกครั้ง"); }
  }, []);
  useEffect(() => { if (protectedPage) void load(); else { setUser(null); setCurrentResearcher(null); } }, [protectedPage, load]);
  useEffect(() => {
    const show = () => { setExpired(true); setNotice(""); dialog.current?.showModal(); };
    window.addEventListener(SESSION_EXPIRED_EVENT, show);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, show);
  }, []);
  async function signOut() {
    if (working || !window.confirm("ออกจากระบบตอนนี้หรือไม่? กรุณาบันทึกงานก่อน ข้อมูลที่ยังไม่บันทึกจะหายเมื่อออกจากหน้านี้")) return;
    setWorking(true);
    try {
      const response = await withAuthLock(() => fetch("/api/auth/logout", { method: "POST", signal: AbortSignal.timeout(20000) }));
      if (!response.ok) throw new Error();
      window.location.assign("/login?notice=signed_out");
    } catch { setNotice("ออกจากระบบไม่สำเร็จ โปรดลองอีกครั้ง"); setWorking(false); }
  }
  if (!protectedPage) return children;
  if (!user) return <main className={styles.shell}><section className={styles.card}>{error ? <><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void load()}>ลองอีกครั้ง</button></> : <p role="status">กำลังตรวจสอบบัญชี…</p>}</section></main>;
  return <><div className={styles.account} aria-label="บัญชีผู้ใช้งาน"><span>{user.email ?? "บัญชี UTP"}</span><button type="button" disabled={working} onClick={() => void signOut()}>{working ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>
    {expired ? <><span role="status">การเข้าใช้งานหมดอายุ ข้อมูลที่กรอกยังอยู่ในหน้านี้</span><button onClick={() => dialog.current?.showModal()}>เข้าสู่ระบบอีกครั้ง</button></> : null}
    {notice ? <span role="status">{notice}</span> : null}
  </div>{children}<dialog ref={dialog} className={styles.dialog} aria-labelledby="reauth-title" aria-describedby="reauth-description">
    <h2 id="reauth-title">เข้าสู่ระบบเพื่อทำงานต่อ</h2><p id="reauth-description">ใช้บัญชีเดิม ข้อมูลที่กำลังแก้ไขยังอยู่ หลังเข้าสู่ระบบให้กดบันทึกหรือลองโหลดข้อมูลอีกครั้ง</p>
    <AuthForm expectedUser={user} onSuccess={() => { setExpired(false); setNotice("เข้าสู่ระบบแล้ว ข้อมูลที่กรอกยังอยู่ กดบันทึกหรือลองอีกครั้งเพื่อทำงานต่อ"); dialog.current?.close(); window.dispatchEvent(new Event(SESSION_RESTORED_EVENT)); }} />
    <a className={styles.home} href="/login?mode=recover" target="_blank" rel="noopener noreferrer">ลืมรหัสผ่าน (เปิดแท็บใหม่)</a>
    <button className={styles.secondary} onClick={() => dialog.current?.close()}>กลับไปดูงานที่ยังไม่บันทึก</button>
  </dialog></>;
}

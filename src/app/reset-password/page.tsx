"use client";
import { useState } from "react";
import AuthForm from "../../components/auth/auth-form";
import styles from "../../components/auth/auth.module.css";
export default function ResetPasswordPage() {
  const [saved, setSaved] = useState(false);
  return <main className={styles.shell}><section className={styles.card}>
    <a className={styles.brand} href="/">UT Platform</a><h1>ตั้งรหัสผ่านใหม่</h1>
    {saved ? <div role="status"><p>บันทึกรหัสผ่านใหม่แล้ว</p><a className={styles.primary} href="/projects">ไปยังโปรเจกต์</a></div> : <><p className={styles.lead}>ใช้รหัสผ่านที่คาดเดาได้ยากและแตกต่างจากบัญชีอื่น</p><AuthForm mode="reset" onSuccess={() => setSaved(true)} /></>}
    <nav className={styles.links}><a href="/login?mode=recover">ขอลิงก์กู้รหัสผ่านใหม่</a><a href="/login">กลับไปเข้าสู่ระบบ</a></nav>
  </section></main>;
}

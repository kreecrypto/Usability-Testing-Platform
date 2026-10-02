"use client";
import { usePathname } from "next/navigation";
import StudyContext from "./study-context";
import styles from "./study-navigation.module.css";
const steps = [ ["prototype", "เป้าหมายทดสอบ"], ["tasks", "งานที่ให้ผู้เข้าร่วมทำ"], ["criteria", "เกณฑ์สำเร็จ"], ["rules", "กติกาจบงาน"], ["questions", "คำถามหลังทำงาน"], ["review", "ตรวจสอบและเผยแพร่"] ];
export default function BuilderNavigation({ testId }: { testId: string }) {
  const path = usePathname();
  const current = path.split("/").at(-1);
  // Review has its own source-backed mode-aware navigation. Never infer a method study from an absent target.
  const visible = current === "methods" || current === "review" ? [] : steps;
  return <><StudyContext testId={testId} />{visible.length ? <nav className={styles.steps} aria-label="ขั้นตอนตั้งค่าแบบทดสอบ"><ol>{visible.map(([route, label], index) => <li key={route}><a href={`/builder/${encodeURIComponent(testId)}/${route}`} aria-current={current === route ? "step" : undefined}>{index + 1}. {label}</a></li>)}</ol><p>กดบันทึกในแต่ละส่วนก่อนเปลี่ยนขั้นตอน เมื่อพร้อมแล้วไปที่ “ตรวจสอบและเผยแพร่” เพื่อรับลิงก์เชิญผู้เข้าร่วม</p></nav> : null}</>;
}

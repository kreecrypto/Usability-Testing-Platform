import styles from "./study-navigation.module.css";
export default function ResultsNavigation({ versionId, methods = false, current }: { versionId: string; methods?: boolean; current: "results" | "findings" | "reports" | "retest" }) {
  if (!versionId) return null;
  const root = methods ? "/methods" : "";
  const version = encodeURIComponent(versionId);
  const items = [ ["results", "ผลการทดสอบ", `${root}/results/${version}`], ["findings", "ข้อค้นพบ", `${root}/findings/${version}`], ["reports", "รายงาน", `${root}/reports/${version}`], ["retest", "ทดสอบซ้ำ", `${root}/reports/${version}#retest`] ];
  return <nav className={styles.steps} aria-label="เมนูการวิเคราะห์ของเวอร์ชันนี้"><ol>{items.map(([key,label,href]) => <li key={key}><a href={href} aria-current={key === current ? "page" : undefined}>{label}</a></li>)}</ol></nav>;
}

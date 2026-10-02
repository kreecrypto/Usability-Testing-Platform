import { workflowLabels } from "./labels";
import styles from "./study-navigation.module.css";
export default function StudyWorkflow({ testId, versionId, methods = false, published = false, editable = true, current }: { testId?: string | null; versionId?: string; methods?: boolean; published?: boolean; editable?: boolean; current: number }) {
  const builder = testId && editable ? `/builder/${encodeURIComponent(testId)}` : null;
  const root = methods ? "/methods" : "";
  const version = versionId ? encodeURIComponent(versionId) : null;
  const links = [builder ? `${builder}/${methods ? "methods" : "prototype"}` : null, builder ? `${builder}/review` : null,
    published && builder ? `${builder}/${methods ? "methods#invites" : "review#share-heading"}` : null,
    published && version ? `${root}/results/${version}` : null, published && version ? `${root}/findings/${version}` : null,
    published && version ? `${root}/reports/${version}` : null, published && version ? `${root}/reports/${version}#retest` : null];
  return <nav className={styles.steps} aria-label="ขั้นตอนแบบทดสอบ"><ol>{workflowLabels.map((label, index) => <li key={label}>{links[index] ? <a href={links[index]!} aria-current={current === index ? "page" : undefined}>{label}</a> : <span aria-current={current === index ? "step" : undefined}>{label}<small>{index > 1 && !published ? "เผยแพร่แบบทดสอบก่อน" : "ยังไม่มีข้อมูลสำหรับเปิดขั้นตอนนี้"}</small></span>}</li>)}</ol></nav>;
}

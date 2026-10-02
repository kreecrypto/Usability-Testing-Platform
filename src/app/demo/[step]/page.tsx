import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoMetrics, demoSteps, demoStudy, type DemoStep } from "../../../lib/demo/public-demo.ts";
import styles from "../demo.module.css";

export const metadata: Metadata = {
  title: "UT Platform Demo — ข้อมูลตัวอย่าง",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return demoSteps.map(({ slug }) => ({ step: slug }));
}

function StudyContext() {
  return <p className={styles.context}>{demoStudy.project} <span aria-hidden="true">/</span> {demoStudy.test} <span aria-hidden="true">/</span> {demoStudy.baselineVersion}</p>;
}

function StepContent({ step }: { step: DemoStep }) {
  switch (step) {
    case "projects": return <>
      <div className={styles.intro}><p>โปรเจกต์นี้รวมแบบทดสอบและผลของงานเดียวกัน เลือกแบบทดสอบเพื่อดูว่าทีมตั้งโจทย์อย่างไร</p></div>
      <article className={styles.card}><span className={styles.kicker}>โปรเจกต์ตัวอย่าง</span><h2>{demoStudy.project}</h2><p>เป้าหมาย: หาว่าผู้ใช้ติดขัดตรงไหนก่อนสมัครสำเร็จ แล้วตรวจผลหลังปรับหน้าแบบฟอร์ม</p><p className={styles.meta}>1 แบบทดสอบ · ก่อนและหลังปรับ 2 เวอร์ชัน</p><a className={styles.action} href="/demo/test">ดูแบบทดสอบ <span aria-hidden="true">→</span></a></article>
    </>;
    case "test": return <>
      <StudyContext />
      <div className={styles.grid}>
        <article className={styles.card}><span className={styles.kicker}>เป้าหมาย</span><h2>{demoStudy.test}</h2><p>ให้ผู้เข้าร่วมลองสมัครบน{demoStudy.target} แล้วดูว่าสำเร็จหรือหยุดตรงขั้นใด</p><dl><dt>งานที่ให้ทำ</dt><dd>{demoStudy.task}</dd><dt>เวอร์ชันที่ดู</dt><dd>{demoStudy.baselineVersion} · เผยแพร่แล้ว (ตัวอย่าง)</dd></dl></article>
        <article className={styles.card}><span className={styles.kicker}>ขั้นถัดไป</span><h2>ตรวจผลและหลักฐาน</h2><p>เมื่อผู้เข้าร่วมทำเสร็จ ให้ดูผลของเวอร์ชันนี้และเปิดแต่ละรอบเพื่อดูว่าเกิดอะไรขึ้น</p><a className={styles.action} href="/demo/results">ดูผลการทดสอบ <span aria-hidden="true">→</span></a></article>
      </div>
    </>;
    case "results": return <>
      <StudyContext />
      <div className={styles.metricGrid}>
        <article className={styles.metric}><span>ทำงานสำเร็จ</span><strong>{demoMetrics.baselineSuccess}/{demoMetrics.baselineEligible}</strong><small>จาก {demoMetrics.baselineEligible} รอบที่นับผลได้ · อีก {demoMetrics.baselineTechnical} รอบติดปัญหาทางเทคนิค</small></article>
        <article className={styles.metric}><span>ติดปัญหาทางเทคนิค</span><strong>{demoMetrics.baselineTechnical}</strong><small>ไม่นำไปรวมกับงานที่ผู้ใช้ทำไม่สำเร็จ</small></article>
      </div>
      <section className={styles.card}><h2>รอบการทดสอบตัวอย่าง</h2><p>ดูเส้นทางของแต่ละรอบก่อนตัดสินว่าอะไรเป็นปัญหาการใช้งาน</p><div className={styles.sessions}>{demoStudy.sessions.map((session) => <article key={session.id} className={styles.session}><div><strong>{session.id}</strong><span className={styles.outcome}>{session.outcome}</span></div><p>{session.path}</p><small>{session.note}</small></article>)}</div><a className={styles.action} href="/demo/findings">ดูข้อค้นพบ <span aria-hidden="true">→</span></a></section>
    </>;
    case "findings": return <>
      <StudyContext />
      <article className={styles.card}><span className={styles.kicker}>ข้อค้นพบตัวอย่าง · ระดับปานกลาง</span><h2>ปุ่มไปต่อหลังกรอกข้อมูลหาได้ยาก</h2><p>ในรอบ S04 ผู้เข้าร่วมกลับหน้าแรกก่อนถึงหน้ายืนยัน ส่วน S05 หยุดหลังกรอกข้อมูล จึงควรตรวจว่าปุ่มไปต่อเห็นชัดพอหรือไม่</p><dl><dt>หลักฐานตัวอย่าง</dt><dd><a href="/demo/results">S04 และ S05 · ดูเส้นทางในผลการทดสอบ</a></dd><dt>ข้อเสนอแนะ</dt><dd>ปรับข้อความและตำแหน่งปุ่มไปต่อ แล้วให้ผู้เข้าร่วมกลุ่มใหม่ลองทำงานเดิม</dd></dl><a className={styles.action} href="/demo/report">ดูรายงาน <span aria-hidden="true">→</span></a></article>
    </>;
    case "report": return <>
      <StudyContext />
      <article className={styles.card}><span className={styles.kicker}>รายงานตัวอย่าง</span><h2>สิ่งที่พบและสิ่งที่ควรแก้</h2><p>จาก {demoMetrics.baselineEligible} รอบที่นับผลได้ มี {demoMetrics.baselineSuccess} รอบที่ทำงานสำเร็จ อีก {demoMetrics.baselineTechnical} รอบโหลดหน้าไม่สำเร็จ จึงแยกออกจากผลด้านการใช้งาน</p><ol className={styles.list}><li>ตรวจตำแหน่งและข้อความปุ่มดำเนินการต่อ</li><li>ปรับหน้าแบบฟอร์มให้ผู้ใช้เห็นขั้นที่เหลือ</li><li>เผยแพร่เวอร์ชันใหม่ แล้วทดสอบงานเดิมอีกครั้ง</li></ol><p><a href="/demo/findings">ดูข้อค้นพบและหลักฐานตัวอย่าง</a></p><a className={styles.action} href="/demo/retest">ดูการทดสอบซ้ำ <span aria-hidden="true">→</span></a></article>
    </>;
    case "retest": return <>
      <StudyContext />
      <div className={styles.grid}><article className={styles.metric}><span>ก่อนปรับ · {demoStudy.baselineVersion}</span><strong>{demoMetrics.baselineSuccess}/{demoMetrics.baselineEligible}</strong><small>สำเร็จ / ผู้ที่นับผลได้ · ติดปัญหาทางเทคนิค {demoMetrics.baselineTechnical}</small></article><article className={styles.metric}><span>หลังปรับ · {demoStudy.retestVersion}</span><strong>{demoStudy.retest.success}/{demoStudy.retest.eligible}</strong><small>สำเร็จ / ผู้ที่นับผลได้ · ติดปัญหาทางเทคนิค {demoStudy.retest.technical}</small></article></div>
      <article className={styles.card}><h2>เทียบผลหลังแก้ไข</h2><p>ตัวอย่างนี้ทำงานสำเร็จ 3 จาก 5 รอบก่อนปรับ และ 4 จาก 5 รอบหลังปรับ ต่างกัน 20 จุดเปอร์เซ็นต์ แต่จำนวนรอบยังน้อย ควรดูหลักฐานแต่ละรอบและทดสอบเพิ่มก่อนสรุปผลจริง</p><p><a href="/demo/results">ดูผลและรอบการทดสอบก่อนปรับ</a></p><a className={styles.action} href="/demo/projects">กลับไปที่โปรเจกต์ <span aria-hidden="true">→</span></a></article>
    </>;
  }
}

export default async function DemoStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const index = demoSteps.findIndex((item) => item.slug === step);
  if (index < 0) notFound();
  const current = demoSteps[index];
  const previous = demoSteps[index - 1];
  const next = demoSteps[index + 1];

  return <div className={styles.shell}>
    <aside className={styles.sidebar}><a className={styles.brand} href="/">UT Platform</a><p className={styles.sidebarCaption}>ตัวอย่างขั้นตอนทำงาน</p><nav aria-label="ขั้นตอนตัวอย่าง">{demoSteps.map((item, position) => <a key={item.slug} className={`${styles.navLink} ${item.slug === step ? styles.active : ""}`} href={`/demo/${item.slug}`} aria-current={item.slug === step ? "page" : undefined}><span>{String(position + 1).padStart(2, "0")}</span>{item.label}</a>)}</nav></aside>
    <main className={styles.main}><div className={styles.notice} role="note"><strong>Demo · ข้อมูลตัวอย่าง</strong><span>ดูขั้นตอนทำงานได้ แต่แก้ไขไม่ได้ ตัวเลขและรอบการทดสอบทั้งหมดเป็นตัวอย่าง ไม่ใช่ผลจากผู้ใช้จริง</span></div><header className={styles.header}><div><p className={styles.eyebrow}>ขั้นที่ {index + 1} จาก {demoSteps.length}</p><h1>{current.label}</h1></div><a href="/" className={styles.homeLink}>หน้าหลัก</a></header><StepContent step={current.slug} /><nav className={styles.pager} aria-label="ไปยังขั้นก่อนหน้าหรือถัดไป">{previous ? <a href={`/demo/${previous.slug}`}>← {previous.label}</a> : <span />}{next ? <a href={`/demo/${next.slug}`}>{next.label} →</a> : <a href="/demo/projects">กลับไปเริ่มต้น →</a>}</nav></main>
  </div>;
}

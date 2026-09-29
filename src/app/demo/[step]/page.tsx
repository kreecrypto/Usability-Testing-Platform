import type { Metadata } from "next";
import Link from "next/link";
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
      <div className={styles.intro}><p>โปรเจกต์ช่วยรวมแบบทดสอบและผลไว้ในที่เดียว เริ่มจากเลือกโปรเจกต์ แล้วเปิดแบบทดสอบที่ต้องการดู</p></div>
      <article className={styles.card}><span className={styles.kicker}>โปรเจกต์ตัวอย่าง</span><h2>{demoStudy.project}</h2><p>สำรวจปัญหาในขั้นตอนสมัครและติดตามผลหลังแก้ไข</p><p className={styles.meta}>1 แบบทดสอบ · 2 เวอร์ชันตัวอย่าง</p><Link className={styles.action} href="/demo/test">ดูแบบทดสอบ <span aria-hidden="true">→</span></Link></article>
    </>;
    case "test": return <>
      <StudyContext />
      <div className={styles.grid}>
        <article className={styles.card}><span className={styles.kicker}>เป้าหมาย</span><h2>{demoStudy.test}</h2><p>ให้ผู้เข้าร่วมลองทำงานกับ{demoStudy.target} แล้วดูว่าติดขัดตรงไหน</p><dl><dt>งานที่ให้ทำ</dt><dd>{demoStudy.task}</dd><dt>เวอร์ชันที่ดู</dt><dd>{demoStudy.baselineVersion} · เผยแพร่แล้ว (ตัวอย่าง)</dd></dl></article>
        <article className={styles.card}><span className={styles.kicker}>ขั้นถัดไป</span><h2>ตรวจผลและหลักฐาน</h2><p>หลังมีผู้เข้าร่วม ระบบจะเชื่อมผลกับ session และเวอร์ชันที่ใช้ทดสอบ</p><Link className={styles.action} href="/demo/results">ดูผลการทดสอบ <span aria-hidden="true">→</span></Link></article>
      </div>
    </>;
    case "results": return <>
      <StudyContext />
      <div className={styles.metricGrid}>
        <article className={styles.metric}><span>สำเร็จจากผู้ที่นับผลได้</span><strong>{demoMetrics.baselineSuccess}/{demoMetrics.baselineEligible}</strong><small>ตัวเลขตัวอย่าง · ไม่นับ session ที่ติดปัญหาทางเทคนิค</small></article>
        <article className={styles.metric}><span>ติดปัญหาทางเทคนิค</span><strong>{demoMetrics.baselineTechnical}</strong><small>แสดงแยกจากความล้มเหลวในการใช้งาน</small></article>
      </div>
      <section className={styles.card}><h2>รอบการทดสอบตัวอย่าง</h2><p>เลือกดูเส้นทางและบันทึกของแต่ละ session ก่อนสรุปข้อค้นพบ</p><div className={styles.sessions}>{demoStudy.sessions.map((session) => <article key={session.id} className={styles.session}><div><strong>{session.id}</strong><span className={styles.outcome}>{session.outcome}</span></div><p>{session.path}</p><small>{session.note}</small></article>)}</div><Link className={styles.action} href="/demo/findings">ดูข้อค้นพบ <span aria-hidden="true">→</span></Link></section>
    </>;
    case "findings": return <>
      <StudyContext />
      <article className={styles.card}><span className={styles.kicker}>ข้อค้นพบตัวอย่าง · ระดับปานกลาง</span><h2>ปุ่มไปต่อหลังกรอกข้อมูลหาได้ยาก</h2><p>ผู้เข้าร่วมหนึ่งรายกลับหน้าแรก และอีกรายยุติการทดสอบก่อนถึงหน้ายืนยัน ตัวอย่างนี้ชี้ให้ตรวจความเด่นและตำแหน่งของปุ่มดำเนินการต่อ</p><dl><dt>หลักฐานตัวอย่าง</dt><dd><Link href="/demo/results">S04 และ S05 · ดูเส้นทางในผลการทดสอบ</Link></dd><dt>ข้อเสนอแนะ</dt><dd>ทำปุ่มดำเนินการต่อให้เห็นชัดหลังกรอกข้อมูล และทดสอบซ้ำกับผู้ใช้</dd></dl><Link className={styles.action} href="/demo/report">ดูรายงาน <span aria-hidden="true">→</span></Link></article>
    </>;
    case "report": return <>
      <StudyContext />
      <article className={styles.card}><span className={styles.kicker}>รายงานตัวอย่าง</span><h2>สิ่งที่พบและสิ่งที่ควรแก้</h2><p>ในข้อมูลสังเคราะห์นี้ ผู้ที่นับผลได้ {demoMetrics.baselineEligible} รายทำงานสำเร็จ {demoMetrics.baselineSuccess} ราย อีก {demoMetrics.baselineTechnical} รายติดปัญหาทางเทคนิคและแยกออกจากการคำนวณ</p><ol className={styles.list}><li>ตรวจตำแหน่งและข้อความปุ่มดำเนินการต่อ</li><li>ปรับหน้าแบบฟอร์มให้ผู้ใช้เห็นขั้นที่เหลือ</li><li>เผยแพร่เวอร์ชันใหม่ แล้วทดสอบงานเดิมอีกครั้ง</li></ol><p><Link href="/demo/findings">ดูข้อค้นพบและหลักฐานตัวอย่าง</Link></p><Link className={styles.action} href="/demo/retest">ดูการทดสอบซ้ำ <span aria-hidden="true">→</span></Link></article>
    </>;
    case "retest": return <>
      <StudyContext />
      <div className={styles.grid}><article className={styles.metric}><span>ก่อนปรับ · {demoStudy.baselineVersion}</span><strong>{demoMetrics.baselineSuccess}/{demoMetrics.baselineEligible}</strong><small>สำเร็จ / ผู้ที่นับผลได้ · ติดปัญหาทางเทคนิค {demoMetrics.baselineTechnical}</small></article><article className={styles.metric}><span>หลังปรับ · {demoStudy.retestVersion}</span><strong>{demoStudy.retest.success}/{demoStudy.retest.eligible}</strong><small>สำเร็จ / ผู้ที่นับผลได้ · ติดปัญหาทางเทคนิค {demoStudy.retest.technical}</small></article></div>
      <article className={styles.card}><h2>เทียบผลหลังแก้ไข</h2><p>ตัวอย่างแสดงสัดส่วนสำเร็จจาก 60% เป็น 80% หรือเพิ่มขึ้น 20 จุดเปอร์เซ็นต์ ทั้งสองรุ่นมีขนาดตัวอย่างเล็ก จึงควรตรวจ session และทดสอบเพิ่มก่อนตัดสินใจจริง</p><p><Link href="/demo/results">ย้อนดูผลและ session ของเวอร์ชันแรก</Link></p><Link className={styles.action} href="/demo/projects">กลับไปที่โปรเจกต์ <span aria-hidden="true">→</span></Link></article>
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
    <aside className={styles.sidebar}><Link className={styles.brand} href="/">UT Platform</Link><p className={styles.sidebarCaption}>สำรวจผลิตภัณฑ์</p><nav aria-label="ขั้นตอน Demo">{demoSteps.map((item, position) => <Link key={item.slug} className={`${styles.navLink} ${item.slug === step ? styles.active : ""}`} href={`/demo/${item.slug}`} aria-current={item.slug === step ? "page" : undefined}><span>{String(position + 1).padStart(2, "0")}</span>{item.label}</Link>)}</nav></aside>
    <main className={styles.main}><div className={styles.notice} role="note"><strong>Demo · ข้อมูลตัวอย่าง</strong><span>เส้นทางนี้อ่านอย่างเดียว ข้อมูลและผลทั้งหมดเป็นเรื่องสมมติ ไม่ใช่หลักฐานจากผู้เข้าร่วมจริง</span></div><header className={styles.header}><div><p className={styles.eyebrow}>ขั้นที่ {index + 1} จาก {demoSteps.length}</p><h1>{current.label}</h1></div><Link href="/" className={styles.homeLink}>หน้าหลัก</Link></header><StepContent step={current.slug} /><nav className={styles.pager} aria-label="ไปยังขั้นก่อนหน้าหรือถัดไป">{previous ? <Link href={`/demo/${previous.slug}`}>← {previous.label}</Link> : <span />}{next ? <Link href={`/demo/${next.slug}`}>{next.label} →</Link> : <Link href="/demo/projects">กลับไปเริ่มต้น →</Link>}</nav></main>
  </div>;
}

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const workflow = [
  { title: "โปรเจกต์", description: "รวมแบบทดสอบของงานเดียวกัน" },
  { title: "เตรียมแบบทดสอบ", description: "กำหนดโจทย์ ตรวจสอบและเผยแพร่ แล้วให้ผู้เข้าร่วมทำงาน" },
  { title: "ดูผลและหลักฐาน", description: "ตรวจคำตอบและพฤติกรรมของแต่ละรอบก่อนสรุป" },
  { title: "ข้อค้นพบ", description: "เลือกหลักฐานและเขียนสิ่งที่ควรแก้" },
  { title: "รายงาน", description: "สรุปข้อค้นพบพร้อมลิงก์กลับไปตรวจหลักฐาน" },
  { title: "แก้ไขและทดสอบซ้ำ", description: "สร้างรอบใหม่เพื่อตรวจผลหลังปรับปรุง" },
];
const reviewLinks = [
  { label: "ทดลองใช้งาน", href: "/trial" },
  { label: "ดู Demo", href: "/demo/projects" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="เมนูหลัก">
          <a className="navItem active" href="#overview" aria-current="page">ภาพรวม</a>
          {reviewLinks.map(item => <a className="navItem" href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <h1>ทดสอบการใช้งานกับผู้ใช้จริง</h1>
            <p>ทดลองขั้นตอนตั้งแต่เตรียมแบบทดสอบจนถึงรายงาน ก่อนเริ่มงานวิจัยจริง</p>
          </div>
        </header>
        <Card asChild appearance="legacy"><section id="overview" className="heroCard homeIntro">
          <h2>เลือกวิธีเริ่มใช้งาน</h2>
          <p id="trial-description">ทดลองกับเว็บจำลองได้โดยไม่ต้องเข้าสู่ระบบ ข้อมูลเก็บเฉพาะเบราว์เซอร์นี้ ไม่แชร์ข้ามเครื่อง และไม่เก็บพฤติกรรมจากเว็บไซต์ภายนอก</p>
          <div className="homeActions">
            <Button asChild variant="legacy"><a className="primaryButton" href="/trial" aria-describedby="trial-description">เริ่มทดลองใช้งาน</a></Button>
            <Button asChild variant="legacy"><a className="homeSecondary" href="/demo/projects" aria-describedby="demo-description">ดูตัวอย่างแบบอ่านอย่างเดียว</a></Button>
          </div>
          <p id="demo-description">ข้อมูลใน Demo เป็นเรื่องสมมติ ไม่ใช่ผลจากผู้เข้าร่วมจริง ดูขั้นตอนและผลตัวอย่างได้ แต่แก้ไขไม่ได้</p>
        </section></Card>
        <section className="section" aria-labelledby="workflow-title">
          <h2 id="workflow-title">ลำดับการทำงาน</h2>
          <ol className="homeWorkflow">{workflow.map(step => <li key={step.title}><strong>{step.title}</strong><p>{step.description}</p></li>)}</ol>
        </section>
      </section>
    </main>
  );
}

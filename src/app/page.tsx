import RecentWork from "./recent-work";
import MainNavigation from "../components/navigation/main-navigation";

export default function Home() {
  return <main className="shell">
    <aside className="sidebar"><div className="brand">UT Platform</div><MainNavigation current="/" /></aside>
    <section className="content">
      <header className="topbar"><div><h1>ทดสอบการใช้งานกับผู้ใช้จริง</h1><p>สร้างแบบทดสอบ เชิญผู้เข้าร่วม แล้วใช้หลักฐานสรุปสิ่งที่ควรปรับปรุง</p></div><a className="primaryButton" href="/projects">ไปที่โปรเจกต์</a></header>
      <RecentWork />
      <p><a href="/demo/projects">ดูตัวอย่างการทำงาน</a> · ข้อมูลตัวอย่างแบบอ่านอย่างเดียว</p>
      <section className="section" aria-labelledby="start-heading"><h2 id="start-heading">เริ่มการทดสอบครั้งแรก</h2>
        <ol className="gettingStarted">
          <li><h3>สร้างโปรเจกต์และแบบทดสอบ</h3><p>โปรเจกต์ใช้รวมแบบทดสอบของงานเดียวกัน เลือกสิ่งที่ต้องการเรียนรู้จากผู้ใช้</p></li>
          <li><h3>เตรียมงานและเชิญผู้เข้าร่วม</h3><p>เพิ่มลิงก์ต้นแบบหรือเว็บไซต์ หรือกำหนดกิจกรรมวิจัย ตรวจสอบและเผยแพร่ก่อนส่งลิงก์</p></li>
          <li><h3>ดูผลและสรุปสิ่งที่ควรแก้</h3><p>ตรวจหลักฐานจากผู้เข้าร่วม บันทึกข้อค้นพบ และนำไปสรุปในรายงาน</p></li>
        </ol>
      </section>
    </section>
  </main>;
}

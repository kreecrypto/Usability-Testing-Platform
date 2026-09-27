const workflowSteps = [
  {
    title: "ใส่ลิงก์ Prototype หรือ UAT",
    description: "สร้างการทดสอบในโปรเจกต์ แล้วเพิ่มลิงก์สิ่งที่ต้องการให้ผู้เข้าร่วมลองใช้",
  },
  {
    title: "กำหนดงาน User Test",
    description: "เขียนงานที่ให้ผู้เข้าร่วมทำ ตรวจความพร้อม แล้วส่งลิงก์ทดสอบให้ผู้เข้าร่วม",
  },
  {
    title: "ดู Report",
    description: "เมื่อมีผลทดสอบแล้ว ดูพฤติกรรมและหลักฐานเพื่อสรุปปัญหา UX ที่ควรแก้",
  },
];

const reviewLinks = [
  { label: "การทดสอบ", href: "/projects" },
  { label: "แบบหน้าจอ (ตัวอย่าง)", href: "/high-fi" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="เมนูหลัก">
          <a className="navItem active" href="#overview" aria-current="page">ภาพรวม</a>
          {reviewLinks.map((item) => (
            <a className="navItem" href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ทดสอบการใช้งานและ UX QA</p>
            <h1>เป้าหมายทดสอบ → หลักฐาน → การตัดสินใจ UX</h1>
          </div>
          <a className="primaryButton" href="/projects">เริ่มสร้างการทดสอบ</a>
        </header>

        <section id="overview" className="heroCard">
          <div>
            <span className="status">โฟลว์หลัก</span>
            <h2>ลิงก์ Prototype หรือ UAT → งาน User Test → Report</h2>
            <p>
              เพิ่มลิงก์เป้าหมายทดสอบ กำหนดงานให้ผู้เข้าร่วม แล้วดูรายงานจากผลที่เกิดขึ้นจริง
            </p>
          </div>
        </section>

        <section id="modules" className="section">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">โฟลว์ผลิตภัณฑ์</p>
              <h2>สามขั้นจากลิงก์สู่รายงาน</h2>
            </div>
          </div>

          <div className="cardGrid">
            {workflowSteps.map((step, index) => (
              <article className="moduleCard" key={step.title}>
                <span className="moduleIndex">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

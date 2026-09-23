const modules = [
  {
    title: "สร้างการทดสอบ",
    description: "เลือกเป้าหมายทดสอบ กำหนดงาน กฎ และคำถามหลังงานในโฟลว์เดียว",
  },
  {
    title: "ผู้เข้าร่วมทดสอบ",
    description: "ให้ผู้เข้าร่วมทำงานกับเป้าหมายทดสอบโดยลดสิ่งรบกวนและไม่เปิดเผยเกณฑ์สำเร็จ",
  },
  {
    title: "บันทึกพฤติกรรม",
    description: "เก็บเฉพาะเหตุการณ์ที่เป้าหมายรองรับ พร้อมสถานะความสามารถและหลักฐานที่ตรวจสอบย้อนกลับได้",
  },
  {
    title: "วิเคราะห์ผล",
    description: "ดูความสำเร็จ เวลา เส้นทาง และการโต้ตอบตามความสามารถของเป้าหมาย โดยไม่ตีความ Unsupported เป็นศูนย์",
  },
  {
    title: "ประเด็นที่พบและทดสอบซ้ำ",
    description: "เปลี่ยนหลักฐานเป็นประเด็น UX แล้วเปรียบเทียบผลหลังปรับแบบบนเวอร์ชันที่ตรวจสอบย้อนกลับได้",
  },
];

const reviewLinks = [
  { label: "Researcher", href: "/projects" },
  { label: "หน้าจอผลิตภัณฑ์", href: "/high-fi" },
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
          <a className="primaryButton" href="/login">เข้าสู่ Researcher Workspace</a>
        </header>

        <section id="overview" className="heroCard">
          <div>
            <span className="status">โฟลว์หลัก</span>
            <h2>เลือกเป้าหมาย สร้างงาน เก็บพฤติกรรม แล้วเปลี่ยนหลักฐานเป็นสิ่งที่ต้องแก้</h2>
            <p>
              รุ่นปัจจุบันรองรับเป้าหมายทดสอบแบบ Figma Prototype, เว็บไซต์ UAT/Production ที่ทีมควบคุม
              และเว็บไซต์ภายนอกตามความสามารถที่ตรวจสอบได้ พร้อมเซสชันผู้เข้าร่วม การวิเคราะห์ผล
              ประเด็นที่พบ และการเปรียบเทียบการทดสอบซ้ำ
            </p>
          </div>
          <div className="metricGrid" aria-label="สรุปขอบเขตหน้าจอและสถานะ QA">
            <div className="metric"><strong>5</strong><span>โมดูลหลัก</span></div>
            <div className="metric"><strong>48</strong><span>หน้าจอหลัก</span></div>
            <div className="metric"><strong>170</strong><span>สถานะ QA</span></div>
          </div>
        </section>

        <section id="modules" className="section">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">โฟลว์ผลิตภัณฑ์</p>
              <h2>จากเป้าหมายทดสอบสู่การปรับ UX</h2>
            </div>
          </div>

          <div className="cardGrid">
            {modules.map((module, index) => (
              <article className="moduleCard" key={module.title}>
                <span className="moduleIndex">0{index + 1}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

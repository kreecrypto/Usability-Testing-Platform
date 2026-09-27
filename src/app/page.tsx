const modules = [
  {
    title: "สร้างการทดสอบ",
    description: "สร้างแบบทดสอบ เลือกเป้าหมาย และกำหนดงานให้ผู้เข้าร่วม",
  },
  {
    title: "ผู้เข้าร่วมทดสอบ",
    description: "ส่งลิงก์ให้ผู้เข้าร่วมทำงานโดยไม่เปิดเผยเกณฑ์สำเร็จ",
  },
  {
    title: "บันทึกพฤติกรรม",
    description: "เก็บพฤติกรรมที่เป้าหมายทดสอบรองรับและตรวจสอบหลักฐานย้อนหลังได้",
  },
  {
    title: "วิเคราะห์ผล",
    description: "ดูความสำเร็จ เวลา เส้นทาง และจุดติดขัด โดยแยกข้อมูลที่ไม่มีออกจากค่า 0",
  },
  {
    title: "ประเด็นที่พบและทดสอบซ้ำ",
    description: "บันทึกประเด็น UX จากหลักฐาน แล้วเปรียบเทียบผลหลังปรับแบบ",
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
            <h2>เริ่มจากงานที่อยากเรียนรู้ แล้วใช้พฤติกรรมจริงช่วยตัดสินใจ</h2>
            <p>
              สร้างงานทดสอบกับ Figma Prototype หรือเว็บไซต์ที่รองรับ ส่งลิงก์ให้ผู้เข้าร่วม
              แล้วดูหลักฐานเพื่อระบุปัญหาและทดสอบซ้ำหลังแก้ไข
            </p>
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

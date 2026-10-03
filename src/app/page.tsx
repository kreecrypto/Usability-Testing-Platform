const modules = [
  {
    title: "สร้างการทดสอบ",
    description: "เลือกต้นแบบหรือเว็บไซต์ เขียนงานให้ผู้เข้าร่วมทำ แล้วตรวจแบบทดสอบก่อนเผยแพร่",
  },
  {
    title: "ผู้เข้าร่วมทดสอบ",
    description: "ส่งลิงก์ให้ผู้เข้าร่วมทำงานทีละขั้น โดยไม่บอกคำตอบที่คาดหวัง",
  },
  {
    title: "บันทึกพฤติกรรม",
    description: "บันทึกสิ่งที่เกิดขึ้นระหว่างทดสอบ และแยกปัญหาทางเทคนิคออกจากปัญหาการใช้งาน",
  },
  {
    title: "วิเคราะห์ผล",
    description: "ดูผลพร้อมจำนวนผู้เข้าร่วมและหลักฐานของแต่ละรอบ ข้อมูลที่เก็บไม่ได้จะแสดงเหตุผล",
  },
  {
    title: "ประเด็นที่พบและทดสอบซ้ำ",
    description: "บันทึกสิ่งที่ควรแก้ อ้างอิงหลักฐาน และเทียบผลเมื่อทดสอบเวอร์ชันใหม่",
  },
];

const reviewLinks = [
  { label: "ทดลองทำงานกับเว็บบ้านเรา", href: "/trial" },
  { label: "ดู Demo", href: "/demo/projects" },
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
            <p className="eyebrow">UT Platform</p>
            <h1>ทดสอบการใช้งานกับผู้ใช้จริง</h1>
          </div>
          <a className="primaryButton" href="/demo/projects">ดูตัวอย่างการทำงาน</a>
        </header>

        <p><a className="primaryButton" href="/trial">เริ่มทดลองกับเว็บบ้านเรา</a> · สร้างแบบทดสอบและบันทึกคำตอบในเบราว์เซอร์นี้ ไม่ต้องเข้าสู่ระบบ</p>

        <section id="overview" className="heroCard">
          <div>
            <span className="status">ตัวอย่างแบบอ่านอย่างเดียว</span>
            <h2>จากแบบทดสอบถึงสิ่งที่ควรแก้</h2>
            <p>
              สำรวจตัวอย่างโปรเจกต์ ดูงานที่ให้ผู้เข้าร่วมทำ แล้วตามผลกลับไปถึงหลักฐาน ข้อค้นพบ และการทดสอบซ้ำ
              ข้อมูลใน Demo เป็นเรื่องสมมติ ไม่ใช่ผลจากผู้เข้าร่วมจริง
            </p>
          </div>
          <div className="metricGrid" aria-label="ลำดับการทำงาน">
            <div className="metric"><strong>1</strong><span>เตรียมแบบทดสอบ</span></div>
            <div className="metric"><strong>2</strong><span>ดูผลและหลักฐาน</span></div>
            <div className="metric"><strong>3</strong><span>แก้ไขและทดสอบซ้ำ</span></div>
          </div>
        </section>

        <section id="modules" className="section">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">วิธีทำงาน</p>
              <h2>แต่ละขั้นช่วยให้ตัดสินใจจากหลักฐาน</h2>
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

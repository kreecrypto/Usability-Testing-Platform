
export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(460px, 100%)", background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: "var(--ah-radius-lg)", padding: 28, boxShadow: "var(--ah-shadow-card)" }}>
        <p className="eyebrow">UT Platform</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>ดูตัวอย่างการทำงาน</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ah-slate)", lineHeight: 1.6 }}>การเข้าสู่ระบบยังไม่เปิดให้ใช้งาน คุณสามารถดูตัวอย่างแบบอ่านอย่างเดียว ตั้งแต่โปรเจกต์จนถึงรายงานได้โดยไม่ต้องมีบัญชี ข้อมูลทั้งหมดเป็นเรื่องสมมติ</p>
        <a className="primaryButton" href="/demo/projects" style={{ width: "100%" }}>ไปที่โปรเจกต์ตัวอย่าง</a>
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><a href="/">กลับหน้าหลัก</a></p>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(460px, 100%)", background: "var(--ah-canvas)", border: "1px solid var(--ah-hairline)", borderRadius: "var(--ah-radius-lg)", padding: 28, boxShadow: "var(--ah-shadow-card)" }}>
        <p className="eyebrow">UT Platform</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>สำรวจ UTP Demo</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ah-slate)", lineHeight: 1.6 }}>หน้าเข้าสู่ระบบพักการใช้งานชั่วคราว ระหว่างพัฒนาพื้นที่ทำงานภายใน คุณสามารถดูเส้นทางตัวอย่างได้โดยไม่ต้องมีบัญชี ข้อมูลทั้งหมดเป็นข้อมูลสังเคราะห์และอ่านอย่างเดียว</p>
        <Link className="primaryButton" href="/demo/projects" style={{ width: "100%" }}>เปิด Demo แบบอ่านอย่างเดียว</Link>
        <p style={{ margin: "18px 0 0", textAlign: "center" }}><Link href="/">กลับหน้าหลัก</Link></p>
      </section>
    </main>
  );
}

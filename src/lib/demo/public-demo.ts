// Public product tour content. It is never read from or written to Supabase.
export const demoSteps = [
  { slug: "projects", label: "โปรเจกต์" },
  { slug: "test", label: "แบบทดสอบ" },
  { slug: "results", label: "ผลการทดสอบ" },
  { slug: "findings", label: "ข้อค้นพบ" },
  { slug: "report", label: "รายงาน" },
  { slug: "retest", label: "ทดสอบซ้ำ" },
] as const;

export type DemoStep = (typeof demoSteps)[number]["slug"];

export const demoStudy = {
  project: "ตัวอย่าง · ปรับขั้นตอนสมัครใช้งาน",
  test: "ค้นหาจุดติดขัดในขั้นตอนสมัคร",
  target: "เว็บไซต์ตัวอย่าง",
  task: "สมัครใช้งานให้เสร็จและหาหน้ายืนยัน",
  baselineVersion: "ตัวอย่าง v1",
  retestVersion: "ตัวอย่าง v2",
  sessions: [
    { id: "S01", outcome: "สำเร็จ", path: "เริ่ม → ข้อมูลส่วนตัว → ยืนยัน", note: "ผ่านโดยตรง" },
    { id: "S02", outcome: "สำเร็จ", path: "เริ่ม → ข้อมูลส่วนตัว → ย้อนกลับ → ยืนยัน", note: "กลับไปตรวจข้อมูล" },
    { id: "S03", outcome: "สำเร็จ", path: "เริ่ม → ข้อมูลส่วนตัว → ยืนยัน", note: "ผ่านโดยตรง" },
    { id: "S04", outcome: "ไม่สำเร็จ", path: "เริ่ม → ข้อมูลส่วนตัว → กลับหน้าแรก", note: "หาปุ่มดำเนินการต่อไม่พบ" },
    { id: "S05", outcome: "ยุติ", path: "เริ่ม → ข้อมูลส่วนตัว", note: "หยุดก่อนส่งข้อมูล" },
    { id: "S06", outcome: "ติดปัญหาทางเทคนิค", path: "เริ่ม → โหลดหน้าไม่สำเร็จ", note: "ไม่นับเป็นปัญหาการใช้งาน" },
  ],
  retest: { eligible: 5, success: 4, technical: 1 },
} as const;

export const demoMetrics = {
  baselineEligible: demoStudy.sessions.filter((session) => session.outcome !== "ติดปัญหาทางเทคนิค").length,
  baselineSuccess: demoStudy.sessions.filter((session) => session.outcome === "สำเร็จ").length,
  baselineTechnical: demoStudy.sessions.filter((session) => session.outcome === "ติดปัญหาทางเทคนิค").length,
};

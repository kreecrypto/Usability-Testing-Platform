export const mainNavigation = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/projects", label: "โปรเจกต์" },
] as const;
export const methodLabels: Record<string, string> = {
  survey: "แบบสอบถาม", card_sort: "จัดกลุ่มข้อมูล", tree_test: "ค้นหาข้อมูลในโครงสร้างเมนู",
};
export const severityLabels: Record<string, string> = {
  critical: "วิกฤต", high: "สูง", medium: "กลาง", low: "ต่ำ",
};
export const workflowLabels = ["ตั้งค่า", "ตรวจสอบและเผยแพร่", "เชิญผู้เข้าร่วม", "ผลการทดสอบ", "ข้อค้นพบ", "รายงาน", "ทดสอบซ้ำ"] as const;
export function friendlyError(error: unknown, fallback = "โหลดข้อมูลไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง"): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/permission|forbidden|access_denied/.test(text)) return "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้ ติดต่อเจ้าของโปรเจกต์เพื่อขอสิทธิ์";
  if (/not_found/.test(text)) return "ไม่พบข้อมูลนี้ กลับไปเลือกแบบทดสอบจากโปรเจกต์อีกครั้ง";
  if (/unsupported/.test(text)) return "วิธีทดสอบนี้ยังไม่รองรับการทำงานดังกล่าว กลับไปตรวจการตั้งค่าแบบทดสอบ";
  return /[ก-๙]/.test(text) ? text : fallback;
}

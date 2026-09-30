const reasonLabels: Readonly<Record<string, string>> = {
  metric_definition_mismatch: "นิยามตัวชี้วัดไม่ตรงกันหรือไม่มีข้อมูล",
  aggregation_version_mismatch: "วิธีรวมผลต่างกันหรือไม่มีข้อมูล",
  target_context_missing: "ข้อมูลเป้าหมายของบางเวอร์ชันไม่ครบ",
  evidence_unavailable: "หลักฐานของบางรอบยังไม่พร้อม",
  scope_mismatch: "ขอบเขตงานที่วัดต่างกัน",
  rule_version_mismatch: "กติกาที่ใช้วัดต่างกัน",
  capability_mismatch: "ความสามารถในการเก็บหลักฐานต่างกัน",
  no_eligible_data: "ยังไม่มีข้อมูลที่นำมาเปรียบเทียบได้",
  eligibility_context_missing: "จำนวนที่ใช้คำนวณอัตราไม่ครบ",
  eligibility_context_mismatch: "จำนวนที่ใช้คำนวณอัตราไม่ตรงกับกลุ่มตัวอย่าง",
};

export function retestReasonLabel(reason: string): string {
  return reasonLabels[reason] ?? "ยังตรวจสอบความเทียบเคียงไม่ได้";
}

## ปัญหาและพฤติกรรมหลังแก้

<!-- บอกปัญหาของผู้ใช้และผลที่เปลี่ยน ไม่เล่าลำดับการทำงาน -->

## ข้อกำหนดและขอบเขต

- Task ID / ลิงก์ Google Sheet หรือแผนที่ผู้ใช้อนุมัติ:
- Acceptance criteria:
- Dependency / ownership / MAJOR lease เมื่อเกี่ยวข้อง:
- API/schema/version/evidence impact หรือไม่มี พร้อมเหตุผล:

## หลักฐาน QA

| Check / scenario | ผล | หลักฐานและข้อจำกัด |
| --- | --- | --- |
| Tests ที่เกี่ยวข้อง | PASS / FAIL / N/A | คำสั่ง + commit; ระบุ fixture/Trial/จริง |
| Typecheck / build | PASS / FAIL / N/A | คำสั่ง หรือเหตุผลที่ไม่เกี่ยวข้อง |
| Design / browser / responsive / keyboard | PASS / FAIL / N/A | scenario + URL/หลักฐาน |
| Preview / Production | PASS / FAIL / N/A | URL + commit + release scope |

<!-- ไม่มี lint script แยก อย่าอ้าง lint PASS; documentation-only ใช้ N/A พร้อมเหตุผลได้ -->

## Release และงานค้าง

- สถานะ / blocker / dependency ที่ยังค้าง:
- Release gate ที่เกี่ยวข้องและหลักฐาน หรือ N/A พร้อมเหตุผล:
- Rollback candidate เมื่อปล่อย runtime:
- ขั้นถัดไป:

- [ ] Diff ตรงขอบเขตและไม่เผย secrets
- [ ] AC และผล QA ระบุครบ; self-review ไม่อ้าง independent review
- [ ] Sheet บันทึกหลักฐานตามสถานะจริง; ไม่ใช้ Demo/Trial ปิด gate วิจัย

ดู [คู่มือทีม](../docs/team-workflow.md)

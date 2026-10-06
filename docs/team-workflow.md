# ทีมและ Workflow พัฒนา UTP

แผนที่ผู้ใช้อนุมัติวันที่ 6 ตุลาคม 2026 (Asia/Bangkok): **คุณ + Codex** เป้าหมายคือพัฒนาเส้นทาง Project → Test → Participant → Results → Finding → Report → Retest โดยทุกข้อสรุปตรวจย้อนกลับถึงหลักฐานได้

## บทบาทและการตัดสินใจ

บทบาทด้านล่างเป็นหน้าที่ของสองฝ่าย ไม่ใช่การสร้าง Agent หรือเปิด automation ใหม่

| บทบาท | ผู้รับผิดชอบ | ผลงานที่ส่งต่อ |
| --- | --- | --- |
| Product Owner | คุณ | เป้าหมายผู้ใช้ ขอบเขต ลำดับความสำคัญ และข้อยกเว้นที่อนุมัติ |
| Product Analyst | Codex | Task ID จาก Sheet, dependency, acceptance criteria และขอบเขตที่ทำได้ |
| UX/UI Designer | Codex | Flow, สถานะหน้าจอ, ข้อความภาษาไทย และ AH Design System |
| Tech Lead / Developer | Codex | ตรวจ implementation เดิม พัฒนา contract/frontend/API/migration ที่จำเป็น และ PR |
| QA | Codex + คุณ | Codex ตรวจอัตโนมัติและ Preview; คุณช่วยบัญชีจริงหรือสิทธิ์ที่ Codex เข้าไม่ถึง |
| Release Engineer | Codex | ตรวจ CI, commit/runtime, release gate และ rollback candidate |
| Account Owner | คุณ | บัญชี billing สิทธิ์ และ repo/URL ของเว็บเป้าหมาย |

คุณตัดสินใจการเปลี่ยนเป้าหมายหรือขอบเขต ส่วน Codex ตัดสินใจ implementation ภายในขอบเขตที่อนุมัติได้โดยไม่ถามซ้ำ การตรวจงานโดย Codex เป็น self-review ต้องไม่อ้างว่าเป็น independent review และห้ามขอให้คุณส่งรหัสผ่าน

## แหล่งงานและขอบเขตการทำงาน

- [Google Sheet — Task List](https://docs.google.com/spreadsheets/d/1car-7heRkDkN2RBiJvD3qr8WlbS2rvFUYSepQS7ABOQ/edit): requirement, priority, dependency, acceptance และสถานะงาน; Feature Tasks ใช้สำหรับงานส่วนขยายที่อนุมัติ
- GitHub: implementation, contract, migration, tests และ PR ส่วน GitHub issue เป็นเอกสารส่งต่อ ต้องอ้าง Task ID และแถวใน Sheet ไม่เป็นคิวงานอีกชุด
- Vercel: runtime evidence; Supabase: data/Auth ตาม contract เดิม ใช้ Next.js + React + TypeScript และ AH Design System ไม่เพิ่ม Cloudflare หรือใช้ Notion เป็นแหล่งงานหลัก
- ทำ implementation หลักครั้งละหนึ่งงานในเซสชันนี้ ก่อนเลือกงานใหม่ให้ปิด QA หรือบันทึก blocker ของงานเดิม
- ตาราง Agent Workstreams และตารางเวลาเดิมยังคงอยู่ คู่มือนี้ไม่เปลี่ยน owner, ไม่เปิดงานพร้อมกัน และไม่แทน [MAJOR execution/lease](major-auto-execution.md) ก่อนแตะงานที่อยู่ใน MAJOR ต้องตรวจ claim/lease ตามกติกาเดิม; หากตรวจ ownership ไม่ได้ ให้หยุด mutation เฉพาะส่วนนั้น

## Workflow และเกณฑ์ส่งต่อ

| ขั้น | สิ่งที่ทำ | ผ่านเมื่อ |
| --- | --- | --- |
| 1. เลือกงาน | อ่าน Sheet ล่าสุด เลือก IN_PROGRESS → QA → P0 → P1 → P2 → self-fixable ที่ dependency พร้อม | มี Task ID จริงและไม่ทับ owner/lease |
| 2. เตรียมงาน | ระบุเป้าหมาย ขอบเขต AC, dependency, route, ความเสี่ยงและวิธี QA; อัปเดตข้อกำหนดก่อนโค้ดเมื่อขอบเขตเปลี่ยน | ไม่มี SOURCE GAP ที่ขัดขวางส่วนที่จะทำ |
| 3. ออกแบบ | ตรวจโค้ด/tests/contract เดิม วาง flow, empty/error/recovery และข้อมูลที่ต้องใช้ | UX และ contract อยู่ในขอบเขตที่อนุมัติ |
| 4. พัฒนา | แยก branch/PR ตามงาน รักษา URL, version และ evidence เดิมตาม contract | diff ตรวจสอบได้และไม่มี scope ที่ไม่รองรับ |
| 5. QA | รัน checks ที่เกี่ยวข้อง แก้ failure แล้วรันซ้ำ | AC มีหลักฐานและไม่มี Critical ของงานนั้น |
| 6. Preview | ตรวจ flow จริงบน commit ที่จะปล่อย พร้อมข้อมูล/บัญชีที่จำเป็น | บันทึก URL, commit และข้อจำกัดของผลทดสอบ |
| 7. Release | ตรวจ dependency และ gate ของรุ่นนั้นก่อน merge/deploy | ไม่มี gate ที่ยังขาดหลักฐาน |
| 8. Production | ตรวจ commit, health, flow, runtime errors และ rollback candidate | หลักฐานหลัง deploy สอดคล้องกับรุ่นที่ปล่อย |
| 9. ปิดและส่งต่อ | บันทึกสถานะและหลักฐานใน Sheet อ่านคิวใหม่ | COMPLETE เฉพาะ scope ที่ผ่านจริง |

สำหรับ documentation/process-only PR ให้ตรวจเนื้อหา ลิงก์ รูปแบบ template และ diff; ไม่ต้องอ้าง app QA หรือ deploy เพื่อปิดเอกสาร ส่วนงาน runtime ต้องผ่านขั้น Preview/Production ตาม release scope จริง

## QA และหลักฐาน

ตรวจ scripts ใน `package.json` ของ branch ที่ทำงานทุกครั้ง ปัจจุบัน main รองรับ `npm test`, `npm run typecheck`, `npm run build`, `npm run check:design-system`, `npm run check:high-fi` และ demo checks ไม่มี lint script แยก จึงไม่อ้าง lint PASS ใช้ browser tests เพิ่มเมื่อ branch มี script และ flow ที่เปลี่ยนต้องตรวจจริง

- UI: desktop, 320/390px, keyboard/focus, labels และสถานะ empty/error/permission/No Data ที่เกี่ยวข้อง
- Tracking: consent, start/stop, retry/deduplication และ accepted event/session/version IDs
- Analytics: คำนวณกลับจากหลักฐาน, No Data ไม่แทนด้วย 0, technical block แยกจาก usability failure
- Finding/Report/Retest: ตรวจ exact evidence subset, immutable published version และ comparability
- Auth/data: caller permissions, workspace isolation และ migration/RLS QA ตาม scope; ไม่ใช้ service-role ข้ามสิทธิ์ผู้ใช้

ทุกผล QA ระบุคำสั่ง ผล commit และชนิดข้อมูลจริง/fixture/Trial ให้ชัด CI ผ่านหรือ Vercel READY ไม่เท่ากับผ่าน release gate ดู [proof gates](proof-gate-execution.md) และ [release order](release-gate-order.md)

## สถานะและการแก้ blocker

| สถานะ | สิ่งที่ทำต่อ |
| --- | --- |
| IN_PROGRESS / QA | ทำงานหรือปิดข้อผิดพลาดที่ยังเหลือ |
| TODO_EXECUTABLE | เริ่มเมื่อ dependency และ ownership พร้อม |
| BLOCKED_SELF_FIXABLE | Codex แก้ด้วย code/config/test แล้วตรวจซ้ำ |
| BLOCKED_EXTERNAL | ระบุ input/บัญชี/billing/source ที่ขาด และเดินงานอิสระที่ทำได้ |
| TODO_DEPENDENCY_BLOCKED | ระบุ Task ID ที่ต้องผ่านก่อน |
| COMPLETE | acceptance และ QA/evidence ครบเฉพาะขอบเขตนั้น |

ใช้ค่าที่ dropdown ใน Sheet รองรับ บันทึก blocker subtype ในช่องรายละเอียด/หมายเหตุเมื่อ dropdown ไม่มีค่านั้น ห้ามแก้ validation เพื่อฝืนใส่สถานะหรือ owner และห้ามให้การปิด subtask ปิด parent/release gate โดยอัตโนมัติ

## แบบส่งต่องาน

ใช้ [Task template](../.github/ISSUE_TEMPLATE/task.md) และ [PR template](../.github/PULL_REQUEST_TEMPLATE.md) ทุกครั้ง ข้อมูลขั้นต่ำ:

```text
Task ID / ลิงก์ Sheet:
เป้าหมายผู้ใช้ / scope:
Priority / dependency / ownership:
Acceptance criteria:
สิ่งที่เปลี่ยน / PR / commit:
QA: คำสั่ง ผล หลักฐาน และข้อจำกัด:
Preview / Production: URL + commit หรือ N/A พร้อมเหตุผล:
สถานะ / blocker / input ที่ต้องการ:
ขั้นถัดไป:
```

เริ่มแต่ละรอบด้วยคิวและ dependency ล่าสุด จบรอบด้วยหลักฐานและงานถัดไป ไม่สร้าง schedule เพิ่มเอง

## จุดเริ่มใช้งานกับ UTP

ตรวจงาน Trial/Heatmap และงาน researcher จาก Sheet/GitHub ปัจจุบันก่อนเลือกงานต่อ การเชื่อม Banrao ต้องมี repo และ URL บน Vercel ที่ระบุชัด แล้วจึงตรวจ adapter, geometry/background contract และ flow จริง การผ่าน Trial/Demo ไม่เปลี่ยน FEAT-13.07 หรือ MAJOR-A/B/C และไม่ปล่อยฟีเจอร์วิจัยโดยอัตโนมัติ

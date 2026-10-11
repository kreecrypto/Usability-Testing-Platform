# PM delivery — ทีม Agent UTP

ผู้ใช้อนุมัติทีม Agent และการกระจายงานวันที่ 11 ตุลาคม 2026 (Asia/Bangkok) เอกสารนี้ต่อจาก PR #145/#146; Sheet เป็นคิวงานหลัก ไม่ใช่รายการงานใหม่หรือการรับรอง release

## Ownership และขีดจำกัด

PM 1 + Developer สูงสุด 2 + QA อิสระ 1 รวมไม่เกิน 4 Agent พร้อมกัน Developer A–D เป็นบทบาทหมุนเวียน ไม่ใช่ worker ที่เปิดพร้อมกันทั้งหมด

| บทบาท | Task เดิม / ขอบเขต | ผลส่งต่อ | เงื่อนไขเริ่ม mutation |
| --- | --- | --- | --- |
| PM | คิว, dependency, ownership, Sheet และ checkpoint | Task brief + branch/commit/PR + blocker | ตรวจ source/สิทธิ์และ lease ตามงานก่อนเขียน |
| Developer A — Workspace | FEAT-01.11 (#139), IA-05/06 (#141) | Auth/Project handoff และ real-account QA checklist | Task dependency พร้อมและไม่มี owner ทับ |
| Developer B — Data & Evidence | FEAT-13.01/.06/.07; หลักฐาน MAJOR-B/C | Migration/RLS/legacy/evidence checklist และข้อบกพร่องที่พิสูจน์ได้ | ฐานทดสอบพร้อม; MAJOR-B/C ต้องผ่าน parent gate ก่อน claim |
| Developer C — Builder/Participant | FEAT-13.02–.05, IA-02/03 | สี่วิธี, Publish, Invite/Screener, Runner recovery | รับช่วงเมื่อ contract พร้อม; ไม่แก้ schema แข่ง B |
| Developer D — Trial | TRIAL-02.P4/P5 (#155–156) | Dependency/regression/release handoff | งานใหม่ต้องมีเกณฑ์จาก Sheet; งาน COMPLETE ไม่เปิดใหม่โดยไม่มีเหตุผล |
| QA | ตรวจ commit หลัง Developer หยุดแก้ | PASS/FAIL + ข้อผิดพลาด + ข้อจำกัด | ไม่มีสิทธิ์แก้ไฟล์ของ Developer |
| Product Owner | เป้าหมาย บัญชี billing และ release | บัญชี researcher/ฐานทดสอบ/การตัดสินใจ | ไม่ขอรหัสผ่านในแชต |

## ขอบเขตรอบแรก

รอบนี้เป็น **manual readiness/handoff**: A และ B ตรวจแบบอ่านอย่างเดียวพร้อมกันจาก PR เดิม PM บันทึกผล และ QA ตรวจเอกสาร commit อิสระ ไม่ใช่การรัน scheduler หรือ claim MAJOR-A/B/C ข้าม dependency ไม่มีการแก้ App, Auth/RLS, schema หรือข้อมูล Production

หลักฐานเริ่มต้น: Sheet Task Hierarchy A1:L13, Feature Tasks A160:P198, Agent Workstreams A1:N35 และ GitHub #139/#141/#145/#146/#156 อ่านสดวันที่ 11 ตุลาคม 2026

| งาน | สถานะที่ source ระบุ | ขั้นถัดไป |
| --- | --- | --- |
| FEAT-01.11 | QA; real account BLOCKED_EXTERNAL | ทดสอบ signup/confirmation/Login/Workspace/refresh/logout/recovery บน exact #139 Preview |
| IA-05/06/07 | QA; real account/dev DB ยังไม่พร้อม | ตรวจ Project/Test/version/evidence บน #141 เมื่อบัญชีและฐานพร้อม |
| FEAT-13.07 | TODO_DEPENDENCY_BLOCKED | live migration/RLS + สี่วิธี + MAJOR-A/B/C ก่อน release |
| MAJOR-A | IN PROGRESS | บัญชีจริงและ FP-01–09; Trial/fixture แทนไม่ได้ |
| MAJOR-B/C | TODO_DEPENDENCY_BLOCKED | เตรียม checklist ได้ แต่ยัง claim/ปิด gate ไม่ได้ |
| TRIAL-02.P4/P5 | COMPLETE เฉพาะ Trial/Preview | review stacked #155/#156; ยังไม่ใช่ Production research evidence |

## Handoff และการกลับมาทำต่อ

ทุกใบงานระบุ Task ID + source/row, ขอบเขต/AC, dependency, owner, route/contract, branch/base, exact commit, checks, PR/Preview, blocker และ next step ใช้ [Task template](../.github/ISSUE_TEMPLATE/task.md) และ [PR template](../.github/PULL_REQUEST_TEMPLATE.md)

Developer → Commit → QA → แก้ → QA ซ้ำ → PR/Preview → PM บันทึก Sheet งานที่เปลี่ยน commit ต้อง review ใหม่ ไม่ให้ผู้พัฒนารับรองตนเองแทน QA และไม่สร้าง PR ซ้ำเมื่อกลับมาทำต่อ ตรวจ local/remote tree เมื่อ SHA ต่างกัน

งานพัฒนาต้องใช้ worktree แยกจากฐาน dependency จริง โดยเฉพาะ #139/#141 และ Trial stack ห้ามอาศัย Trial branch เป็นฐาน researcher โดยไม่ตรวจ contract งานที่แก้ shared component/schema/API ให้ serialize และกำหนด single writer

PM เป็นผู้เขียน Sheet เพียงคนเดียวในทีมนี้ แต่ไม่แทน active owner จากระบบอื่น ตรวจ lease จริงก่อน mutation ของ MAJOR; หาก claim ไม่ได้ให้หยุดส่วนนั้น ตรวจ refresh ก่อนเขียนและหยุดเมื่อ lease หาย ดู [runbook Agentic](agentic-development.md) สำหรับ checkpoint/lease protocol

## QA และ release

Document-only: ตรวจ diff, Markdown links, source/task/PR mapping และ independent review ไม่อ้าง app build หรือ runtime proof ใหม่จากเอกสาร งาน App ใช้ scripts ของ branch จริง: tests, typecheck, build, design/high-fi และ browser checks ที่มี ไม่มี lint script จึงไม่อ้าง lint ผ่าน

Research QA: บัญชีจริง, exact version/session/event/response IDs, No Data, technical block, retry, RLS ข้าม workspace, invite expiry/replay, deletion, legacy sessions, desktop/320/390px และ keyboard ต้องมีหลักฐานตาม Task

บัญชี/billing/source ที่ขาดเป็น BLOCKED_EXTERNAL; ปัญหา code/config/migration ที่แก้ได้เป็น BLOCKED_SELF_FIXABLE โดยไม่เดาสาเหตุ MIGRATIONS_FAILED; gate ที่รอ parent เป็น TODO_DEPENDENCY_BLOCKED

Automation `utp-agentic-development-team` ยังคง PAUSED และ config read_only; ไม่สร้าง scheduler ใหม่ ไม่แก้ Agent Workstreams เดิม การเริ่ม manual readiness agents ไม่ใช่ successful live pilot และไม่เปิด writer

ไม่มี auto-merge/Production deploy งาน release ต้องผ่าน FEAT-13.07 + MAJOR-A/B/C และการตัดสินใจเจ้าของผลิตภัณฑ์ ไม่เปลี่ยน gate จากผลทีม/Trial/Demo QA

ผลส่งต่อรอบแรกบันทึกใน [PM readiness evidence](qa/pm-readiness.md)

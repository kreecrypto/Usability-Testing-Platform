# UTP UX writing contract

Source: current UTP Task List, researcher/participant flows, and the public Demo. This document defines user-facing language, not implementation status or release approval.

## One task at a time

Researcher journey: โปรเจกต์ → สร้างแบบทดสอบ → ตรวจสอบและเผยแพร่ → ส่งลิงก์ให้ผู้เข้าร่วม → ดูผลและหลักฐาน → บันทึกข้อค้นพบ → รายงาน → ทดสอบซ้ำ. Each page should name the current task, say what is needed to continue, and provide a next action that matches its destination. Participants only see consent, one task at a time, progress, and recovery instructions. They never see expected paths or success rules.

## Terms

| Internal / mixed term | User-facing term | Use |
| --- | --- | --- |
| Test Target / provider | สิ่งที่ทดสอบ | Explain Figma prototype or website only when the choice matters. |
| Study / Test | แบบทดสอบ | One configured research study. |
| Published Test Version | เวอร์ชันที่เผยแพร่ | Preserve exact ID in secondary details. |
| session | รอบการทดสอบ | Keep the ID when evidence tracing is needed. |
| evidence | หลักฐาน | Link to the relevant round, answer, or metric. |
| Finding | ข้อค้นพบ | A researcher interpretation linked to evidence. |
| Report | รายงาน | Summary for a decision; link claims back to evidence. |
| Retest | ทดสอบซ้ำ | Compare compatible versions and sample context. |
| capability / unsupported | ยังไม่รองรับข้อมูลนี้ | Explain the missing signal and what can be viewed instead. |
| No Data | ยังไม่มีข้อมูลที่นำมาคำนวณได้ | Do not display a synthetic zero. |

## States and claims

- Empty: explain what is absent and the next supported action. Do not infer that zero participants failed.
- Partial: show what is available and what remains unverified.
- Unsupported: say which signal cannot be collected for this test target; do not suggest that retrying will create it.
- Permission: say access is unavailable and direct the user to the workspace owner, without exposing restricted data.
- Network/error: name the failed operation and offer retry when retry is safe.
- Demo: label every screen and metric as synthetic, read-only example content. Never claim it proves a live research result or release readiness.
- Availability: distinguish implemented code, Preview-only work, and Production-released behavior. Do not describe blocked research methods as currently available on Production.

## Copy review

For each route and state, check: Who is reading? What can they do here? What is the next step? Does every button name match the destination/action? Can a metric or claim be traced to the correct version and evidence? Does the copy remain accurate for signed-out, empty, draft, published, closed, denied, network-error, and No Data states?

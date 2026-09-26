"use client";

import { useMemo, useState, type ReactNode } from "react";
import screenMap from "../../../docs/design-system/screen-component-map.json";
import "./high-fi.css";
import "./predeploy-fixes.css";

type Screen = (typeof screenMap.screens)[number];
type Viewport = "desktop" | "mobile";
type Tone = "neutral" | "loading" | "error" | "restricted" | "unsupported" | "empty" | "warning" | "success";
type Audience = "researcher" | "participant";
type NavKey = "Projects" | "Tests" | "Results" | "Participants" | "Settings" | null;

const REVIEW_DATA_BOUNDARY = "design-only:no-production-data";
const screens = screenMap.screens as Screen[];
const totalStates = screens.reduce((sum, screen) => sum + screen.states.length, 0);

const screenThaiNames: Record<string, string> = {
  S01: "ทางเข้าใช้งาน", S02: "สร้างเวิร์กสเปซ", S03: "หน้าหลัก", S04: "โปรเจกต์", S05: "สร้างโปรเจกต์", S06: "ภาพรวมโปรเจกต์",
  S07: "การทดสอบ", S08: "สร้างการทดสอบ", S09: "สร้างแบบทดสอบ", S10: "เชื่อมต่อ Figma", S11: "ตรวจสอบการเข้าถึง Figma", S12: "ต้นแบบและจุดเริ่มต้น",
  S13: "งานทดสอบ", S14: "เกณฑ์สำเร็จและไม่สำเร็จ", S15: "คำถามหลังงาน", S16: "ตรวจสอบความพร้อม", S17: "ตั้งค่าพรีวิว", S18: "พรีวิวการทดสอบ",
  S19: "ตรวจสอบก่อนเผยแพร่", S20: "แชร์การทดสอบ", S21: "ผลการทดสอบ", S22: "ภาพรวมผล", S23: "ผลรายงาน", S24: "เส้นทางการใช้งาน",
  S25: "ฮีตแมป", S26: "เซสชัน", S27: "รายละเอียดเซสชัน", S28: "ประเด็นที่พบ", S29: "แก้ไขประเด็นที่พบ", S30: "เปรียบเทียบการทดสอบซ้ำ",
  S31: "ผู้เข้าร่วม", S32: "ลบข้อมูล", S33: "ตั้งค่าเวิร์กสเปซ", S34: "สมาชิกและสิทธิ์", S35: "การเชื่อมต่อ Figma", S36: "ความเป็นส่วนตัวและระยะเวลาเก็บข้อมูล",
  P01: "ตรวจสอบแบบทดสอบ", P02: "ความยินยอม", P03: "เริ่มงาน", P04: "ทำงานกับต้นแบบ", P05: "ยืนยันการยุติงาน", P06: "คำถามหลังงาน",
  P07: "งานถัดไป", P08: "เสร็จสิ้น", P09: "ลิงก์ใช้ไม่ได้", P10: "ไม่สามารถดำเนินการต่อ", P11: "หมดเวลา", P12: "เชื่อมต่ออีกครั้ง",
};

const stateThaiNames: Record<string, string> = {
  Default: "ปกติ", Loading: "กำลังโหลด", Error: "เกิดข้อผิดพลาด", Empty: "ยังไม่มีข้อมูล", Validation: "ต้องตรวจสอบข้อมูล", Ready: "พร้อม",
  Draft: "ฉบับร่าง", Published: "เผยแพร่แล้ว", Closed: "ปิดแล้ว", Restricted: "ไม่มีสิทธิ์", Filter: "กรองข้อมูล", Search: "ค้นหา",
  "Search/Filter": "ค้นหาและกรอง", "Submit Loading": "กำลังบันทึก", "Empty Tests": "ยังไม่มีการทดสอบ", "Empty Findings": "ยังไม่มีประเด็นที่พบ",
  "Test-type selection": "เลือกประเภทการทดสอบ", Incomplete: "ตั้งค่ายังไม่ครบ", Validating: "กำลังตรวจสอบ", "Permission Restricted": "ไม่มีสิทธิ์",
  "URL Entered": "ใส่ URL แล้ว", Connecting: "กำลังเชื่อมต่อ", "Invalid URL": "URL ไม่ถูกต้อง", "Auth Error": "เข้าถึงไม่ได้", Pass: "ผ่าน",
  "Private/Login Required": "ต้องเข้าสู่ระบบ", Password: "ต้องใช้รหัสผ่าน", "Provider Error": "เชื่อมต่อผู้ให้บริการไม่ได้", "Frame Selected": "เลือกจุดเริ่มต้นแล้ว",
  "Missing Start": "ยังไม่ได้กำหนดจุดเริ่มต้น", Unsupported: "ไม่รองรับ", "Validation Error": "ข้อมูลไม่ถูกต้อง", "Multiple Tasks": "หลายงาน", Reorder: "จัดลำดับ",
  "Direct Rule": "เกณฑ์สำเร็จ", "Failure Rule": "เกณฑ์ไม่สำเร็จ", Timeout: "หมดเวลา", "Missing Rule": "ยังตั้งเกณฑ์ไม่ครบ", Conflict: "เกณฑ์ขัดแย้ง",
  SEQ: "SEQ", "Open Feedback": "คำตอบปลายเปิด", "Optional/Required": "ไม่บังคับ/บังคับตอบ", Warning: "มีจุดต้องตรวจสอบ", "Publish Blocked": "ยังเผยแพร่ไม่ได้",
  "Invalid Draft": "ฉบับร่างยังไม่พร้อม", "Provider Blocked": "ต้นแบบเข้าไม่ได้", Running: "กำลังทดสอบ", "Success Simulation": "จำลองสำเร็จ", "Exit Preview": "ออกจากพรีวิว",
  Checking: "กำลังตรวจสอบ", Blocked: "ยังดำเนินการต่อไม่ได้", "Version Changed": "เวอร์ชันเปลี่ยน", "Copy Link": "คัดลอกลิงก์", "Republish/New Version": "สร้างเวอร์ชันใหม่",
  "No Data": "ยังไม่มีข้อมูล", "Partial Data": "ข้อมูลบางส่วน", "Technical-blocked Warning": "มีเซสชันติดปัญหาทางเทคนิค", "Low Sample": "ตัวอย่างน้อย",
  "No Eligible Sessions": "ยังไม่มีเซสชันที่นำมาคำนวณ", "Expected vs Actual": "เส้นทางที่คาดไว้เทียบกับที่เกิดขึ้นจริง", "No Path Data": "ยังไม่มีข้อมูลเส้นทาง",
  "Unsupported Evidence": "หลักฐานประเภทนี้ยังไม่รองรับ", "No Clicks": "ยังไม่มีข้อมูลการคลิก", "Unsupported Provider/Transform": "ยังสร้างฮีตแมปไม่ได้", Filtered: "กรองแล้ว",
  Timeline: "ไทม์ไลน์", "Redacted Fields": "ข้อมูลบางส่วนถูกซ่อน", "Evidence Deleted": "หลักฐานถูกลบ", "Technical Blocked": "ติดปัญหาทางเทคนิค",
  Open: "เปิดอยู่", Resolved: "แก้ไขแล้ว", Create: "สร้างใหม่", Edit: "แก้ไข", "Evidence Linked": "เชื่อมหลักฐานแล้ว", "No Baseline": "ยังไม่มีข้อมูลตั้งต้น",
  "Technical-blocked Context": "มีข้อจำกัดทางเทคนิค", "Confirm Scope": "ตรวจสอบสิ่งที่จะลบ", Processing: "กำลังดำเนินการ", Complete: "เสร็จแล้ว",
  "Permission Denied": "ไม่มีสิทธิ์", "Invite/Edit": "เชิญหรือแก้ไข", Disconnected: "ยังไม่เชื่อมต่อ", Connected: "เชื่อมต่อแล้ว", "Default 90d": "เก็บข้อมูล 90 วัน",
  "Change Pending": "มีการเปลี่ยนแปลงที่ยังไม่บันทึก", Valid: "พร้อมใช้งาน", Accepting: "กำลังเริ่ม", Declined: "ไม่ยินยอม", "Multi-task Progress": "หลายงาน",
  Buffering: "กำลังเตรียมต้นแบบ", "Provider Loading": "กำลังโหลดต้นแบบ", Confirm: "ยืนยัน", Cancel: "ยกเลิก", Expired: "ลิงก์หมดอายุ", "Login Required": "ต้องเข้าสู่ระบบ",
  Permission: "ไม่มีสิทธิ์", "Timed Out": "หมดเวลา", "Continue per config": "ดำเนินการต่อ", Reconnect: "กำลังเชื่อมต่อใหม่", "Resume Success": "กลับมาใช้งานได้แล้ว", "Resume Failed": "เชื่อมต่อไม่สำเร็จ",
};

const navLabels: Record<Exclude<NavKey, null>, string> = {
  Projects: "โปรเจกต์", Tests: "การทดสอบ", Results: "วิเคราะห์ผล", Participants: "ผู้เข้าร่วม", Settings: "ตั้งค่า",
};
const researcherNav = ["Projects", "Tests", "Results", "Participants", "Settings"] as const;
const groups = [
  { label: "เวิร์กสเปซและโปรเจกต์", ids: ["S01", "S02", "S03", "S04", "S05", "S06"] },
  { label: "สร้างและเผยแพร่การทดสอบ", ids: Array.from({ length: 14 }, (_, i) => `S${String(i + 7).padStart(2, "0")}`) },
  { label: "วิเคราะห์ผลและหลักฐาน", ids: Array.from({ length: 10 }, (_, i) => `S${String(i + 21).padStart(2, "0")}`) },
  { label: "ผู้เข้าร่วมและการตั้งค่า", ids: Array.from({ length: 6 }, (_, i) => `S${String(i + 31).padStart(2, "0")}`) },
  { label: "เส้นทางผู้เข้าร่วม", ids: Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`) },
];

const toneOverrides: Record<string, Tone> = {
  "Private/Login Required": "restricted", "Login Required": "restricted", Password: "restricted", Permission: "restricted",
  "Permission Restricted": "restricted", Restricted: "restricted", "Permission Denied": "restricted", "Redacted Fields": "restricted", "Evidence Deleted": "restricted",
  "Provider Blocked": "unsupported", Unsupported: "unsupported", "Unsupported Evidence": "unsupported", "Unsupported Provider/Transform": "unsupported",
  Incomplete: "warning", "Missing Start": "warning", "Missing Rule": "warning", "Publish Blocked": "warning", Blocked: "warning",
  "Technical-blocked Warning": "warning", "Technical Blocked": "warning", "Technical-blocked Context": "warning", Declined: "warning", Expired: "warning", Closed: "warning", "Version Changed": "warning", "Continue per config": "warning",
};

function screenName(screen: Screen): string { return screenThaiNames[screen.id] ?? screen.name; }
function stateName(state: string): string { return stateThaiNames[state] ?? state; }
function stateKind(state: string): Tone {
  if (toneOverrides[state]) return toneOverrides[state];
  const value = state.toLowerCase();
  if (["loading", "connecting", "checking", "processing", "buffering", "validating", "accepting", "reconnect"].some((t) => value.includes(t))) return "loading";
  if (["error", "invalid", "conflict", "failed"].some((t) => value.includes(t))) return "error";
  if (["restricted", "permission denied", "redacted"].some((t) => value.includes(t))) return "restricted";
  if (["unsupported", "provider blocked"].some((t) => value.includes(t))) return "unsupported";
  if (["empty", "no data", "no clicks", "no path", "no baseline", "no eligible"].some((t) => value.includes(t))) return "empty";
  if (["warning", "low sample", "blocked", "timeout", "timed out", "give up", "missing", "incomplete", "declined", "expired", "closed"].some((t) => value.includes(t))) return "warning";
  if (["pass", "ready", "complete", "published", "connected", "valid", "success", "frame selected"].some((t) => value.includes(t))) return "success";
  return "neutral";
}
function isExceptionState(state: string) { return !["neutral", "success"].includes(stateKind(state)); }

function navKeyForScreen(id: string): NavKey {
  if (!id.startsWith("S")) return null;
  const n = Number(id.slice(1));
  if (n >= 3 && n <= 6) return "Projects";
  if (n >= 7 && n <= 20) return "Tests";
  if (n >= 21 && n <= 30) return "Results";
  if (n === 31) return "Participants";
  if (n >= 32 && n <= 36) return "Settings";
  return null;
}

function Button({ children, variant = "primary", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <button type="button" className={`hfButton hfButton--${variant}`} disabled={disabled}>{children}</button>;
}

function StateNotice({ state, audience = "researcher" }: { state: string; audience?: Audience }) {
  const kind = stateKind(state);
  const researcherCopy: Record<Tone, string> = {
    neutral: "พร้อมดำเนินการต่อ", loading: "กำลังโหลดข้อมูลล่าสุด…", error: "เกิดข้อผิดพลาด แก้ไขแล้วลองอีกครั้ง",
    restricted: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้", unsupported: "ความสามารถนี้ยังใช้กับต้นแบบปัจจุบันไม่ได้", empty: "ยังไม่มีข้อมูลเพียงพอสำหรับแสดงผล",
    warning: "ตรวจสอบจุดนี้ก่อนดำเนินการต่อ", success: "พร้อมใช้งาน",
  };
  const participantCopy: Record<Tone, string> = {
    neutral: "ดำเนินการต่อเมื่อพร้อม", loading: "กำลังโหลด โปรดเปิดหน้านี้ไว้", error: "เกิดข้อผิดพลาด ลองอีกครั้ง",
    restricted: "ขั้นตอนนี้ใช้ไม่ได้ด้วยสิทธิ์การเข้าถึงปัจจุบัน", unsupported: "ขั้นตอนนี้ยังใช้ไม่ได้ในการทดสอบนี้", empty: "ยังไม่มีข้อมูลสำหรับขั้นตอนนี้",
    warning: "อ่านข้อความด้านล่างก่อนดำเนินการต่อ", success: "พร้อมดำเนินการต่อ",
  };
  const copy = audience === "participant" ? participantCopy : researcherCopy;
  return <div className={`stateNotice stateNotice--${kind}`} role={kind === "error" ? "alert" : "status"}><div><span className="stateDot" aria-hidden="true" /><strong>{stateName(state)}</strong></div><p>{copy[kind]}</p></div>;
}

function Skeleton({ rows = 4 }: { rows?: number }) { return <div className="skeletonStack" aria-label="กำลังโหลดข้อมูล">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>; }
function ErrorCard({ title = "มีข้อมูลที่ต้องตรวจสอบ", body = "แก้ไขจุดที่ระบุแล้วลองอีกครั้ง" }: { title?: string; body?: string }) { return <div className="inlineError" role="alert"><strong>{title}</strong><span>{body}</span></div>; }
function Empty({ title = "ยังไม่มีข้อมูล", body = "ข้อมูลจะแสดงเมื่อมีข้อมูลที่นำมาใช้ได้", action }: { title?: string; body?: string; action?: string }) { return <section className="emptyState"><div className="emptyIcon" aria-hidden="true">○</div><h3>{title}</h3><p>{body}</p>{action ? <Button variant="secondary">{action}</Button> : null}</section>; }
function PermissionState({ body = "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" }: { body?: string }) { return <section className="emptyState" data-state="restricted"><div className="emptyIcon" aria-hidden="true">!</div><h3>ต้องมีสิทธิ์เพิ่มเติม</h3><p>{body}</p></section>; }
function UnsupportedState({ body = "ความสามารถนี้ยังใช้กับข้อมูลหรือต้นแบบปัจจุบันไม่ได้" }: { body?: string }) { return <section className="emptyState" data-state="unsupported"><div className="emptyIcon" aria-hidden="true">!</div><h3>ยังไม่รองรับ</h3><p>{body}</p></section>; }
function Header({ title, state, detail }: { title: string; state?: string; detail?: string }) { return <div className="panelHeader"><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{state ? <span className="tag">{stateName(state)}</span> : null}</div>; }
function Chips({ screen }: { screen: Screen }) { return <div className="componentChips" aria-label="ชุดคอมโพเนนต์">{screen.componentFamilies.map((f) => <span key={f}>{f}</span>)}</div>; }
function TableSkeleton({ label }: { label: string }) { return <div className="tableWrap" tabIndex={0} aria-label={label}><table className="specimenTable skeletonTable"><thead><tr>{[1,2,3,4].map((n) => <th scope="col" key={n}><span className="skeletonCell skeletonCell--header" aria-hidden="true" /></th>)}</tr></thead><tbody>{[1,2,3,4].map((r) => <tr key={r}>{[1,2,3,4].map((c) => <td key={c}><span className="skeletonCell" aria-hidden="true" /></td>)}</tr>)}</tbody></table></div>; }
function MetricSkeletons({ count = 3 }: { count?: number }) { return <div className="metricsGrid" aria-label="โครงร่างการ์ดตัวชี้วัด">{Array.from({ length: count }, (_, i) => <article className="metricCard metricCard--skeleton" key={i}><span /><strong /><span /></article>)}</div>; }

function Shell({ screen, children }: { screen: Screen; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const active = navKeyForScreen(screen.id);
  return <div className="appFrame">
    <button type="button" className={open ? "navBackdrop isOpen" : "navBackdrop"} aria-label="ปิดเมนู" onClick={() => setOpen(false)} />
    <aside className={open ? "appSidebar appSidebar--open" : "appSidebar"} aria-label="เมนูแอปพลิเคชัน">
      <div className="sidebarBrandRow"><div className="axaMark" aria-label="UT Platform">UT<span>•</span></div><button type="button" className="mobileNavClose" aria-label="ปิดเมนู" onClick={() => setOpen(false)}>×</button></div>
      <nav id="review-primary-nav" aria-label="เมนูหลัก">{researcherNav.map((item) => <a key={item} href="#review-stage" className={active === item ? "sideNavItem isActive" : "sideNavItem"} aria-current={active === item ? "page" : undefined} onClick={() => setOpen(false)}>{navLabels[item]}</a>)}</nav>
    </aside>
    <div className="appMain"><header className="appTopbar"><div><span className="crumb">เวิร์กสเปซ / โปรเจกต์ / การทดสอบ</span><h1>{screenName(screen)}</h1></div><div className="topActions"><button type="button" className="mobileNavToggle" aria-controls="review-primary-nav" aria-expanded={open} onClick={() => setOpen(true)}>เมนู</button><Button variant="secondary">ดูตัวอย่าง</Button></div></header><main className="screenCanvas">{children}</main></div>
  </div>;
}

function FilterBar({ scope = "รายการ" }: { scope?: string }) { return <div className="filterBar"><label className="field filterSearch"><span className="fieldLabel">ค้นหา{scope}</span><input className="fieldControl" placeholder={`ค้นหา${scope}`} /></label><div className="filterChips" aria-label="ตัวกรอง"><button type="button" className="filterChip isActive">ทั้งหมด</button><button type="button" className="filterChip">สถานะ</button></div></div>; }
function Lifecycle({ current = "สร้าง" }: { current?: string }) { const steps = ["สร้าง", "พรีวิว", "ตรวจสอบ", "เผยแพร่", "แชร์", "วิเคราะห์ผล"]; return <div className="lifecycleRail" aria-label="ขั้นตอนการทดสอบ">{steps.map((step, i) => <span key={step} className={`lifecycleStep ${step === current ? "isCurrent" : ""} ${i > 3 ? "isLocked" : ""}`.trim()} aria-current={step === current ? "step" : undefined} aria-disabled={i > 3 ? "true" : undefined}>{step}</span>)}</div>; }

const formCopy: Record<string, { primary: string; secondary?: string; action: string }> = {
  S02: { primary: "ชื่อเวิร์กสเปซ", action: "สร้างเวิร์กสเปซ" },
  S05: { primary: "ชื่อโปรเจกต์", secondary: "คำอธิบายโปรเจกต์", action: "สร้างโปรเจกต์" },
  S33: { primary: "ชื่อเวิร์กสเปซ", secondary: "คำอธิบายเวิร์กสเปซ", action: "บันทึกการเปลี่ยนแปลง" },
};

function FormSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  if (screen.id === "S08") return <section className="panel formPanel formPanel--wide"><Header title="สร้างการทดสอบ" state={state} detail="เลือกการทดสอบที่รองรับในรุ่นปัจจุบัน" />{kind === "loading" ? <Skeleton /> : <><label className="field"><span className="fieldLabel">ชื่อการทดสอบ</span><input className="fieldControl" /></label><fieldset className="choiceGrid"><legend>ประเภทการทดสอบ</legend><label><input type="radio" name="S08-choice" defaultChecked /><span><strong>ทดสอบต้นแบบ Figma</strong><small>ให้ผู้เข้าร่วมทำงานบนต้นแบบและวัดผลด้วยเกณฑ์ที่กำหนด</small></span></label></fieldset><div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button disabled={["error","restricted","unsupported"].includes(kind)}>สร้างการทดสอบ</Button></div></>}</section>;
  const copy = formCopy[screen.id] ?? { primary: "ชื่อ", secondary: "รายละเอียด", action: "บันทึก" };
  return <section className="panel formPanel formPanel--wide"><Header title={screenName(screen)} state={state} detail="กรอกข้อมูลที่จำเป็นเพื่อดำเนินการต่อ" />{kind === "loading" ? <Skeleton /> : kind === "restricted" ? <PermissionState /> : <><label className="field"><span className="fieldLabel">{copy.primary}</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} aria-describedby={kind === "error" ? `${screen.id}-error` : undefined} />{kind === "error" ? <span id={`${screen.id}-error`} className="fieldMessage fieldMessage--error">ตรวจสอบข้อมูลในช่องนี้</span> : null}</label>{screen.componentFamilies.includes("Textarea") ? <label className="field"><span className="fieldLabel">{copy.secondary ?? "รายละเอียด"}</span><textarea className="fieldControl fieldTextarea" /></label> : null}<div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button disabled={["error","restricted","unsupported"].includes(kind)}>{copy.action}</Button></div></>}</section>;
}

const emptyByScreen: Record<string, { title: string; body: string; action?: string }> = {
  S03: { title: "ยังไม่มีงานล่าสุด", body: "สร้างโปรเจกต์เพื่อเริ่มการทดสอบครั้งแรก", action: "สร้างโปรเจกต์" },
  S04: { title: "ยังไม่มีโปรเจกต์", body: "สร้างโปรเจกต์เพื่อรวบรวมการทดสอบและผลที่เกี่ยวข้อง", action: "สร้างโปรเจกต์" },
  S06: { title: "โปรเจกต์นี้ยังไม่มีการทดสอบ", body: "สร้างการทดสอบต้นแบบเพื่อเริ่มเก็บหลักฐาน", action: "สร้างการทดสอบ" },
  S07: { title: "ยังไม่มีการทดสอบ", body: "สร้างการทดสอบต้นแบบ Figma ภายในโปรเจกต์นี้", action: "สร้างการทดสอบ" },
  S21: { title: "ยังไม่มีผลการทดสอบ", body: "ผลจะแสดงเมื่อมีเซสชันที่นำมาคำนวณได้" },
  S26: { title: "ยังไม่มีเซสชัน", body: "เซสชันจะแสดงเมื่อมีผู้เข้าร่วมเริ่มการทดสอบ" },
  S31: { title: "ยังไม่มีผู้เข้าร่วม", body: "ข้อมูลผู้เข้าร่วมจะแสดงเมื่อมีเซสชันการทดสอบ" },
};

function DashboardSpec({ screen, state }: { screen: Screen; state: string }) { const kind = stateKind(state); const detail = screen.id === "S03" ? "ดูงานล่าสุดและสถานะการทดสอบ" : "ดูการทดสอบและสิ่งที่ต้องดำเนินการในโปรเจกต์นี้"; const empty = emptyByScreen[screen.id]; return <div className="dashboardStack"><MetricSkeletons count={4} /><section className="panel operationalPanel"><Header title={screenName(screen)} state={state} detail={detail} />{kind === "loading" ? <Skeleton rows={6} /> : kind === "restricted" ? <PermissionState /> : kind === "empty" && empty ? <Empty {...empty} /> : <TableSkeleton label={`ตาราง${screenName(screen)}`} />}</section></div>; }
const listingDetails: Record<string, string> = { S04: "ค้นหาและจัดการโปรเจกต์", S07: "ค้นหาและจัดการการทดสอบ", S21: "เลือกการทดสอบเพื่อวิเคราะห์ผล", S26: "ดูเซสชันที่เกิดขึ้นในการทดสอบนี้", S31: "ดูผู้เข้าร่วมและเซสชันที่เกี่ยวข้อง" };
function ListingSpec({ screen, state }: { screen: Screen; state: string }) { const kind = stateKind(state); const empty = emptyByScreen[screen.id]; return <section className="panel operationalPanel"><Header title={screenName(screen)} state={state} detail={listingDetails[screen.id] ?? "ค้นหาและจัดการรายการ"} /><FilterBar scope={screen.id === "S04" ? "โปรเจกต์" : screen.id === "S07" ? "การทดสอบ" : "รายการ"} />{kind === "loading" ? <Skeleton rows={7} /> : kind === "restricted" ? <PermissionState /> : kind === "empty" && empty ? <Empty {...empty} /> : <>{kind === "error" ? <ErrorCard /> : null}<TableSkeleton label={`ตาราง${screenName(screen)}`} /></>}</section>; }

function BuildWorkspace({ state }: { state: string }) { const kind = stateKind(state); const blocks = ["ต้อนรับและความยินยอม", "ต้นแบบ Figma", "งานทดสอบ", "คำถามหลังงาน"]; return <><Lifecycle /><div className="builderWorkspace"><section className="panel"><Header title="โฟลว์การทดสอบ" state="Draft" detail="เลือกส่วนที่ต้องการตั้งค่า" /><div className="builderStepList">{blocks.map((label,i) => <button type="button" key={label} className={i === 2 ? "builderStep isCurrent" : "builderStep"} aria-current={i === 2 ? "step" : undefined}><strong>{label}</strong><small>{i === 2 ? "กำลังแก้ไข" : "ตั้งค่าแล้ว"}</small></button>)}</div></section><section className="panel formPanel formPanel--wide"><Header title="งานทดสอบที่เลือก" state={state} detail="ตั้งค่างาน ต้นแบบ และเกณฑ์ให้ครบก่อนตรวจสอบ" />{kind === "loading" ? <Skeleton /> : kind === "restricted" ? <PermissionState /> : <><label className="field"><span className="fieldLabel">คำสั่งที่ผู้เข้าร่วมจะเห็น</span><textarea className="fieldControl fieldTextarea" /></label><div className="screenContractGrid"><div className="screenContractCard"><strong>ต้นแบบ</strong><span>เชื่อมต่อต้นแบบและกำหนดจุดเริ่มต้น</span></div><div className="screenContractCard"><strong>เกณฑ์จบงาน</strong><span>กำหนดจุดสำเร็จ จุดไม่สำเร็จ และเวลาสิ้นสุด</span></div></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">พรีวิวงานนี้</Button><Button disabled={["error","restricted","unsupported"].includes(kind)}>ตรวจสอบความพร้อม</Button></div></>}</section></div></>; }
function ImportSpec({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="เชื่อมต่อ Figma" state={state} detail="ใช้ลิงก์ต้นแบบ Figma ที่ผู้เข้าร่วมเปิดได้" /><label className="field"><span className="fieldLabel">URL ต้นแบบ Figma</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} placeholder="https://www.figma.com/proto/..." />{kind === "error" ? <span className="fieldMessage fieldMessage--error">ตรวจสอบว่าเป็นลิงก์ต้นแบบ Figma แบบสาธารณะที่รองรับ</span> : null}</label><div className="integrationRow"><div><strong>Figma</strong><span>{kind === "loading" ? "กำลังตรวจสอบ…" : kind === "success" ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}</span></div><Button disabled={kind === "loading" || kind === "restricted"}>ตรวจสอบต้นแบบ</Button></div></section></>; }
function ValidationSpec({ screen, state }: { screen: Screen; state: string }) { const kind = stateKind(state); const publish = screen.id === "S19"; return <><Lifecycle current={publish ? "เผยแพร่" : "ตรวจสอบ"} /><section className="panel validationPanel"><Header title={screenName(screen)} state={state} detail="แก้ไขรายการที่ยังไม่พร้อมก่อนดำเนินการต่อ" /><div className="checklist">{["ข้อมูลที่จำเป็น", "การเข้าถึงต้นแบบ", "เกณฑ์สำเร็จและไม่สำเร็จ"].map((label,i) => <div key={label} className={kind === "success" ? "checkOk" : i === 0 && ["warning","error"].includes(kind) ? "checkError" : "checkWarn"}><strong>{label}</strong><span>{kind === "success" ? "ผ่าน" : i === 0 ? "ต้องแก้ไข" : "ควรตรวจสอบ"}</span></div>)}</div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">กลับไปแก้ไข</Button><Button disabled={kind !== "success"}>{publish ? "เผยแพร่การทดสอบ" : "ดำเนินการต่อ"}</Button></div></section></>; }
function PrototypeSpec({ screen, state }: { screen: Screen; state: string }) { const kind = stateKind(state); if (kind === "restricted") return <PermissionState body="ต้นแบบนี้ต้องใช้สิทธิ์เพิ่มเติม" />; if (kind === "unsupported") return <UnsupportedState body="ต้นแบบนี้ยังใช้กับการทดสอบปัจจุบันไม่ได้" />; return <><Lifecycle current={screen.id === "S18" ? "พรีวิว" : "สร้าง"} /><section className="panel"><Header title={screenName(screen)} state={state} detail="เปิดต้นแบบและตรวจสอบว่าผู้เข้าร่วมใช้งานได้" />{kind === "loading" ? <Skeleton rows={6} /> : <><div className="prototypeMock" aria-label="พื้นที่ตัวอย่างต้นแบบ"><div className="prototypeChrome"><span /><span /><span /></div><div className="prototypeBody"><div className="prototypeSidebar" /><div className="prototypeContent"><span className="prototypeLine prototypeLine--wide" /><span className="prototypeLine" /><div className="prototypeCards"><span /><span /></div></div></div></div>{kind === "error" || kind === "warning" ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">ย้อนกลับ</Button><Button disabled={kind === "error"}>{screen.id === "S18" ? "เริ่มพรีวิว" : "ใช้ต้นแบบนี้"}</Button></div></>}</section></>; }
function TaskEditor({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle /><div className="builderWorkspace"><section className="panel"><Header title="งานทดสอบ" state={state} detail="เลือกงานเพื่อแก้ไขหรือจัดลำดับ" /><div className="builderStepList">{[1,2,3].map((n) => <button type="button" key={n} className={n === 2 ? "builderStep isCurrent" : "builderStep"}><strong>งาน {n}</strong><small>{n === 2 ? "เลือกอยู่" : "ตั้งค่าแล้ว"}</small></button>)}</div><div className="reorderActions"><Button variant="secondary">เลื่อนขึ้น</Button><Button variant="secondary">เลื่อนลง</Button></div></section><section className="panel formPanel formPanel--wide"><Header title="แก้ไขงาน" detail="เขียนคำสั่งที่ผู้เข้าร่วมจะเห็นโดยไม่เปิดเผยเกณฑ์สำเร็จ" /><label className="field"><span className="fieldLabel">คำสั่งงาน</span><textarea className={kind === "error" ? "fieldControl fieldTextarea fieldControl--error" : "fieldControl fieldTextarea"} aria-invalid={kind === "error"} /></label>{kind === "error" ? <span className="fieldMessage fieldMessage--error">เพิ่มคำสั่งงานก่อนบันทึก</span> : null}<div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button disabled={kind === "error"}>บันทึกงาน</Button></div></section></div></>; }
function RuleSpec({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="เกณฑ์สำเร็จและไม่สำเร็จ" state={state} detail="กำหนดจุดที่ทำให้งานจบเป็นสำเร็จ ไม่สำเร็จ หรือหมดเวลา" /><div className="ruleRows"><div><span className="ruleType ruleType--success">สำเร็จ</span><select className="fieldControl" aria-label="เกณฑ์สำเร็จ"><option>เลือก Node</option></select></div><div><span className="ruleType ruleType--failure">ไม่สำเร็จ</span><select className="fieldControl" aria-label="เกณฑ์ไม่สำเร็จ"><option>เลือก Node</option></select></div><div><span className="ruleType">หมดเวลา</span><input className="fieldControl" type="number" aria-label="ระยะเวลาสูงสุด" /></div></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">ย้อนกลับ</Button><Button disabled={kind === "error"}>บันทึกเกณฑ์</Button></div></section></>; }
function QuestionSpec({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="คำถามหลังงาน" state={state} detail="เลือกคำถามที่จะให้ผู้เข้าร่วมตอบหลังทำแต่ละงาน" /><fieldset className="seqFieldset"><legend>คะแนนความง่ายของงาน (SEQ)</legend><div>{[1,2,3,4,5,6,7].map((n) => <label key={n}><input type="radio" name="seq" /><span>{n}</span></label>)}</div><small>1 = ยากมาก · 7 = ง่ายมาก</small></fieldset><label className="field"><span className="fieldLabel">ความคิดเห็นเพิ่มเติม</span><textarea className="fieldControl fieldTextarea" /></label>{kind === "error" ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">ย้อนกลับ</Button><Button>บันทึกคำถาม</Button></div></section></>; }
function PreviewSetup({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle current="พรีวิว" /><section className="panel validationPanel"><div className="previewBanner"><span>โหมดพรีวิว</span><strong>{kind === "success" ? "พร้อม" : "ต้องตรวจสอบ"}</strong></div><Header title="ตั้งค่าพรีวิว" state={state} detail="ตรวจสอบฉบับร่างและต้นแบบก่อนทดลองใช้งานจริง" /><div className="checklist"><div className={kind === "success" ? "checkOk" : "checkWarn"}><strong>ฉบับร่าง</strong><span>{kind === "success" ? "พร้อม" : "ต้องตรวจสอบ"}</span></div><div className={kind === "unsupported" ? "checkError" : "checkOk"}><strong>การเข้าถึงต้นแบบ</strong><span>{kind === "unsupported" ? "เข้าไม่ได้" : "พร้อมใช้งาน"}</span></div></div>{kind === "unsupported" ? <UnsupportedState /> : ["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">กลับไปสร้าง</Button><Button disabled={kind !== "success"}>เข้าสู่พรีวิว</Button></div></section></>; }
function ShareSpec({ state }: { state: string }) { const kind = stateKind(state); return <><Lifecycle current="เผยแพร่" /><section className="panel sharePanel"><div className={kind === "success" ? "statusIcon" : "statusIcon statusIcon--muted"} aria-hidden="true">{kind === "success" ? "✓" : "i"}</div><h2>แชร์การทดสอบที่เผยแพร่แล้ว</h2><p>คัดลอกลิงก์เพื่อส่งให้ผู้เข้าร่วม</p><div className="shareUrl"><span className="skeletonCell" aria-hidden="true" /><Button variant="secondary">คัดลอกลิงก์</Button></div><div className="formActions"><Button variant="secondary">กลับไปสร้าง</Button><Button disabled={["warning","error"].includes(kind)}>สร้างเวอร์ชันใหม่</Button></div></section></>; }
function ResultsOverview({ state }: { state: string }) { const kind = stateKind(state); if (kind === "empty") return <Empty title="ยังไม่มีผลการทดสอบ" body="ผลจะแสดงเมื่อมีเซสชันที่นำมาคำนวณได้" />; return <div className="dashboardStack"><MetricSkeletons /><div className="analyticsGrid"><section className="panel"><Header title="ภาพรวมผล" state={state} detail="ดูความสำเร็จ เวลา และจุดติดขัดที่พบ" /><div className="funnelSkeleton"><span /><span /><span /></div></section><section className="panel"><Header title="คุณภาพหลักฐาน" detail="แยกปัญหาทางเทคนิคออกจากผลด้านการใช้งาน" /><Skeleton rows={5} /></section></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}</div>; }
function TaskDetail({ state }: { state: string }) { const kind = stateKind(state); if (kind === "empty") return <Empty title="ยังไม่มีเซสชันที่นำมาคำนวณ" body="ต้องมีเซสชันที่ผ่านเกณฑ์ก่อนจึงจะแสดงผลรายงาน" />; return <div className="dashboardStack"><MetricSkeletons />{kind === "warning" ? <StateNotice state={state} /> : null}<section className="panel operationalPanel"><Header title="ผลรายงาน" state={state} detail="ดูผลและหลักฐานของงานนี้" /><TableSkeleton label="ตารางหลักฐานของงาน" /></section></div>; }
function PathSpec({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel"><Header title="เส้นทางการใช้งาน" state={state} detail="ดูว่าผู้เข้าร่วมเดินทางจากจุดเริ่มต้นไปยังจุดหมายอย่างไร" />{kind === "unsupported" ? <UnsupportedState body="หลักฐานเส้นทางของต้นแบบนี้ยังไม่รองรับ" /> : kind === "empty" ? <Empty title="ยังไม่มีข้อมูลเส้นทาง" body="เส้นทางจะแสดงเมื่อมีหลักฐานหน้าจอที่นำมาใช้ได้" /> : <div className="pathMock"><span className="pathNode pathNode--active">เริ่ม</span><span aria-hidden="true">→</span><span className="pathNode">ขั้นตอน</span><span aria-hidden="true">→</span><span className="pathNode">จบ</span></div>}</section>; }
function HeatmapSpec({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel"><Header title="ฮีตแมป" state={state} detail="ดูบริเวณที่ผู้เข้าร่วมคลิกบนต้นแบบ" />{kind === "unsupported" ? <UnsupportedState body="ยังสร้างฮีตแมปจากหลักฐานของต้นแบบนี้ไม่ได้" /> : kind === "empty" ? <Empty title="ยังไม่มีข้อมูลการคลิก" body="ฮีตแมปจะแสดงเมื่อมีหลักฐานตำแหน่งคลิกที่รองรับ" /> : <div className="heatmapMock" aria-label="ตัวอย่างฮีตแมป"><span style={{ left: "22%", top: "30%", width: 18, height: 18 }} /><span style={{ left: "52%", top: "44%", width: 28, height: 28 }} /><span style={{ left: "73%", top: "64%", width: 14, height: 14 }} /><div className="heatLegend"><span>น้อย</span><i /><i /><i /><i /><i /><span>มาก</span></div></div>}</section>; }
function SessionDetail({ state }: { state: string }) { const kind = stateKind(state); return kind === "restricted" ? <PermissionState body="หลักฐานบางส่วนของเซสชันนี้ไม่พร้อมให้คุณดู" /> : <div className="detailSplit"><section className="panel"><Header title="ไทม์ไลน์เซสชัน" state={state} detail="ดูเหตุการณ์ตามลำดับและหลักฐานที่เกี่ยวข้อง" /><div className="timelineList">{[1,2,3,4].map((n) => <div key={n}><span aria-hidden="true" /><div><strong>เหตุการณ์</strong><small>หลักฐานของเซสชัน</small></div></div>)}</div></section><aside className="panel"><Header title="หลักฐาน" /><Skeleton /></aside></div>; }
function FindingsList({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel operationalPanel"><Header title="ประเด็นที่พบ" state={state} detail="เปลี่ยนหลักฐานเป็นประเด็น UX ที่นำไปแก้ไขได้" /><div className="filterBar"><div className="filterChips"><button type="button" className="filterChip isActive">ทั้งหมด</button><button type="button" className="filterChip">ความรุนแรง</button><button type="button" className="filterChip">สถานะ</button></div></div>{kind === "empty" ? <Empty title="ยังไม่มีประเด็นที่พบ" body="สร้างประเด็นจากหลักฐานเมื่อพบสิ่งที่ควรแก้ไข" /> : <div className="findingGrid findingGrid--skeleton">{[1,2,3].map((n) => <article className="findingCard" key={n}><span className="severity">ระดับ</span><span className="skeletonCell skeletonCell--title" /><span className="skeletonCell" /><span className="skeletonCell" /></article>)}</div>}</section>; }
function FindingEditor({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel formPanel formPanel--wide"><Header title="แก้ไขประเด็นที่พบ" state={state} detail="อธิบายปัญหาและเชื่อมหลักฐานที่สนับสนุน" /><label className="field"><span className="fieldLabel">ชื่อประเด็น</span><input className="fieldControl" /></label><fieldset className="choiceGrid choiceGrid--compact"><legend>ความรุนแรง</legend>{["ต่ำ","กลาง","สูง"].map((v) => <label key={v}><input type="radio" name="severity" /><span><strong>{v}</strong></span></label>)}</fieldset><label className="field"><span className="fieldLabel">รายละเอียดปัญหา</span><textarea className="fieldControl fieldTextarea" /></label><div className="evidenceCard"><strong>หลักฐาน</strong><span>{kind === "restricted" ? "ไม่สามารถเปิดหลักฐานนี้ได้" : "เชื่อมหลักฐานที่เกี่ยวข้อง"}</span></div><div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button disabled={kind === "restricted"}>บันทึกประเด็น</Button></div></section>; }
function Retest({ state }: { state: string }) { const kind = stateKind(state); if (kind === "empty") return <Empty title="ยังไม่มีข้อมูลตั้งต้น" body="เลือกผลจากการทดสอบก่อนหน้าเพื่อใช้เป็นข้อมูลตั้งต้น" />; return <section className="comparisonGrid comparisonGrid--skeleton" aria-label="เปรียบเทียบการทดสอบซ้ำ"><div className="compareColumn"><span className="eyebrow">ก่อนปรับ</span><MetricSkeletons count={2} /></div><div className="deltaColumn"><span className="skeletonCell" /><span className="skeletonCell" /></div><div className="compareColumn"><span className="eyebrow">ทดสอบซ้ำ</span><MetricSkeletons count={2} /></div></section>; }
function DeleteData({ state }: { state: string }) { const kind = stateKind(state); const invalid = ["loading","error","restricted","unsupported"].includes(kind); return <div className="modalStage"><section className="deleteModal" role="dialog" aria-modal="true" aria-label="ยืนยันการลบข้อมูล"><Header title="ลบข้อมูล" state={state} detail="ตรวจสอบขอบเขตและผลกระทบก่อนลบ" /><div className="deletionScope"><strong>สิ่งที่จะลบ</strong><span className="skeletonCell skeletonCell--title" aria-label="ชื่อเวิร์กสเปซหรือการทดสอบที่เลือก" /><span>เซสชันและหลักฐานที่เกี่ยวข้อง</span><span>ข้อมูลที่คำนวณจากหลักฐานเหล่านั้น</span></div>{kind === "loading" ? <Skeleton /> : kind === "error" ? <ErrorCard /> : kind === "restricted" ? <PermissionState body="คุณไม่มีสิทธิ์ลบข้อมูลนี้" /> : <p className="destructiveCopy"><strong>การลบนี้ย้อนกลับไม่ได้</strong> ตรวจสอบว่าคุณเลือกขอบเขตถูกต้องก่อนดำเนินการ</p>}<div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button variant="danger" disabled={invalid}>ลบข้อมูล</Button></div></section></div>; }
function MembersRoles({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel operationalPanel"><Header title="สมาชิกและสิทธิ์" state={state} detail="จัดการผู้ที่เข้าถึงเวิร์กสเปซและระดับสิทธิ์" />{kind === "restricted" ? <PermissionState body="คุณไม่มีสิทธิ์จัดการสมาชิกของเวิร์กสเปซนี้" /> : <><TableSkeleton label="ตารางสมาชิกและสิทธิ์" /><div className="roleEditor"><label className="field"><span className="fieldLabel">สิทธิ์</span><select className="fieldControl"><option>เลือกสิทธิ์</option></select></label><div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button>บันทึกสิทธิ์</Button></div></div></>}</section>; }
function Integration({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel"><Header title="การเชื่อมต่อ Figma" state={state} detail="เชื่อมต่อหรือจัดการต้นแบบ Figma ของการทดสอบ" /><div className="integrationCard"><div><strong>Figma</strong><span>{kind === "success" ? "เชื่อมต่อแล้ว" : kind === "loading" ? "กำลังเชื่อมต่อ…" : "ยังไม่ได้เชื่อมต่อ"}</span></div><Button disabled={kind === "loading"}>{kind === "success" ? "จัดการ" : "เชื่อมต่อ"}</Button></div>{kind === "error" ? <ErrorCard title="เชื่อมต่อ Figma ไม่สำเร็จ" body="ตรวจสอบการเข้าถึงต้นแบบแล้วลองอีกครั้ง" /> : null}</section>; }
function Retention({ state }: { state: string }) { const kind = stateKind(state); return <section className="panel formPanel formPanel--wide"><Header title="ความเป็นส่วนตัวและระยะเวลาเก็บข้อมูล" state={state} detail="กำหนดระยะเวลาที่เก็บข้อมูลการวิจัย" /><label className="field"><span className="fieldLabel">ระยะเวลาเก็บข้อมูล</span><input type="number" defaultValue={90} className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} /></label><label className="field"><span className="fieldLabel">หน่วย</span><select className="fieldControl"><option>วัน</option></select></label>{kind === "error" ? <ErrorCard title="ตรวจสอบระยะเวลาเก็บข้อมูล" body="กรอกจำนวนวันที่ถูกต้องก่อนบันทึก" /> : kind === "restricted" ? <PermissionState body="คุณไม่มีสิทธิ์เปลี่ยนการตั้งค่านี้" /> : null}<div className="formActions"><Button variant="secondary">ยกเลิก</Button><Button disabled={kind === "restricted" || kind === "error"}>บันทึกการเปลี่ยนแปลง</Button></div></section>; }

function ResearcherSpecimen({ screen, state }: { screen: Screen; state: string }) {
  switch (screen.id) {
    case "S01": return <section className="panel entryPanel"><Header title="ทางเข้าใช้งาน" state={state} detail="เปิดเวิร์กสเปซเพื่อเริ่มทำงาน" /><div className="entryAction"><div><strong>เวิร์กสเปซทดสอบการใช้งาน</strong><p>ไปยังโปรเจกต์ การทดสอบ และผลการทดสอบ</p></div><Button>เปิดเวิร์กสเปซ</Button></div>{stateKind(state) === "error" ? <ErrorCard /> : null}</section>;
    case "S02": case "S05": case "S08": case "S33": return <FormSpec screen={screen} state={state} />;
    case "S03": case "S06": return <DashboardSpec screen={screen} state={state} />;
    case "S04": case "S07": case "S21": case "S26": case "S31": return <ListingSpec screen={screen} state={state} />;
    case "S09": return <BuildWorkspace state={state} />;
    case "S10": return <ImportSpec state={state} />;
    case "S11": case "S16": case "S19": return <ValidationSpec screen={screen} state={state} />;
    case "S12": case "S18": return <PrototypeSpec screen={screen} state={state} />;
    case "S13": return <TaskEditor state={state} />;
    case "S14": return <RuleSpec state={state} />;
    case "S15": return <QuestionSpec state={state} />;
    case "S17": return <PreviewSetup state={state} />;
    case "S20": return <ShareSpec state={state} />;
    case "S22": return <ResultsOverview state={state} />;
    case "S23": return <TaskDetail state={state} />;
    case "S24": return <PathSpec state={state} />;
    case "S25": return <HeatmapSpec state={state} />;
    case "S27": return <SessionDetail state={state} />;
    case "S28": return <FindingsList state={state} />;
    case "S29": return <FindingEditor state={state} />;
    case "S30": return <Retest state={state} />;
    case "S32": return <DeleteData state={state} />;
    case "S34": return <MembersRoles state={state} />;
    case "S35": return <Integration state={state} />;
    case "S36": return <Retention state={state} />;
    default: return <FormSpec screen={screen} state={state} />;
  }
}
function ScreenContent({ screen, state }: { screen: Screen; state: string }) { return <Shell screen={screen}>{isExceptionState(state) ? <StateNotice state={state} /> : null}<ResearcherSpecimen screen={screen} state={state} /></Shell>; }
function ParticipantProgress({ screen }: { screen: Screen }) { const index = Math.max(1, Number(screen.id.slice(1)) || 1); const value = Math.min(100, Math.round((index / 12) * 100)); return <div className="participantProgress"><span>ความคืบหน้า</span><div role="progressbar" aria-label="ความคืบหน้าของแบบทดสอบ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{ width: `${value}%` }} /></div></div>; }
function ParticipantActions({ primary = "ดำเนินการต่อ", secondary = "ย้อนกลับ", disabled = false, danger = false }: { primary?: string; secondary?: string; disabled?: boolean; danger?: boolean }) { return <div className="formActions participantActions"><Button variant="secondary">{secondary}</Button><Button variant={danger ? "danger" : "primary"} disabled={disabled}>{primary}</Button></div>; }
function ParticipantSpecimen({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state); const notice = isExceptionState(state) ? <StateNotice state={state} audience="participant" /> : null;
  switch (screen.id) {
    case "P01": return <section className="participantCard centerCard"><span className="eyebrow">กำลังเตรียมแบบทดสอบ</span><h1>กำลังตรวจสอบแบบทดสอบ</h1><p>กำลังตรวจสอบว่าแบบทดสอบนี้พร้อมใช้งาน</p>{notice}{kind === "loading" ? <Skeleton /> : <ParticipantActions primary="ดำเนินการต่อ" secondary="ออก" />}</section>;
    case "P02": return <section className="participantCard centerCard"><span className="eyebrow">ก่อนเริ่ม</span><h1>เข้าร่วมการทดสอบการใช้งาน</h1><p>หลังจากคุณยินยอม แบบทดสอบจะบันทึกการโต้ตอบกับงาน เส้นทางที่ใช้งาน ตำแหน่งที่คลิกหรือแตะ เวลาที่ใช้ ผลของงาน คะแนนความง่าย และความคิดเห็นที่คุณเลือกส่ง</p><p>แบบทดสอบนี้ไม่ใช้กล้อง ไมโครโฟน หรือการบันทึกหน้าจอ และไม่ขอชื่อ อีเมล หรือหมายเลขโทรศัพท์</p><label className="consentBox"><input type="checkbox" /><span>ฉันยินยอมเข้าร่วมการทดสอบนี้</span></label><div className="stateNotice stateNotice--neutral" role="status"><p>การบันทึกการโต้ตอบจะเริ่มหลังจากคุณเลือก <strong>ยินยอมและเริ่ม</strong></p></div>{notice}<ParticipantActions primary="ยินยอมและเริ่ม" secondary="ไม่ยินยอม" disabled={kind === "loading"} /></section>;
    case "P03": return <section className="participantCard centerCard"><span className="eyebrow">งานทดสอบ</span><h1>งานของคุณ</h1><div className="scenarioCard"><strong>คำสั่งงาน</strong><span className="skeletonCell skeletonCell--title" aria-label="ตัวอย่างคำสั่งงาน" /></div><p>ทำงานนี้ตามวิธีที่คุณทำตามปกติ</p>{notice}<ParticipantActions primary="เริ่มงาน" /></section>;
    case "P04": return <section className="participantRunner"><div className="runnerTaskBar"><strong>กำลังทำงาน</strong><Button variant="secondary">ทำงานนี้ต่อไม่ได้</Button></div><div className="participantPrototype" aria-label="พื้นที่ต้นแบบ"><Skeleton rows={6} /></div>{notice}</section>;
    case "P05": return <div className="modalStage participantModalStage"><section className="deleteModal" role="dialog" aria-modal="true" aria-label="ยืนยันการยุติงาน"><h1>ต้องการยุติงานนี้หรือไม่?</h1><p>หากยุติงาน คุณยังตอบคำถามหลังงานและทำแบบทดสอบต่อได้</p>{notice}<ParticipantActions primary="ยุติงานนี้" secondary="ลองต่อ" danger /></section></div>;
    case "P06": return <section className="participantCard centerCard"><span className="eyebrow">หลังทำงาน</span><h1>งานนี้ทำได้ง่ายหรือยากเพียงใด?</h1><fieldset className="seqFieldset"><legend>ให้คะแนนความง่ายของงานนี้</legend><div>{[1,2,3,4,5,6,7].map((n) => <label key={n}><input type="radio" name="participant-seq" /><span>{n}</span></label>)}</div><small>1 = ยากมาก · 7 = ง่ายมาก</small></fieldset><label className="field"><span className="fieldLabel">อะไรทำให้งานนี้ง่ายหรือยาก?</span><textarea className="fieldControl fieldTextarea" /></label>{notice}<ParticipantActions primary="ส่งคำตอบ" /></section>;
    case "P07": return <section className="participantCard centerCard"><span className="eyebrow">งานถัดไป</span><h1>พร้อมทำงานถัดไปหรือยัง?</h1><p>ความคืบหน้าของคุณถูกบันทึกแล้ว</p>{notice}{kind === "loading" ? <Skeleton /> : <ParticipantActions primary="ไปงานถัดไป" secondary="ออก" />}</section>;
    case "P08": return <section className="participantCard centerCard completionCard"><div className="statusIcon" aria-hidden="true">✓</div><h1>แบบทดสอบเสร็จสมบูรณ์</h1><p>ขอบคุณที่เข้าร่วม</p><div className="referenceCode"><span>รหัสอ้างอิง</span><span className="skeletonCell" aria-hidden="true" /></div></section>;
    case "P09": return <section className="participantCard centerCard unavailableCard"><div className="statusIcon statusIcon--muted" aria-hidden="true">!</div><h1>แบบทดสอบนี้ใช้งานไม่ได้</h1>{notice}<p>ลิงก์อาจหมดอายุหรือแบบทดสอบอาจถูกปิด โปรดตรวจสอบลิงก์หรือติดต่อผู้ที่ส่งแบบทดสอบนี้มา</p></section>;
    case "P10": return <section className="participantCard centerCard"><div className="statusIcon statusIcon--warning" aria-hidden="true">!</div><h1>ขั้นตอนนี้ยังดำเนินการต่อไม่ได้</h1><p>ลองอีกครั้ง หากยังพบปัญหา คุณสามารถออกจากแบบทดสอบได้</p>{notice}<ParticipantActions primary="ลองอีกครั้ง" secondary="ออก" disabled={kind === "restricted" && state === "Permission"} /></section>;
    case "P11": return <section className="participantCard centerCard"><div className="statusIcon statusIcon--warning" aria-hidden="true">!</div><h1>หมดเวลาสำหรับงานนี้แล้ว</h1>{notice}<p>เวลาของงานนี้สิ้นสุดแล้ว ดำเนินการต่อเพื่อดูขั้นตอนถัดไป</p><ParticipantActions primary="ดำเนินการต่อ" secondary="ออก" /></section>;
    case "P12": return <section className="participantCard centerCard"><span className="eyebrow">การเชื่อมต่อ</span><h1>{kind === "success" ? "กลับมาออนไลน์แล้ว" : "เชื่อมต่ออีกครั้งเพื่อทำต่อ"}</h1><p>งานที่ทำเสร็จแล้วถูกบันทึกไว้</p>{notice}{kind === "loading" ? <Skeleton /> : <ParticipantActions primary={kind === "success" ? "ทำแบบทดสอบต่อ" : "เชื่อมต่ออีกครั้ง"} secondary="ออก" disabled={kind === "error"} />}</section>;
    default: return <section className="participantCard centerCard"><h1>{screenName(screen)}</h1>{notice}<ParticipantActions /></section>;
  }
}
function ParticipantContent({ screen, state }: { screen: Screen; state: string }) { return <div className="participantFrame"><header className="participantHeader"><div className="participantBrand">UT Study</div><ParticipantProgress screen={screen} /></header><main className="participantMain"><ParticipantSpecimen screen={screen} state={state} /></main><footer className="participantFooter">แบบทดสอบการใช้งาน</footer></div>; }

export default function HighFiReview() {
  const [selectedId, setSelectedId] = useState(screens[0]?.id ?? "S01");
  const selectedScreen = useMemo(() => screens.find((screen) => screen.id === selectedId) ?? screens[0], [selectedId]);
  const [selectedState, setSelectedState] = useState(selectedScreen.states[0]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const selectedIndex = screens.findIndex((screen) => screen.id === selectedScreen.id);
  function chooseScreen(id: string) { const next = screens.find((screen) => screen.id === id) ?? screens[0]; setSelectedId(next.id); setSelectedState(next.states[0]); }
  function stepScreen(offset: number) { chooseScreen(screens[(selectedIndex + offset + screens.length) % screens.length].id); }

  return <main className="reviewPage" data-boundary={REVIEW_DATA_BOUNDARY}>
    <header className="reviewHeader"><div><span className="eyebrow">High-fidelity QA</span><h1>ตรวจสอบ 48 หน้าจอ / 170 สถานะ</h1><p>ตรวจ Desktop และ Mobile ด้วย Design System หลัก หน้านี้เป็นพื้นที่ตรวจแบบและไม่ใช่ข้อมูล Production</p></div><div className="coverageBadge" aria-label="ขอบเขตการตรวจ"><strong>{screens.length}</strong><span>หน้าจอ</span><strong>{totalStates}</strong><span>สถานะ</span></div></header>
    <section className="reviewControls" aria-label="เครื่องมือตรวจหน้าจอ">
      <label><span>หน้าจอ</span><select value={selectedScreen.id} onChange={(e) => chooseScreen(e.target.value)}>{groups.map((group) => <optgroup key={group.label} label={group.label}>{group.ids.map((id) => { const screen = screens.find((item) => item.id === id); return screen ? <option key={screen.id} value={screen.id}>{screen.id} · {screenName(screen)}</option> : null; })}</optgroup>)}</select></label>
      <label><span>สถานะ</span><select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>{selectedScreen.states.map((state) => <option key={state} value={state}>{stateName(state)}</option>)}</select></label>
      <div className="viewportToggle" role="group" aria-label="ขนาดหน้าจอ"><button type="button" className={viewport === "desktop" ? "isActive" : ""} aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</button><button type="button" className={viewport === "mobile" ? "isActive" : ""} aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</button></div>
      <div className="reviewStepper"><button type="button" onClick={() => stepScreen(-1)} aria-label="หน้าจอก่อนหน้า">←</button><span>{selectedIndex + 1} / {screens.length}</span><button type="button" onClick={() => stepScreen(1)} aria-label="หน้าจอถัดไป">→</button></div>
      <div className="componentSummary"><span>ชุดคอมโพเนนต์</span><Chips screen={selectedScreen} /></div>
    </section>
    <section id="review-stage" className={viewport === "mobile" ? "reviewStage reviewStage--mobile" : "reviewStage"} aria-label={`${selectedScreen.id} ${screenName(selectedScreen)} ${stateName(selectedState)} ${viewport}`}><div className="deviceFrame">{selectedScreen.id.startsWith("P") ? <ParticipantContent screen={selectedScreen} state={selectedState} /> : <ScreenContent screen={selectedScreen} state={selectedState} />}</div></section>
  </main>;
}

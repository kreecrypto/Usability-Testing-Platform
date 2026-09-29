"use client";

import { authenticatedFetch, SESSION_MESSAGE } from "../../../../lib/auth/client.ts";

import { useCallback, useEffect, useState } from "react";
import styles from "./method-builder.module.css";

type Kind = "survey" | "card_sort" | "tree_test";
type Block = { id: string; ordinal: number; kind: Kind; title: string; config: unknown };
type ScreenerQuestion = { id: string; prompt: string; options: { id: string; label: string }[]; accept: string[] };
type Version = { id: string; version_no: number; lifecycle_status: string; screener_config: { questions: ScreenerQuestion[] }; invite_only: boolean };
type State = { version: Version | null; blocks: Block[] };
type Question = { id: string; prompt: string; type: "single_choice" | "multi_choice" | "scale" | "text"; required: boolean; options?: { id: string; label: string }[]; min?: number; max?: number; showIf?: { questionId: string; equals: string } };
type TreeNode = { id: string; label: string; parentId: string | null };
type TreePrompt = { id: string; title: string; correctNodeId: string };
const labels: Record<Kind, string> = { survey: "Survey", card_sort: "Card Sorting", tree_test: "Tree Testing" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json" } : undefined });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { throw new Error(SESSION_MESSAGE); }
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "request_failed");
  return body as T;
}

function nextId(prefix: string, ids: readonly string[]): string {
  let index = 1;
  while (ids.includes(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}

function Editor({ block, kind, busy, onSave, onCancel }: { block?: Block; kind: Kind; busy: boolean; onSave: (title: string, config: unknown) => void; onCancel: () => void }) {
  const source = block?.config as Record<string, unknown> | undefined;
  const [title, setTitle] = useState(block?.title ?? "");
  const [questions, setQuestions] = useState<Question[]>((source?.questions as Question[] | undefined) ?? []);
  const [mode, setMode] = useState<"open" | "closed">((source?.mode as "open" | "closed" | undefined) ?? "closed");
  const [cardsText, setCardsText] = useState(((source?.cards as { label: string }[] | undefined) ?? []).map((item) => item.label).join("\n"));
  const [categoriesText, setCategoriesText] = useState(((source?.categories as { label: string }[] | undefined) ?? []).map((item) => item.label).join("\n"));
  const [nodes, setNodes] = useState<TreeNode[]>((source?.nodes as TreeNode[] | undefined) ?? [{ id: "root", label: "เริ่มต้น", parentId: null }]);
  const [prompts, setPrompts] = useState<TreePrompt[]>((source?.prompts as TreePrompt[] | undefined) ?? []);

  function patchQuestion(id: string, patch: Partial<Question>) { setQuestions((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (kind === "survey") onSave(title, { questions: questions.map((question) => ({ ...question,
      options: question.type === "single_choice" || question.type === "multi_choice" ? question.options : undefined,
      min: question.type === "scale" ? question.min : undefined, max: question.type === "scale" ? question.max : undefined })) });
    if (kind === "card_sort") {
      const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
      onSave(title, { mode, cards: lines(cardsText).map((label, index) => ({ id: `card_${index + 1}`, label })),
        categories: mode === "closed" ? lines(categoriesText).map((label, index) => ({ id: `category_${index + 1}`, label })) : [] });
    }
    if (kind === "tree_test") onSave(title, { nodes, prompts });
  }

  return <form className={styles.editor} onSubmit={save}>
    <label>ชื่อกิจกรรม<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={labels[kind]} /></label>
    {kind === "survey" ? <section><h3>คำถาม</h3>{questions.map((question, index) => <fieldset className={styles.item} key={question.id}>
      <legend>คำถาม {index + 1}</legend><label>ข้อความคำถาม<input required maxLength={500} value={question.prompt} onChange={(event) => patchQuestion(question.id, { prompt: event.target.value })} /></label>
      <label>ชนิดคำตอบ<select value={question.type} onChange={(event) => patchQuestion(question.id, { type: event.target.value as Question["type"], options: [ { id: "choice_1", label: "" }, { id: "choice_2", label: "" } ], min: 1, max: 7 })}>
        <option value="single_choice">เลือกข้อเดียว</option><option value="multi_choice">เลือกได้หลายข้อ</option><option value="scale">คะแนน</option><option value="text">ข้อความ</option>
      </select></label>
      <label className={styles.check}><input type="checkbox" checked={question.required} onChange={(event) => patchQuestion(question.id, { required: event.target.checked })} />บังคับตอบ</label>
      {(question.type === "single_choice" || question.type === "multi_choice") ? <div><p>ตัวเลือก</p>{question.options?.map((option, optionIndex) => <label key={option.id}>ตัวเลือก {optionIndex + 1}<input required value={option.label} onChange={(event) => patchQuestion(question.id, { options: question.options?.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) })} /></label>)}<button type="button" onClick={() => patchQuestion(question.id, { options: [...(question.options ?? []), { id: nextId("choice", (question.options ?? []).map((item) => item.id)), label: "" }] })}>เพิ่มตัวเลือก</button></div> : null}
      {question.type === "scale" ? <div className={styles.grid}><label>ต่ำสุด<input type="number" min={0} max={99} value={question.min ?? 1} onChange={(event) => patchQuestion(question.id, { min: Number(event.target.value) })} /></label><label>สูงสุด<input type="number" min={1} max={100} value={question.max ?? 7} onChange={(event) => patchQuestion(question.id, { max: Number(event.target.value) })} /></label></div> : null}
      {index > 0 ? <label>แสดงเมื่อคำถามก่อนหน้ามีคำตอบ<select value={question.showIf ? `${question.showIf.questionId}:${question.showIf.equals}` : ""} onChange={(event) => { const [questionId, equals] = event.target.value.split(":"); patchQuestion(question.id, { showIf: questionId ? { questionId, equals } : undefined }); }}><option value="">แสดงเสมอ</option>{questions.slice(0, index).filter((item) => item.type === "single_choice").flatMap((item) => (item.options ?? []).map((option) => <option key={`${item.id}:${option.id}`} value={`${item.id}:${option.id}`}>{item.prompt} = {option.label || option.id}</option>))}</select></label> : null}
      <button type="button" onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}>ลบคำถาม</button>
    </fieldset>)}<button type="button" onClick={() => setQuestions((items) => [...items, { id: nextId("question", items.map((item) => item.id)), prompt: "", type: "single_choice", required: true, options: [{ id: "choice_1", label: "" }, { id: "choice_2", label: "" }] }])}>เพิ่มคำถาม</button></section> : null}
    {kind === "card_sort" ? <section><label>รูปแบบ<select value={mode} onChange={(event) => setMode(event.target.value as "open" | "closed")}><option value="closed">Closed — กำหนดหมวดหมู่ไว้</option><option value="open">Open — ผู้เข้าร่วมตั้งชื่อหมวดหมู่</option></select></label><label>การ์ด (หนึ่งบรรทัดต่อใบ)<textarea required rows={7} value={cardsText} onChange={(event) => setCardsText(event.target.value)} /></label>{mode === "closed" ? <label>หมวดหมู่ (หนึ่งบรรทัดต่อหมวด)<textarea required rows={5} value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} /></label> : null}</section> : null}
    {kind === "tree_test" ? <section><h3>โครงสร้างหมวดหมู่</h3>{nodes.map((node) => <div className={styles.grid} key={node.id}><label>ชื่อหมวด<input required value={node.label} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, label: event.target.value } : item))} /></label><label>อยู่ใต้หมวด<select value={node.parentId ?? ""} disabled={node.parentId === null} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, parentId: event.target.value } : item))}><option value="">ราก</option>{nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>)}<button type="button" onClick={() => setNodes((items) => [...items, { id: nextId("node", items.map((item) => item.id)), label: "", parentId: items[0].id }])}>เพิ่มหมวด</button><h3>สิ่งที่ให้ผู้เข้าร่วมค้นหา</h3>{prompts.map((prompt) => <div className={styles.grid} key={prompt.id}><label>คำสั่ง<input required value={prompt.title} onChange={(event) => setPrompts((items) => items.map((item) => item.id === prompt.id ? { ...item, title: event.target.value } : item))} /></label><label>ตำแหน่งที่ถูกต้อง<select value={prompt.correctNodeId} onChange={(event) => setPrompts((items) => items.map((item) => item.id === prompt.id ? { ...item, correctNodeId: event.target.value } : item))}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label></div>)}<button type="button" onClick={() => setPrompts((items) => [...items, { id: nextId("prompt", items.map((item) => item.id)), title: "", correctNodeId: nodes[0].id }])}>เพิ่มโจทย์ค้นหา</button></section> : null}
    <div className={styles.actions}><button className={styles.primary} disabled={busy || !title.trim()} type="submit">{busy ? "กำลังบันทึก…" : "บันทึกกิจกรรม"}</button><button type="button" onClick={onCancel}>ยกเลิก</button></div>
  </form>;
}

function ScreenerEditor({ version, busy, onSave }: { version: Version; busy: boolean; onSave: (questions: ScreenerQuestion[], inviteOnly: boolean) => void }) {
  const [questions, setQuestions] = useState<ScreenerQuestion[]>(version.screener_config?.questions ?? []);
  const [inviteOnly, setInviteOnly] = useState(version.invite_only);
  return <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); onSave(questions, inviteOnly); }}>
    <label className={styles.check}><input type="checkbox" checked={inviteOnly} onChange={(event) => setInviteOnly(event.target.checked)} />ต้องใช้ลิงก์เชิญเฉพาะราย</label>
    <p>ผู้วิจัยแจกจ่ายลิงก์เอง ระบบไม่ส่งอีเมล คำตอบที่ไม่ตรงตัวเลือกที่รับจะจบก่อนเริ่ม session</p>
    {questions.map((question, index) => <fieldset className={styles.item} key={question.id}><legend>คำถามคัดกรอง {index + 1}</legend>
      <label>คำถาม<input required maxLength={500} value={question.prompt} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, prompt: event.target.value } : item))} /></label>
      {question.options.map((option, optionIndex) => <div className={styles.grid} key={option.id}><label>ตัวเลือก {optionIndex + 1}<input required maxLength={200} value={option.label} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, options: item.options.map((value) => value.id === option.id ? { ...value, label: event.target.value } : value) } : item))} /></label>
        <label className={styles.check}><input type="checkbox" checked={question.accept.includes(option.id)} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, accept: event.target.checked ? [...item.accept, option.id] : item.accept.filter((id) => id !== option.id) } : item))} />ผ่านเมื่อเลือกข้อนี้</label></div>)}
      <button type="button" onClick={() => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, options: [...item.options, { id: nextId("option", item.options.map((value) => value.id)), label: "" }] } : item))}>เพิ่มตัวเลือก</button>
      <button type="button" onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}>ลบคำถาม</button>
    </fieldset>)}
    <div className={styles.actions}><button type="button" onClick={() => setQuestions((items) => [...items, { id: nextId("screener", items.map((item) => item.id)), prompt: "", options: [{ id: "option_1", label: "" }, { id: "option_2", label: "" }], accept: ["option_1"] }])}>เพิ่มคำถามคัดกรอง</button><button className={styles.primary} disabled={busy} type="submit">บันทึกการคัดกรอง</button></div>
  </form>;
}

type Invite = { id: string; label: string; status: string; expires_at: string };
function Invites({ testId }: { testId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [label, setLabel] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/tests/${encodeURIComponent(testId)}/invites`;
  const load = useCallback(async () => { try { const result = await api<{ invites: Invite[] }>(endpoint); setInvites(result.invites); } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดลิงก์เชิญไม่สำเร็จ"); } }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try {
    const result = await api<{ link: string }>(endpoint, { method: "POST", body: JSON.stringify({ label, expiresInDays: 7 }) });
    setLink(result.link); setLabel(""); await load();
  } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้างลิงก์ไม่สำเร็จ"); } finally { setBusy(false); } }
  async function revoke(inviteId: string) { setBusy(true); setError(""); try { await api(endpoint, { method: "DELETE", body: JSON.stringify({ inviteId }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "ยกเลิกลิงก์ไม่สำเร็จ"); } finally { setBusy(false); } }
  return <section className={styles.panel}><h2>เชิญผู้เข้าร่วม</h2><p>ลิงก์ใช้ได้หนึ่งครั้งและหมดอายุใน 7 วัน คัดลอกลิงก์ทันที เพราะระบบจะแสดง token เพียงครั้งเดียว</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <form className={styles.editor} onSubmit={(event) => void create(event)}><label>ชื่ออ้างอิงสำหรับผู้วิจัย<input required maxLength={160} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="เช่น ผู้เข้าร่วม 01" /></label><button className={styles.primary} disabled={busy} type="submit">สร้างลิงก์เชิญ</button></form>
    {link ? <div className={styles.editor}><label>ลิงก์ที่สร้างใหม่<input readOnly value={link} onFocus={(event) => event.target.select()} /></label><button type="button" onClick={() => void navigator.clipboard.writeText(link)}>คัดลอกลิงก์</button></div> : null}
    <ul className={styles.blocks}>{invites.map((invite) => <li key={invite.id}><div><strong>{invite.label}</strong><span>{invite.status} · หมดอายุ {new Date(invite.expires_at).toLocaleDateString("th-TH")}</span></div>{invite.status === "pending" ? <button disabled={busy} onClick={() => void revoke(invite.id)}>ยกเลิก</button> : null}</li>)}</ul>
  </section>;
}

export default function MethodBuilderClient({ testId }: { testId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Block | null>(null);
  const [adding, setAdding] = useState<Kind | null>(null);
  const endpoint = `/api/tests/${encodeURIComponent(testId)}/methods`;
  const load = useCallback(async () => { try { setState(await api<State>(endpoint)); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดกิจกรรมไม่สำเร็จ"); } }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function initialize() { setBusy(true); try { setState(await api<State>(endpoint, { method: "POST", body: JSON.stringify({ action: "initialize" }) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้างฉบับร่างไม่สำเร็จ"); } finally { setBusy(false); } }
  async function save(title: string, config: unknown) {
    setBusy(true); setError("");
    try {
      if (editing) await api(endpoint, { method: "PUT", body: JSON.stringify({ blockId: editing.id, title, config }) });
      else await api(endpoint, { method: "POST", body: JSON.stringify({ action: "add", kind: adding, title, config }) });
      setEditing(null); setAdding(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function saveScreener(questions: ScreenerQuestion[], inviteOnly: boolean) {
    setBusy(true); setError("");
    try { await api(endpoint, { method: "POST", body: JSON.stringify({ action: "save_screener", config: { questions }, inviteOnly }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกการคัดกรองไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function remove(block: Block) {
    if (!window.confirm(`ลบกิจกรรม ${block.title}?`)) return;
    setBusy(true); setError("");
    try { await api(endpoint, { method: "DELETE", body: JSON.stringify({ blockId: block.id }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ลบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className={styles.shell}><header><p className={styles.kicker}>สร้างการทดสอบ · วิธีวิจัย</p><h1>Survey, Card Sorting และ Tree Testing</h1><p>เลือกกิจกรรมตามลำดับที่ผู้เข้าร่วมจะทำ คำตอบทุกชุดจะผูกกับเวอร์ชันที่เผยแพร่</p></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!state ? <p role="status">กำลังโหลด…</p> : !state.version ? <section className={styles.panel}><h2>เริ่มสร้างการศึกษา</h2><p>สร้างฉบับร่างสำหรับวิธีวิจัย โดยไม่ต้องตั้งค่า Prototype</p><button className={styles.primary} disabled={busy} onClick={() => void initialize()}>เริ่มสร้างกิจกรรม</button></section> : <>
      <section className={styles.panel}><h2>กิจกรรมในเวอร์ชัน {state.version.version_no}</h2>{state.blocks.length ? <ol className={styles.blocks}>{state.blocks.map((block) => <li key={block.id}><div><strong>{block.title}</strong><span>{labels[block.kind]}</span></div>{state.version?.lifecycle_status === "draft" ? <div className={styles.actions}><button onClick={() => { setEditing(block); setAdding(null); }}>แก้ไข</button><button disabled={busy} onClick={() => void remove(block)}>ลบ</button></div> : null}</li>)}</ol> : <p>ยังไม่มีกิจกรรม เพิ่มอย่างน้อยหนึ่งกิจกรรมก่อนเผยแพร่</p>}
      {state.version.lifecycle_status === "published" ? <button disabled={busy} onClick={() => void initialize()}>สร้างฉบับร่างใหม่จากเวอร์ชันนี้</button> : <div className={styles.actions}><button onClick={() => { setAdding("survey"); setEditing(null); }}>เพิ่ม Survey</button><button onClick={() => { setAdding("card_sort"); setEditing(null); }}>เพิ่ม Card Sorting</button><button onClick={() => { setAdding("tree_test"); setEditing(null); }}>เพิ่ม Tree Testing</button></div>}</section>
      {(editing || adding) && state.version.lifecycle_status === "draft" ? <section className={styles.panel}><h2>{editing ? `แก้ไข ${editing.title}` : `เพิ่ม ${labels[adding as Kind]}`}</h2><Editor key={editing?.id ?? adding} block={editing ?? undefined} kind={editing?.kind ?? adding as Kind} busy={busy} onSave={(title, config) => void save(title, config)} onCancel={() => { setEditing(null); setAdding(null); }} /></section> : null}
      {state.version.lifecycle_status === "draft" ? <section className={styles.panel}><h2>คัดกรองและลิงก์เชิญ</h2><ScreenerEditor key={state.version.id} version={state.version} busy={busy} onSave={(questions, inviteOnly) => void saveScreener(questions, inviteOnly)} /></section> : <Invites testId={testId} />}
      <nav className={styles.actions} aria-label="ขั้นตอนถัดไป"><a href={`/builder/${encodeURIComponent(testId)}/review`}>ตรวจสอบและเผยแพร่ →</a></nav>
    </>}
  </main>;
}

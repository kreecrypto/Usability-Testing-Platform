"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./method-runner.module.css";

type SurveyQuestion = { id: string; prompt: string; type: "single_choice" | "multi_choice" | "scale" | "text"; required: boolean; options?: { id: string; label: string }[]; min?: number; max?: number; showIf?: { questionId: string; equals: string } };
type SurveyConfig = { questions: SurveyQuestion[] };
type CardConfig = { mode: "open" | "closed"; cards: { id: string; label: string }[]; categories: { id: string; label: string }[] };
type TreeConfig = { nodes: { id: string; label: string; parentId: string | null }[]; prompts: { id: string; title: string }[] };
type Block = { id: string; ordinal: number; kind: "survey" | "card_sort" | "tree_test"; title: string; config: SurveyConfig | CardConfig | TreeConfig };
type Snapshot = { testId: string; testVersionId: string; versionNo: number; title: string; description: string | null; inviteOnly: boolean; screener: { questions: { id: string; prompt: string; options: { id: string; label: string }[] }[] }; blocks: Block[] };
type Stage = "loading" | "consent" | "running" | "complete" | "ineligible" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(body.error ?? "");
    if (/invite|expired|closed|not_found/.test(code)) throw new Error("ลิงก์นี้ใช้งานไม่ได้หรือหมดอายุ ติดต่อผู้ที่ส่งลิงก์เพื่อขอลิงก์ที่ใช้งานได้");
    if (response.status === 401 || response.status === 403) throw new Error("การเข้าใช้งานหมดอายุหรือไม่ได้รับอนุญาต ติดต่อผู้ที่ส่งลิงก์ให้คุณ");
    throw new Error("ส่งข้อมูลไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง ข้อมูลในหน้านี้ยังอยู่");
  }
  return body as T;
}

function SurveyForm({ config, busy, onSubmit }: { config: SurveyConfig; busy: boolean; onSubmit: (response: unknown) => void }) {
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [error, setError] = useState("");
  const visible = useMemo(() => config.questions.filter((question) => !question.showIf || answers[question.showIf.questionId] === question.showIf.equals), [answers, config]);
  function set(question: SurveyQuestion, value: string | string[] | number) {
    setAnswers((current) => {
      const next = { ...current, [question.id]: value };
      for (const candidate of config.questions) if (candidate.showIf && next[candidate.showIf.questionId] !== candidate.showIf.equals) delete next[candidate.id];
      return next;
    });
  }
  return <form onSubmit={(event) => { event.preventDefault();
    if (visible.some((question) => question.required && (answers[question.id] === undefined || answers[question.id] === "" || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)))) {
      setError("กรุณาตอบคำถามที่มีเครื่องหมาย * ให้ครบ"); return;
    }
    setError(""); onSubmit({ answers }); }}>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {visible.map((question) => <fieldset className={styles.question} key={question.id}>
      <legend>{question.prompt}{question.required ? <span aria-label="จำเป็น"> *</span> : null}</legend>
      {(question.type === "single_choice" || question.type === "multi_choice") ? question.options?.map((option) => <label className={styles.choice} key={option.id}>
        <input type={question.type === "single_choice" ? "radio" : "checkbox"} name={question.id} value={option.id} required={question.type === "single_choice" && question.required}
          checked={question.type === "single_choice" ? answers[question.id] === option.id : Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option.id)}
          onChange={() => question.type === "single_choice" ? set(question, option.id) : set(question,
            (Array.isArray(answers[question.id]) ? answers[question.id] as string[] : []).includes(option.id)
              ? (answers[question.id] as string[]).filter((id) => id !== option.id)
              : [...(Array.isArray(answers[question.id]) ? answers[question.id] as string[] : []), option.id])} />
        {option.label}
      </label>) : null}
      {question.type === "scale" ? <select value={answers[question.id] ?? ""} required={question.required} onChange={(event) => set(question, Number(event.target.value))}>
        <option value="">เลือกคะแนน</option>{Array.from({ length: (question.max ?? 7) - (question.min ?? 1) + 1 }, (_, index) => index + (question.min ?? 1)).map((value) => <option key={value} value={value}>{value}</option>)}
      </select> : null}
      {question.type === "text" ? <textarea rows={4} maxLength={5000} required={question.required} value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} onChange={(event) => set(question, event.target.value)} /> : null}
    </fieldset>)}
    <button className={styles.primary} type="submit" disabled={busy}>ส่งคำตอบและไปต่อ</button>
  </form>;
}

function CardForm({ config, busy, onSubmit }: { config: CardConfig; busy: boolean; onSubmit: (response: unknown) => void }) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState(config.categories);
  const [newCategory, setNewCategory] = useState("");
  function addCategory() {
    const label = newCategory.trim();
    if (!label || categories.some((item) => item.label.toLowerCase() === label.toLowerCase())) return;
    setCategories((current) => [...current, { id: `group_${current.length + 1}`, label }]);
    setNewCategory("");
  }
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ categories, placements: config.cards.map((card) => ({ cardId: card.id, categoryId: placements[card.id] })) }); }}>
    <p>จัดการ์ดทุกใบลงหมวดหมู่ที่เหมาะสม ใช้เมนูเลือกได้ทั้งเมาส์ การสัมผัส และคีย์บอร์ด</p>
    {config.mode === "open" ? <div className={styles.row}><label htmlFor="new-category">ชื่อหมวดหมู่ใหม่</label><input id="new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={100} /><button type="button" onClick={addCategory}>เพิ่มหมวดหมู่</button></div> : null}
    {config.cards.map((card) => <label className={styles.cardChoice} key={card.id}>{card.label}
      <select required value={placements[card.id] ?? ""} onChange={(event) => setPlacements((current) => ({ ...current, [card.id]: event.target.value }))}>
        <option value="">เลือกหมวดหมู่</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </select>
    </label>)}
    <button className={styles.primary} type="submit" disabled={busy || categories.length === 0}>ส่งการจัดกลุ่มและไปต่อ</button>
  </form>;
}

function TreeForm({ config, busy, onSubmit }: { config: TreeConfig; busy: boolean; onSubmit: (response: unknown) => void }) {
  const root = config.nodes.find((node) => node.parentId === null);
  const [attempts, setAttempts] = useState<{ promptId: string; path: string[]; trace: string[]; selectedNodeId: string; durationMs: number }[]>([]);
  const [path, setPath] = useState<string[]>(root ? [root.id] : []);
  const [trace, setTrace] = useState<string[]>(root ? [root.id] : []);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const prompt = config.prompts[attempts.length];
  const currentId = path.at(-1);
  const children = config.nodes.filter((node) => node.parentId === currentId);
  function finish() {
    if (!prompt || !currentId) return;
    const next = [...attempts, { promptId: prompt.id, path, trace, selectedNodeId: currentId, durationMs: Math.max(0, Date.now() - startedAt) }];
    if (next.length === config.prompts.length) onSubmit({ attempts: next });
    else { setAttempts(next); setPath(root ? [root.id] : []); setTrace(root ? [root.id] : []); setStartedAt(Date.now()); }
  }
  return <div>
    <p className={styles.kicker}>ข้อ {attempts.length + 1} จาก {config.prompts.length}</p><h3>{prompt?.title}</h3>
    <nav aria-label="เส้นทางโครงสร้างข้อมูล"><ol className={styles.breadcrumb}>{path.map((nodeId, index) => <li key={nodeId}><button type="button" onClick={() => { setTrace((current) => [...current, ...path.slice(index, -1).reverse()]); setPath(path.slice(0, index + 1)); }}>{config.nodes.find((node) => node.id === nodeId)?.label}</button></li>)}</ol></nav>
    {children.length ? <ul className={styles.tree}>{children.map((node) => <li key={node.id}><button type="button" onClick={() => { setPath([...path, node.id]); setTrace((current) => [...current, node.id]); }}>{node.label} →</button></li>)}</ul> : <p>ไม่มีหมวดหมู่ย่อย</p>}
    <button className={styles.primary} type="button" disabled={busy || !currentId} onClick={finish}>เลือกตำแหน่งนี้</button>
  </div>;
}

export default function MethodRunnerClient({ testVersionId }: { testVersionId: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [screenerAnswers, setScreenerAnswers] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const current = snapshot?.blocks.find((block) => !completed.includes(block.id));
  const load = useCallback(async () => {
    try {
      setStage("loading"); setError("");
      const result = await api<{ test: Snapshot }>(`/api/public/methods/${encodeURIComponent(testVersionId)}`);
      setSnapshot(result.test);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setInviteToken(fragment.get("invite") ?? "");
      const progressResponse = await fetch(`/api/public/methods/${encodeURIComponent(testVersionId)}/responses`, { cache: "no-store" });
      if (progressResponse.status === 401 || progressResponse.status === 404) { setStage("consent"); return; }
      const progress = await progressResponse.json() as { status: string; completedBlockIds: string[] };
      if (!progressResponse.ok) throw new Error("progress_unavailable");
      setCompleted(progress.completedBlockIds);
      setStage(progress.status === "completed" ? "complete" : "running");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดการทดสอบไม่สำเร็จ"); setStage("error"); }
  }, [testVersionId]);
  useEffect(() => { void load(); }, [load]);

  async function consent(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api<{ eligible: boolean }>(`/api/public/methods/${encodeURIComponent(testVersionId)}/start`, { method: "POST", body: JSON.stringify({ accepted, inviteToken, answers: screenerAnswers, locale: navigator.language }) });
      if (!result.eligible) { setStage("ineligible"); return; }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setCompleted([]); setStage("running");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เริ่มการทดสอบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function submit(response: unknown) {
    if (!current || busy) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ completed: boolean }>(`/api/public/methods/${encodeURIComponent(testVersionId)}/responses`, { method: "POST", body: JSON.stringify({ blockId: current.id, response }) });
      setCompleted((ids) => [...ids, current.id]);
      if (result.completed) setStage("complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกคำตอบไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  if (stage === "loading") return <main className={styles.shell}><p role="status">กำลังโหลดการทดสอบ…</p></main>;
  if (stage === "error" || !snapshot) return <main className={styles.shell}><h1>เปิดการทดสอบไม่ได้</h1><p role="alert">{error}</p><button onClick={() => void load()}>ลองอีกครั้ง</button></main>;
  return <main className={styles.shell}>
    <header><p className={styles.kicker}>การทดสอบ · เวอร์ชัน {snapshot.versionNo}</p><h1>{snapshot.title}</h1>{snapshot.description ? <p>{snapshot.description}</p> : null}</header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {stage === "consent" ? <section className={styles.panel}><h2>ก่อนเริ่มการทดสอบ</h2><p>เราจะบันทึกคำตอบและเส้นทางที่คุณเลือกเพื่อใช้วิเคราะห์ปัญหาการใช้งาน โดยไม่ต้องสร้างบัญชี</p><p>คุณสามารถหยุดได้ทุกเมื่อ คำตอบที่ส่งแล้วจะถูกเก็บตามนโยบายข้อมูลของการศึกษา</p>
      <form onSubmit={(event) => void consent(event)}>
        {snapshot.inviteOnly && !inviteToken ? <p role="alert">การศึกษานี้ต้องใช้ลิงก์เชิญเฉพาะราย กรุณาเปิดลิงก์ที่ผู้วิจัยส่งให้</p> : null}
        {snapshot.screener.questions.map((question) => <fieldset className={styles.question} key={question.id}><legend>{question.prompt} *</legend>{question.options.map((option) => <label className={styles.choice} key={option.id}><input type="radio" name={`screener_${question.id}`} value={option.id} required checked={screenerAnswers[question.id] === option.id} onChange={() => setScreenerAnswers((answers) => ({ ...answers, [question.id]: option.id }))} />{option.label}</label>)}</fieldset>)}
        <label className={styles.choice}><input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />ฉันยินยอมให้บันทึกคำตอบเพื่อการวิจัยนี้</label>
        <button className={styles.primary} type="submit" disabled={busy || (snapshot.inviteOnly && !inviteToken)}>ยินยอมและเริ่ม</button>
      </form>
    </section> : null}
    {stage === "ineligible" ? <section className={styles.panel}><h2>ขอบคุณที่สนใจ</h2><p>คำตอบคัดกรองของคุณไม่ตรงกับเงื่อนไขของการศึกษานี้ จึงไม่สามารถเข้าร่วมต่อได้</p></section> : null}
    {stage === "running" && current ? <section className={styles.panel} aria-labelledby="block-title">
      <p className={styles.kicker} role="status">กิจกรรม {completed.length + 1} จาก {snapshot.blocks.length}</p><p>{current.kind === "survey" ? "ตอบคำถามตามความคิดเห็นของคุณ แล้วกดส่งคำตอบเพื่อทำต่อ" : current.kind === "card_sort" ? "เลือกหมวดหมู่ให้แต่ละรายการตามความเข้าใจของคุณ แล้วส่งคำตอบ" : "อ่านโจทย์และเลือกตำแหน่งในเมนูที่คุณคาดว่าจะพบข้อมูลนั้น"}</p><h2 id="block-title">{current.title}</h2>
      {current.kind === "survey" ? <SurveyForm key={current.id} config={current.config as SurveyConfig} busy={busy} onSubmit={(value) => void submit(value)} /> : null}
      {current.kind === "card_sort" ? <CardForm key={current.id} config={current.config as CardConfig} busy={busy} onSubmit={(value) => void submit(value)} /> : null}
      {current.kind === "tree_test" ? <TreeForm key={current.id} config={current.config as TreeConfig} busy={busy} onSubmit={(value) => void submit(value)} /> : null}
    </section> : null}
    {stage === "complete" ? <section className={styles.panel}><h2>ขอบคุณที่ร่วมทดสอบ</h2><p>คำตอบของคุณถูกบันทึกแล้ว</p></section> : null}
  </main>;
}

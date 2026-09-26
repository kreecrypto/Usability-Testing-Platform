"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./post-task-question-builder.module.css";

type Toggle = { enabled: boolean; required: boolean };
type QuestionConfig = { seq: Toggle; openFeedback: Toggle };
type QuestionTask = { id: string; ordinal: number; title: string; config: QuestionConfig };
type State = "loading" | "ready" | "saving" | "error";
type Kind = "seq" | "openFeedback";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

export default function PostTaskQuestionBuilderClient({ testId }: { testId: string }) {
  const [tasks, setTasks] = useState<QuestionTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [draft, setDraft] = useState<QuestionConfig | null>(null);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api<{ tasks: QuestionTask[] }>(`/api/tests/${encodeURIComponent(testId)}/questions`)
      .then(({ tasks: loaded }) => {
        if (!active) return;
        setTasks(loaded);
        if (loaded[0]) { setSelectedTaskId(loaded[0].id); setDraft(loaded[0].config); }
        setState("ready");
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage("โหลดคำถามหลังงานไม่สำเร็จ");
      });
    return () => { active = false; };
  }, [testId]);

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);
  const validation = useMemo(() => {
    if (!draft) return null;
    if (draft.seq.required && !draft.seq.enabled) return "ตั้ง SEQ เป็นบังคับตอบไม่ได้เมื่อยังปิดคำถามนี้";
    if (draft.openFeedback.required && !draft.openFeedback.enabled) return "ตั้งความคิดเห็นเพิ่มเติมเป็นบังคับตอบไม่ได้เมื่อยังปิดคำถามนี้";
    return null;
  }, [draft]);

  function selectTask(task: QuestionTask) { setSelectedTaskId(task.id); setDraft(task.config); setMessage(null); setState("ready"); }
  function setEnabled(kind: Kind, enabled: boolean) { setDraft((current) => current ? { ...current, [kind]: { enabled, required: enabled ? current[kind].required : false } } : current); }
  function setRequired(kind: Kind, required: boolean) { setDraft((current) => current ? { ...current, [kind]: { ...current[kind], required } } : current); }

  async function save() {
    if (!selectedTask || !draft || validation) return;
    setState("saving");
    setMessage(null);
    try {
      const { task } = await api<{ task: QuestionTask }>(`/api/tests/${encodeURIComponent(testId)}/questions`, {
        method: "PUT",
        body: JSON.stringify({ taskId: selectedTask.id, config: draft }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      setDraft(task.config);
      setState("ready");
      setMessage(`บันทึกคำถามหลังงาน ${task.ordinal} แล้ว`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "บันทึกคำถามไม่สำเร็จ");
    }
  }

  const busy = state === "loading" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href={`/builder/${encodeURIComponent(testId)}/criteria`} className={styles.backLink}>← เกณฑ์จบงาน</a>
        <p className={styles.eyebrow}>สร้างการทดสอบ · คำถามหลังงาน</p>
        <h1>กำหนดคำถามหลังทำแต่ละงาน</h1>
        <p>เลือกว่าจะถามคะแนนความง่ายของงาน (SEQ) และความคิดเห็นเพิ่มเติมหรือไม่ พร้อมกำหนดว่าคำตอบใดเป็นข้อมูลที่ต้องตอบ</p>
      </header>

      {message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}
      {state === "loading" ? <div className={styles.empty} role="status">กำลังโหลดการตั้งค่าคำถาม…</div> : null}
      {state !== "loading" && tasks.length === 0 ? <div className={styles.empty}>ยังไม่มีงาน สร้างงานก่อนกำหนดคำถามหลังงาน</div> : null}

      {selectedTask && draft ? (
        <div className={styles.layout}>
          <aside className={styles.taskRail} aria-label="งานทดสอบ">
            <h2>งานทดสอบ</h2>
            {tasks.map((task) => (
              <button type="button" key={task.id} className={task.id === selectedTaskId ? styles.activeTask : styles.taskButton} onClick={() => selectTask(task)} disabled={busy}>
                <span>งาน {task.ordinal}</span><strong>{task.title}</strong>
              </button>
            ))}
          </aside>

          <section className={styles.card} aria-labelledby="question-editor-title">
            <div className={styles.cardHeader}><div><p className={styles.eyebrow}>งาน {selectedTask.ordinal}</p><h2 id="question-editor-title">{selectedTask.title}</h2></div></div>

            <fieldset className={styles.questionCard} disabled={busy}>
              <legend>SEQ</legend>
              <p>ให้ผู้เข้าร่วมให้คะแนนความง่ายของงานหลังทำเสร็จ</p>
              <label className={styles.checkRow}><input type="checkbox" checked={draft.seq.enabled} onChange={(event) => setEnabled("seq", event.target.checked)} /><span>ถามคะแนน SEQ หลังงานนี้</span></label>
              <label className={styles.checkRow}><input type="checkbox" checked={draft.seq.required} onChange={(event) => setRequired("seq", event.target.checked)} disabled={busy || !draft.seq.enabled} /><span>บังคับตอบ</span></label>
            </fieldset>

            <fieldset className={styles.questionCard} disabled={busy}>
              <legend>ความคิดเห็นเพิ่มเติม</legend>
              <p>ให้ผู้เข้าร่วมอธิบายว่าอะไรทำให้งานนี้ง่ายหรือยาก</p>
              <label className={styles.checkRow}><input type="checkbox" checked={draft.openFeedback.enabled} onChange={(event) => setEnabled("openFeedback", event.target.checked)} /><span>ถามความคิดเห็นหลังงานนี้</span></label>
              <label className={styles.checkRow}><input type="checkbox" checked={draft.openFeedback.required} onChange={(event) => setRequired("openFeedback", event.target.checked)} disabled={busy || !draft.openFeedback.enabled} /><span>บังคับตอบ</span></label>
            </fieldset>

            {validation ? <div className={styles.validation} role="alert">{validation}</div> : <div className={styles.valid} role="status">การตั้งค่าคำถามพร้อมบันทึก</div>}
            <button type="button" onClick={() => void save()} disabled={busy || Boolean(validation)}>{state === "saving" ? "กำลังบันทึก…" : "บันทึกคำถาม"}</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

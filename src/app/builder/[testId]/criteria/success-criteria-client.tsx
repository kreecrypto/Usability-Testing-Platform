"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./success-criteria.module.css";

type CriteriaTask = { id: string; ordinal: number; title: string; successNodeIds: string[]; failureNodeIds: string[]; editable: boolean };
type CriteriaDraft = { workspaceId: string; testVersionId: string; prototypeUrl: string; startNodeId: string; tasks: CriteriaTask[] };
type Editor = { startNodeId: string; successNodeIds: string; failureNodeIds: string };
type State = "loading" | "ready" | "saving" | "error";

function parseNodeList(value: string): string[] { return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))]; }
function canonicalNodeId(value: string): string { const trimmed = value.trim(); const match = /^(\d+)[-:](\d+)$/.exec(trimmed); return match ? `${match[1]}:${match[2]}` : trimmed; }
function overlap(success: string[], failure: string[]): string[] { const successSet = new Set(success.map(canonicalNodeId)); return failure.map(canonicalNodeId).filter((nodeId) => successSet.has(nodeId)); }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) { window.location.assign("/login"); throw new Error("authentication_required"); }
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  return body as T;
}

function editorFrom(draft: CriteriaDraft, task: CriteriaTask): Editor {
  return { startNodeId: draft.startNodeId, successNodeIds: task.successNodeIds.join(", "), failureNodeIds: task.failureNodeIds.join(", ") };
}

export default function SuccessCriteriaClient({ testId }: { testId: string }) {
  const [draft, setDraft] = useState<CriteriaDraft | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [editor, setEditor] = useState<Editor>({ startNodeId: "", successNodeIds: "", failureNodeIds: "" });
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api<{ draft: CriteriaDraft }>(`/api/tests/${encodeURIComponent(testId)}/criteria`)
      .then(({ draft: loaded }) => {
        if (!active) return;
        setDraft(loaded);
        const first = loaded.tasks[0];
        if (first) { setSelectedTaskId(first.id); setEditor(editorFrom(loaded, first)); }
        setState("ready");
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage(String(error).includes("prototype_not_configured") ? "เชื่อมต่อและบันทึกต้นแบบ Figma ก่อนกำหนดเกณฑ์จบงาน" : "โหลดเกณฑ์ของงานไม่สำเร็จ");
      });
    return () => { active = false; };
  }, [testId]);

  const selectedTask = useMemo(() => draft?.tasks.find((task) => task.id === selectedTaskId) ?? null, [draft, selectedTaskId]);
  const success = useMemo(() => parseNodeList(editor.successNodeIds), [editor.successNodeIds]);
  const failure = useMemo(() => parseNodeList(editor.failureNodeIds), [editor.failureNodeIds]);
  const conflicts = useMemo(() => overlap(success, failure), [success, failure]);
  const validation = useMemo(() => {
    if (!editor.startNodeId.trim()) return "ต้องระบุ Node เริ่มต้น";
    if (success.length === 0) return "ต้องมี Node สำเร็จอย่างน้อย 1 จุด";
    if (failure.length === 0) return "ต้องมี Node ไม่สำเร็จอย่างน้อย 1 จุด";
    if (conflicts.length > 0) return `Node เดียวกันเป็นทั้งสำเร็จและไม่สำเร็จไม่ได้: ${conflicts.join(", ")}`;
    return null;
  }, [editor.startNodeId, success, failure, conflicts]);

  function selectTask(taskId: string) {
    if (!draft) return;
    const task = draft.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    setSelectedTaskId(taskId);
    setEditor(editorFrom(draft, task));
    setMessage(null);
    setState("ready");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !selectedTask || validation || !selectedTask.editable) return;
    setState("saving");
    setMessage(null);
    try {
      const { mapping } = await api<{ mapping: { startNodeId: string; successNodeIds: string[]; failureNodeIds: string[] } }>(`/api/tasks/${encodeURIComponent(selectedTask.id)}/frame-mapping`, {
        method: "PATCH",
        body: JSON.stringify({ workspaceId: draft.workspaceId, testVersionId: draft.testVersionId, prototypeUrl: draft.prototypeUrl, startNodeId: editor.startNodeId, successNodeIds: success, failureNodeIds: failure }),
      });
      const nextTasks = draft.tasks.map((task) => task.id === selectedTask.id ? { ...task, successNodeIds: mapping.successNodeIds, failureNodeIds: mapping.failureNodeIds } : task);
      const nextDraft = { ...draft, startNodeId: mapping.startNodeId, tasks: nextTasks };
      setDraft(nextDraft);
      setEditor({ startNodeId: mapping.startNodeId, successNodeIds: mapping.successNodeIds.join(", "), failureNodeIds: mapping.failureNodeIds.join(", ") });
      setState("ready");
      setMessage(`บันทึกเกณฑ์ของงาน ${selectedTask.ordinal} แล้ว`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "บันทึกเกณฑ์ไม่สำเร็จ");
    }
  }

  const busy = state === "loading" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href={`/builder/${encodeURIComponent(testId)}/tasks`} className={styles.backLink}>← งานทดสอบ</a>
        <p className={styles.eyebrow}>สร้างการทดสอบ · เกณฑ์จบงาน</p>
        <h1>กำหนดจุดสำเร็จและไม่สำเร็จ</h1>
        <p>ใช้ Figma Node ID ที่ชัดเจนจากต้นแบบ จุดสำเร็จและจุดไม่สำเร็จต้องไม่ซ้ำกันเพื่อให้ผลลัพธ์ของงานตัดสินได้แน่นอน</p>
      </header>

      {message ? <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>{message}</div> : null}
      {state === "loading" ? <div className={styles.empty} role="status">กำลังโหลดเกณฑ์…</div> : null}
      {state !== "loading" && draft && draft.tasks.length === 0 ? <div className={styles.empty}>ยังไม่มีงาน สร้างงานก่อนกำหนดเกณฑ์สำเร็จและไม่สำเร็จ</div> : null}

      {draft && selectedTask ? (
        <div className={styles.layout}>
          <aside className={styles.taskRail} aria-label="งานทดสอบ">
            <h2>งานทดสอบ</h2>
            {draft.tasks.map((task) => (
              <button type="button" key={task.id} className={task.id === selectedTaskId ? styles.activeTask : styles.taskButton} onClick={() => selectTask(task.id)} disabled={busy}>
                <span>งาน {task.ordinal}</span><strong>{task.title}</strong>
              </button>
            ))}
          </aside>

          <section className={styles.card} aria-labelledby="criteria-title">
            <div className={styles.cardHeader}>
              <div><p className={styles.eyebrow}>งาน {selectedTask.ordinal}</p><h2 id="criteria-title">{selectedTask.title}</h2></div>
              <span className={selectedTask.editable ? styles.statusReady : styles.statusBlocked}>{selectedTask.editable ? "แก้ไขได้" : "เกณฑ์นี้ยังไม่รองรับ"}</span>
            </div>

            {!selectedTask.editable ? <div className={styles.warning} role="alert">งานนี้มีเกณฑ์ชนิดที่อยู่นอกขอบเขต presented-node ปัจจุบัน ระบบจะไม่เขียนทับเกณฑ์เดิมโดยอัตโนมัติ</div> : null}

            <form className={styles.form} onSubmit={save}>
              <label><span>Node เริ่มต้น</span><input value={editor.startNodeId} onChange={(event) => setEditor({ ...editor, startNodeId: event.target.value })} placeholder="5:3" disabled={busy || !selectedTask.editable} required /></label>
              <label><span>Node ที่ถือว่าสำเร็จ</span><textarea rows={4} value={editor.successNodeIds} onChange={(event) => setEditor({ ...editor, successNodeIds: event.target.value })} placeholder="10:20, 10:21" disabled={busy || !selectedTask.editable} required /><small>แยกหลาย Node ด้วยเครื่องหมายจุลภาค เว้นวรรค หรือขึ้นบรรทัดใหม่</small></label>
              <label><span>Node ที่ถือว่าไม่สำเร็จ</span><textarea rows={4} value={editor.failureNodeIds} onChange={(event) => setEditor({ ...editor, failureNodeIds: event.target.value })} placeholder="30:40" disabled={busy || !selectedTask.editable} required /></label>

              {validation ? <div className={styles.validation} role="alert">{validation}</div> : <div className={styles.valid} role="status">ไม่พบ Node ที่ขัดแย้งกัน</div>}
              <button type="submit" disabled={busy || Boolean(validation) || !selectedTask.editable}>{state === "saving" ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

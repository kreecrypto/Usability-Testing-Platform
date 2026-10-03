"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  STORAGE_KEY,
  uid,
  now,
  banraoTasks,
  decodeStore,
  saveStore,
  publish,
  newRound,
  startSession,
  answerSession,
  submitSession,
  addFinding,
  makeReport,
  taskSummary,
  comparableTasks,
  type Store,
  type Answer,
  type Version,
} from "../../lib/trial/model";
import styles from "./trial.module.css";
const steps = [
  ["projects", "โปรเจกต์"],
  ["test", "แบบทดสอบ"],
  ["results", "ผลการทดสอบ"],
  ["findings", "ข้อค้นพบ"],
  ["report", "รายงาน"],
  ["retest", "ทดลองรอบใหม่"],
] as const;
type Location = { step: string; p: string; t: string; v: string; s: string };
const initialLocation: Location = {
  step: "projects",
  p: "",
  t: "",
  v: "",
  s: "",
};
const outcomes = { done: "ทำได้", not_done: "ทำไม่ได้", skipped: "ข้าม" };
function readLocation(): Location {
  const q = new URLSearchParams(window.location.search);
  return {
    step: q.get("step") || "projects",
    p: q.get("p") || "",
    t: q.get("t") || "",
    v: q.get("v") || "",
    s: q.get("s") || "",
  };
}
function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
const text = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();
export default function TrialWorkspace() {
  const [store, setStore] = useState<Store | null>(null);
  const [loc, setLoc] = useState(initialLocation);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const rawRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [blocked, setBlocked] = useState(false);
  const load = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const s = decodeStore(raw);
      rawRef.current = raw;
      setStore(s);
      setBlocked(false);
      setError("");
      setSaved("โหลดข้อมูลที่เก็บในเบราว์เซอร์แล้ว");
    } catch (e) {
      setBlocked(true);
      setError(
        e instanceof Error
          ? e.message
          : "เปิดพื้นที่เก็บข้อมูลไม่ได้ ตรวจการอนุญาตของเบราว์เซอร์ แล้วลองโหลดใหม่",
      );
    }
  };
  useEffect(() => {
    load();
    setLoc(readLocation());
    const pop = () => setLoc(readLocation());
    const changed = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setBlocked(true);
        setError("ข้อมูลเปลี่ยนในแท็บอื่น โหลดข้อมูลล่าสุดก่อนทำต่อ");
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("storage", changed);
    };
  }, []);
  const move = (patch: Partial<Location>) => {
    const next = { ...loc, ...patch };
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    window.history.pushState(null, "", `/trial?${q}`);
    setLoc(next);
    setError("");
  };
  const commit = (fn: (s: Store) => Store): Store | null => {
    if (!store || blocked) return null;
    try {
      const next = fn(store);
      const raw = saveStore(window.localStorage, next, rawRef.current);
      const persisted = decodeStore(raw);
      rawRef.current = raw;
      setStore(persisted);
      setError("");
      setSaved("บันทึกในเบราว์เซอร์แล้ว");
      return persisted;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "บันทึกไม่ได้ พื้นที่จัดเก็บอาจเต็มหรือถูกปิด ตรวจการตั้งค่าแล้วลองบันทึกอีกครั้ง",
      );
      setSaved("ยังไม่ได้บันทึกการเปลี่ยนแปลง");
      return null;
    }
  };
  const project = store?.projects.find((p) => p.id === loc.p);
  const test = store?.tests.find(
    (t) => t.id === loc.t && t.projectId === project?.id,
  );
  const versions = store?.versions.filter((v) => v.testId === test?.id) || [];
  const version = versions.find((v) => v.id === loc.v);
  const session = store?.sessions.find(
    (s) => s.id === loc.s && s.versionId === version?.id,
  );
  const findings =
    store?.findings.filter((f) => f.versionId === version?.id) || [];
  const report = store?.reports
    .filter((r) => r.versionId === version?.id)
    .at(-1);
  const runner = loc.step === "participant";
  useEffect(() => {
    if (!window.location.hash) headingRef.current?.focus();
  }, [loc.step, loc.v, session?.answers.length, Boolean(store)]);
  const begin = () => {
    if (!version) return;
    let sessionId = "";
    const next = commit((s) => {
      const started = startSession(s, version.id);
      sessionId = started.session.id;
      return started.store;
    });
    if (next) move({ step: "participant", s: sessionId });
  };
  const linkToEvidence = (sessionId: string, taskId: string) =>
    `/trial?step=results&p=${loc.p}&t=${loc.t}&v=${loc.v}#answer-${sessionId}-${taskId}`;
  function evidenceCards(v: Version) {
    return store!.sessions
      .filter((s) => s.versionId === v.id && s.submittedAt)
      .map((s, i) => (
        <section className={styles.card} key={s.id}>
          <h3>รอบทดลอง {i + 1}</h3>
          {s.answers.map((a) => (
            <article
              id={`answer-${s.id}-${a.taskId}`}
              key={a.taskId}
              className={styles.evidence}
            >
              <h4>{v.tasks.find((t) => t.id === a.taskId)?.instruction}</h4>
              <p>
                รายงานว่า: {outcomes[a.outcome]} · ความง่าย:{" "}
                {a.ease === null ? "ไม่ได้ให้คะแนน" : `${a.ease}/7`}
              </p>
              <p>{a.feedback || "ไม่มีความคิดเห็นเพิ่มเติม"}</p>
              <small>
                รอบ {s.id} · เวอร์ชัน {v.number}
              </small>
            </article>
          ))}
        </section>
      ));
  }
  return (
    <div className={`${styles.shell} ${runner ? styles.runner : ""}`}>
      {!runner && (
        <aside className={styles.sidebar}>
          <a className={styles.brand} href="/">
            UT Platform
          </a>
          <p>พื้นที่ทดลองในเบราว์เซอร์</p>
          <nav aria-label="ขั้นตอนทำงาน">
            {steps.map(([step, label]) => (
              <button
                key={step}
                aria-current={loc.step === step ? "step" : undefined}
                onClick={() => move({ step, s: "" })}
              >
                {label}
              </button>
            ))}
          </nav>
          <a href="/demo/projects">ดู Demo อ่านอย่างเดียว</a>
        </aside>
      )}
      <main className={styles.main}>
        <div className={styles.notice}>
          <strong>พื้นที่ทดลอง</strong>
          <span>
            ข้อมูลเก็บเฉพาะเบราว์เซอร์นี้ ไม่ส่งไปยังฐานข้อมูล
            และไม่แชร์คำตอบข้ามเครื่อง
          </span>
        </div>
        <p className={styles.meta}>
          ไม่เก็บคลิก เส้นทาง หรือ Heatmap จากเว็บไซต์ปลายทาง ·
          อย่ากรอกข้อมูลส่วนบุคคล
        </p>
        <p role="status" className={styles.meta}>
          {saved}
        </p>
        {error && (
          <div role="alert" className={styles.error}>
            {error}
            <button onClick={load}>โหลดข้อมูลล่าสุด</button>
            <p>
              หากบันทึกไม่ได้ ให้ตรวจพื้นที่จัดเก็บ แล้วลองส่งอีกครั้ง
              การโหลดใหม่จะใช้ข้อมูลที่บันทึกสำเร็จล่าสุด
            </p>
          </div>
        )}
        {!store ? (
          <p>
            {blocked
              ? "ยังเปิดพื้นที่ทดลองไม่ได้ ข้อมูลเดิมไม่ได้ถูกลบ"
              : "กำลังเปิดพื้นที่ทดลอง…"}
          </p>
        ) : (
          <>
            {!runner && (
              <>
                <header className={styles.header}>
                  <div>
                    <p>Project → Test → Results → Finding → Report → Retest</p>
                    <h1 ref={headingRef} tabIndex={-1}>
                      {steps.find(([s]) => s === loc.step)?.[1] ||
                        "ไม่พบขั้นตอนนี้"}
                    </h1>
                  </div>
                  <a href="/">หน้าหลัก</a>
                </header>
                {project && (
                  <p>
                    โปรเจกต์: {project.name}
                    {test && ` / แบบทดสอบ: ${test.title}`}
                    {version && ` / เวอร์ชัน ${version.number}`}
                  </p>
                )}
                {test && (
                  <label className={styles.version}>
                    เวอร์ชันที่ต้องการดู
                    <select
                      value={loc.v}
                      onChange={(e) => move({ v: e.target.value, s: "" })}
                    >
                      <option value="">เลือกเวอร์ชันที่เผยแพร่แล้ว</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          เวอร์ชัน {v.number} — {v.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <fieldset disabled={blocked} className={styles.scope}>
              {loc.step === "projects" && (
                <>
                  <section className={styles.card}>
                    <h2>เริ่มโปรเจกต์ใหม่</h2>
                    <p>
                      โปรเจกต์ใช้รวมแบบทดสอบของงานเดียวกัน เริ่มด้วยเว็บบ้านเรา
                      UAT ได้ทันที
                    </p>
                    <form
                      onSubmit={(e) => {
                        const d = formValues(e);
                        const name = text(d, "name");
                        const goal = text(d, "goal");
                        if (!name || !goal) {
                          setError("กรอกชื่อและเป้าหมายโปรเจกต์");
                          return;
                        }
                        const id = uid();
                        if (
                          commit((s) => ({
                            ...s,
                            projects: [...s.projects, { id, name, goal }],
                          }))
                        )
                          move({ p: id, t: "", v: "", s: "" });
                      }}
                    >
                      <label>
                        ชื่อโปรเจกต์
                        <input
                          name="name"
                          defaultValue="บ้านเรา — ทดลองจัดการบ้านเช่า"
                          required
                          maxLength={200}
                        />
                      </label>
                      <label>
                        เป้าหมาย
                        <textarea
                          name="goal"
                          defaultValue="ทดลองเตรียมงาน เก็บคำตอบ และสรุปข้อค้นพบผ่าน Workflow UTP"
                          required
                          maxLength={2000}
                        />
                      </label>
                      <button className={styles.primary}>สร้างโปรเจกต์</button>
                    </form>
                  </section>
                  <section className={styles.card}>
                    <h2>โปรเจกต์ในเบราว์เซอร์นี้</h2>
                    {!store.projects.length && (
                      <p>ยังไม่มีโปรเจกต์ เริ่มจากแบบฟอร์มด้านบน</p>
                    )}
                    {store.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => move({ p: p.id, t: "", v: "", s: "" })}
                      >
                        {p.name}
                      </button>
                    ))}
                  </section>
                  {project && (
                    <section className={styles.card}>
                      <h2>{project.name}</h2>
                      <form
                        key={project.id}
                        onSubmit={(e) => {
                          const d = formValues(e);
                          commit((s) => ({
                            ...s,
                            projects: s.projects.map((p) =>
                              p.id === project.id
                                ? {
                                    ...p,
                                    name: text(d, "name"),
                                    goal: text(d, "goal"),
                                  }
                                : p,
                            ),
                          }));
                        }}
                      >
                        <label>
                          ชื่อโปรเจกต์
                          <input
                            name="name"
                            defaultValue={project.name}
                            required
                            maxLength={200}
                          />
                        </label>
                        <label>
                          เป้าหมาย
                          <textarea
                            name="goal"
                            defaultValue={project.goal}
                            required
                            maxLength={2000}
                          />
                        </label>
                        <button>บันทึกโปรเจกต์</button>
                      </form>
                      <h3>แบบทดสอบทั้งหมด</h3>
                      {store.tests
                        .filter((t) => t.projectId === project.id)
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() =>
                              move({
                                step: "test",
                                t: t.id,
                                v:
                                  store.versions
                                    .filter((v) => v.testId === t.id)
                                    .at(-1)?.id || "",
                                s: "",
                              })
                            }
                          >
                            {t.title}
                          </button>
                        ))}
                      <button
                        className={styles.primary}
                        onClick={() => {
                          const id = uid();
                          const title = "ทดลองค้นหาข้อมูลบ้านเช่า";
                          if (
                            commit((s) => ({
                              ...s,
                              tests: [
                                ...s.tests,
                                {
                                  id,
                                  projectId: project.id,
                                  title,
                                  draft: {
                                    testId: id,
                                    title,
                                    url: "https://banrao-uat.pages.dev",
                                    tasks: banraoTasks(),
                                  },
                                },
                              ],
                            }))
                          )
                            move({ step: "test", t: id, v: "", s: "" });
                        }}
                      >
                        สร้างแบบทดสอบเว็บไซต์
                      </button>
                    </section>
                  )}
                </>
              )}
              {loc.step === "test" && test && (
                <>
                  {test.draft ? (
                    <section className={styles.card}>
                      <h2>1. ตั้งค่าแบบทดสอบ</h2>
                      {test.draft.parentId && (
                        <p>
                          ฉบับร่างรอบใหม่จากเวอร์ชัน{" "}
                          {
                            versions.find((v) => v.id === test.draft?.parentId)
                              ?.number
                          }{" "}
                          — ยังไม่เผยแพร่
                        </p>
                      )}
                      <p>
                        อ่านข้อมูลบนเว็บไซต์เท่านั้น อย่าเพิ่มบ้าน บันทึกการชำระ
                        หรือเปลี่ยนสถานะงาน
                      </p>
                      <form
                        key={`${test.id}-${test.draft.parentId || "initial"}`}
                        onSubmit={(e) => {
                          const d = formValues(e);
                          commit((s) => ({
                            ...s,
                            tests: s.tests.map((t) =>
                              t.id === test.id && t.draft
                                ? {
                                    ...t,
                                    draft: {
                                      ...t.draft,
                                      title: text(d, "title"),
                                      url: text(d, "url"),
                                      tasks: t.draft.tasks.map((task) => ({
                                        ...task,
                                        instruction: text(d, task.id),
                                      })),
                                    },
                                  }
                                : t,
                            ),
                          }));
                        }}
                      >
                        <label>
                          ชื่อแบบทดสอบ
                          <input
                            name="title"
                            defaultValue={test.draft.title}
                            required
                            maxLength={200}
                          />
                        </label>
                        <label>
                          ลิงก์เว็บไซต์
                          <input
                            name="url"
                            type="url"
                            defaultValue={test.draft.url}
                            required
                          />
                        </label>
                        {test.draft.tasks.map((task, i) => (
                          <label key={task.id}>
                            โจทย์ {i + 1}
                            <textarea
                              name={task.id}
                              defaultValue={task.instruction}
                              required
                              maxLength={2000}
                            />
                          </label>
                        ))}
                        <button>บันทึกฉบับร่าง</button>
                      </form>
                      <h2>2. ตรวจสอบและเผยแพร่</h2>
                      <p>
                        ด้านล่างคือฉบับที่บันทึกไว้
                        ตรวจว่าเป็นงานอ่านข้อมูลก่อนเผยแพร่ หากเพิ่งแก้แบบฟอร์ม
                        ให้กดบันทึกฉบับร่างก่อน
                      </p>
                      <h3>{test.draft.title}</h3>
                      <p className={styles.url}>{test.draft.url}</p>
                      <ol>
                        {test.draft.tasks.map((t) => (
                          <li key={t.id}>{t.instruction}</li>
                        ))}
                      </ol>
                      <button
                        className={styles.primary}
                        onClick={() => {
                          const next = commit((s) => publish(s, test.id));
                          if (next) move({ v: next.versions.at(-1)!.id });
                        }}
                      >
                        เผยแพร่ฉบับที่บันทึกไว้
                      </button>
                    </section>
                  ) : (
                    <section className={styles.card}>
                      <h2>เผยแพร่แล้ว</h2>
                      <p>
                        นิยามที่เผยแพร่แก้ย้อนหลังไม่ได้ เริ่มทดลอง
                        หรือสร้างฉบับร่างรอบใหม่จากเมนูทดลองรอบใหม่
                      </p>
                    </section>
                  )}
                  {version && (
                    <section className={styles.card}>
                      <h2>3. ทดลองทำแบบทดสอบ · เวอร์ชัน {version.number}</h2>
                      <p>
                        เปิดเว็บไซต์แล้วกลับมาตอบทีละข้อ ไม่ต้องเข้าสู่ระบบ
                        ลิงก์พื้นที่ทดลองใช้กับข้อมูลในเบราว์เซอร์นี้เท่านั้น
                      </p>
                      <button className={styles.primary} onClick={begin}>
                        เริ่มหรือทำรอบที่ค้างต่อ
                      </button>
                      <button onClick={() => move({ step: "results" })}>
                        ดูผลการทดสอบ
                      </button>
                    </section>
                  )}
                </>
              )}
              {runner && version && session && (
                <section className={styles.card}>
                  <h1>{version.title}</h1>
                  <p>
                    เวอร์ชัน {version.number} · คำตอบบันทึกในเครื่องนี้
                    คุณสามารถกลับมาทำต่อได้
                  </p>
                  {session.submittedAt ? (
                    <>
                      <h2>ส่งคำตอบแล้ว</h2>
                      <p>รอบนี้ส่งครบแล้ว การเปิดซ้ำจะไม่เพิ่มคำตอบ</p>
                      <button onClick={() => move({ step: "results", s: "" })}>
                        กลับไปดูผลการทดสอบ
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        บันทึกแล้ว {session.answers.length} จาก{" "}
                        {version.tasks.length} ข้อ
                      </p>
                      <progress
                        value={session.answers.length}
                        max={version.tasks.length}
                        aria-label="ความคืบหน้าของคำตอบ"
                      />
                      {(() => {
                        const task = version.tasks.find(
                          (t) =>
                            !session.answers.some((a) => a.taskId === t.id),
                        );
                        return task ? (
                          <form
                            key={`${session.id}-${task.id}`}
                            onSubmit={(e) => {
                              const d = formValues(e);
                              const answer: Answer = {
                                taskId: task.id,
                                outcome: text(
                                  d,
                                  "outcome",
                                ) as Answer["outcome"],
                                ease: text(d, "ease")
                                  ? Number(text(d, "ease"))
                                  : null,
                                feedback: text(d, "feedback"),
                              };
                              commit((s) =>
                                answerSession(s, session.id, answer),
                              );
                            }}
                          >
                            <h2 ref={headingRef} tabIndex={-1}>
                              โจทย์ {version.tasks.indexOf(task) + 1}
                            </h2>
                            <p>{task.instruction}</p>
                            <a
                              className={styles.primary}
                              href={version.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              เปิดเว็บไซต์ในแท็บใหม่
                            </a>
                            <p>
                              เมื่อทดลองแล้วให้กลับมาแท็บนี้ หากเว็บเปิดไม่ได้
                              ให้ระบุในความคิดเห็น โดยไม่เปลี่ยนข้อมูลบนเว็บไซต์
                            </p>
                            <label>
                              คุณทำโจทย์นี้ได้หรือไม่
                              <select name="outcome" defaultValue="" required>
                                <option value="" disabled>
                                  เลือกคำตอบ
                                </option>
                                {Object.entries(outcomes).map(([v, label]) => (
                                  <option key={v} value={v}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              รู้สึกว่าง่ายเพียงใด (ไม่บังคับ)
                              <select name="ease" defaultValue="">
                                <option value="">ไม่ให้คะแนน</option>
                                {Array.from({ length: 7 }, (_, i) => (
                                  <option value={i + 1} key={i}>
                                    {i + 1}
                                    {i === 0
                                      ? " — ยากมาก"
                                      : i === 6
                                        ? " — ง่ายมาก"
                                        : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              สิ่งที่พบหรือปัญหา (ไม่บังคับ)
                              <textarea name="feedback" maxLength={4000} />
                            </label>
                            <button className={styles.primary}>
                              บันทึกและไปข้อถัดไป
                            </button>
                          </form>
                        ) : (
                          <>
                            <h2 ref={headingRef} tabIndex={-1}>
                              ตรวจคำตอบก่อนส่ง
                            </h2>
                            {session.answers.map((a) => (
                              <p key={a.taskId}>
                                {
                                  version.tasks.find((t) => t.id === a.taskId)
                                    ?.instruction
                                }{" "}
                                — {outcomes[a.outcome]}
                                {a.feedback && ` · ${a.feedback}`}
                              </p>
                            ))}
                            <button
                              className={styles.primary}
                              onClick={() => {
                                if (commit((s) => submitSession(s, session.id)))
                                  move({ step: "results", s: "" });
                              }}
                            >
                              ส่งคำตอบทั้งหมด
                            </button>
                          </>
                        );
                      })()}
                      <button onClick={() => move({ step: "test", s: "" })}>
                        พักไว้และกลับไปแบบทดสอบ
                      </button>
                    </>
                  )}
                </section>
              )}
              {loc.step === "results" && version && (
                <>
                  <section className={styles.card}>
                    <h2>คำตอบของเวอร์ชัน {version.number}</h2>
                    <p>
                      เริ่มแล้ว{" "}
                      {
                        store.sessions.filter((s) => s.versionId === version.id)
                          .length
                      }{" "}
                      รอบ · ส่งครบ{" "}
                      {
                        store.sessions.filter(
                          (s) => s.versionId === version.id && s.submittedAt,
                        ).length
                      }{" "}
                      รอบ
                    </p>
                    <p>
                      ตัวเลขต่อไปนี้มาจากคำตอบของผู้ทดลอง
                      ไม่ใช่ความสำเร็จที่ตรวจจับจากเว็บไซต์
                    </p>
                    <p>
                      คลิก / เส้นทาง / Heatmap: ไม่รองรับ —
                      ยังไม่ได้เชื่อมตัวเก็บพฤติกรรม
                    </p>
                  </section>
                  {version.tasks.map((t, i) => {
                    const x = taskSummary(store, version.id, t.id);
                    return (
                      <section key={t.id} className={styles.card}>
                        <h3>
                          โจทย์ {i + 1}: {t.instruction}
                        </h3>
                        {!x.count ? (
                          <p>
                            ยังไม่มีคำตอบที่ส่งครบ
                            เริ่มทดลองหรือกลับมาส่งรอบที่ค้าง
                          </p>
                        ) : (
                          <>
                            <p>
                              จำนวนคำตอบ {x.count} · ทำได้ {x.done} · ทำไม่ได้{" "}
                              {x.notDone} · ข้าม {x.skipped}
                            </p>
                            <p>
                              คะแนนความง่าย:{" "}
                              {x.scoreCount
                                ? `${x.scoreCount} คำตอบ`
                                : "ยังไม่มีคะแนน"}
                            </p>
                            {x.scoreCount > 0 && (
                              <ul>
                                {x.scores.map((s) => (
                                  <li key={s.score}>
                                    คะแนน {s.score}: {s.count} คำตอบ
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </section>
                    );
                  })}
                  {evidenceCards(version)}
                  <button onClick={begin}>เริ่มหรือทำรอบที่ค้างต่อ</button>
                  <button
                    className={styles.primary}
                    onClick={() => move({ step: "findings" })}
                  >
                    สร้างข้อค้นพบจากคำตอบ
                  </button>
                </>
              )}
              {loc.step === "findings" && version && (
                <>
                  <section className={styles.card}>
                    <h2>สร้างข้อค้นพบ</h2>
                    <p>เลือกคำตอบต้นทาง แล้วอธิบายปัญหาและสิ่งที่ควรปรับปรุง</p>
                    <form
                      onSubmit={(e) => {
                        const d = formValues(e);
                        const evidence = d.getAll("evidence").map((value) => {
                          const [sessionId, taskId] = String(value).split(":");
                          return { sessionId, taskId };
                        });
                        if (
                          commit((s) =>
                            addFinding(s, {
                              id: uid(),
                              versionId: version.id,
                              problem: text(d, "problem"),
                              impact: text(d, "impact"),
                              recommendation: text(d, "recommendation"),
                              evidence,
                            }),
                          )
                        )
                          e.currentTarget.reset();
                      }}
                    >
                      <label>
                        ปัญหาที่พบ
                        <textarea name="problem" required maxLength={4000} />
                      </label>
                      <label>
                        ผลกระทบต่อการใช้งาน
                        <textarea name="impact" required maxLength={4000} />
                      </label>
                      <label>
                        ข้อเสนอแนะ
                        <textarea
                          name="recommendation"
                          required
                          maxLength={4000}
                        />
                      </label>
                      <fieldset>
                        <legend>คำตอบที่ใช้เป็นหลักฐาน</legend>
                        {store.sessions
                          .filter(
                            (s) => s.versionId === version.id && s.submittedAt,
                          )
                          .map((s, i) =>
                            s.answers.map((a) => (
                              <label
                                className={styles.check}
                                key={`${s.id}-${a.taskId}`}
                              >
                                <input
                                  type="checkbox"
                                  name="evidence"
                                  value={`${s.id}:${a.taskId}`}
                                />
                                <span>
                                  รอบ {i + 1} / โจทย์{" "}
                                  {version.tasks.findIndex(
                                    (t) => t.id === a.taskId,
                                  ) + 1}
                                  : {outcomes[a.outcome]} ·{" "}
                                  {a.feedback || "ไม่มีความคิดเห็นเพิ่มเติม"}
                                </span>
                              </label>
                            )),
                          )}
                        {!store.sessions.some(
                          (s) => s.versionId === version.id && s.submittedAt,
                        ) && (
                          <p>ยังไม่มีหลักฐาน ส่งคำตอบให้ครบก่อนสร้างข้อค้นพบ</p>
                        )}
                      </fieldset>
                      <button className={styles.primary}>บันทึกข้อค้นพบ</button>
                    </form>
                  </section>
                  {findings.map((f) => (
                    <section className={styles.card} key={f.id}>
                      <h3>{f.problem}</h3>
                      <p>ผลกระทบ: {f.impact}</p>
                      <p>ข้อเสนอแนะ: {f.recommendation}</p>
                      {f.evidence.map((e) => (
                        <a
                          key={`${e.sessionId}-${e.taskId}`}
                          href={linkToEvidence(e.sessionId, e.taskId)}
                        >
                          ดูคำตอบต้นทาง · โจทย์{" "}
                          {version.tasks.findIndex((t) => t.id === e.taskId) +
                            1}
                        </a>
                      ))}
                    </section>
                  ))}
                  <button onClick={() => move({ step: "results" })}>
                    กลับไปผลการทดสอบ
                  </button>
                  <button
                    className={styles.primary}
                    onClick={() => move({ step: "report" })}
                  >
                    ไปที่รายงาน
                  </button>
                </>
              )}
              {loc.step === "report" && version && (
                <>
                  <section className={styles.card}>
                    <h2>รายงานเวอร์ชัน {version.number}</h2>
                    <p>
                      รายงานบันทึกชุดข้อค้นพบ ณ เวลาสร้าง
                      หากเพิ่มข้อค้นพบให้สร้างรายงานใหม่
                    </p>
                    <button
                      className={styles.primary}
                      onClick={() => commit((s) => makeReport(s, version.id))}
                    >
                      สร้างรายงานจากข้อค้นพบ
                    </button>
                    {!findings.length && (
                      <p>ยังสร้างรายงานไม่ได้ สร้างข้อค้นพบพร้อมหลักฐานก่อน</p>
                    )}
                  </section>
                  {report && (
                    <section className={styles.card}>
                      <h2>
                        {project?.name} / {version.title}
                      </h2>
                      <p>
                        เวอร์ชัน {version.number} · รายงาน {report.id}
                      </p>
                      <p>
                        พื้นที่ทดลองในเบราว์เซอร์ —
                        ข้อมูลคำตอบที่ผู้ทดลองรายงานเอง
                        ไม่ใช่ผลการติดตามพฤติกรรม
                      </p>
                      <p>เว็บไซต์: {version.url}</p>
                      {report.findings.map((f) => (
                        <article key={f.id} className={styles.evidence}>
                          <h3>{f.problem}</h3>
                          <p>ผลกระทบ: {f.impact}</p>
                          <p>ข้อเสนอแนะ: {f.recommendation}</p>
                          {f.evidence.map((e) => (
                            <a
                              href={linkToEvidence(e.sessionId, e.taskId)}
                              key={`${e.sessionId}-${e.taskId}`}
                            >
                              คำตอบต้นทาง · รอบ {e.sessionId} · โจทย์{" "}
                              {version.tasks.findIndex(
                                (t) => t.id === e.taskId,
                              ) + 1}
                            </a>
                          ))}
                        </article>
                      ))}
                      <button onClick={() => window.print()}>
                        พิมพ์ / บันทึกเป็น PDF
                      </button>
                    </section>
                  )}
                  <button onClick={() => move({ step: "findings" })}>
                    กลับไปข้อค้นพบ
                  </button>
                  <button
                    className={styles.primary}
                    onClick={() => move({ step: "retest" })}
                  >
                    ไปทดลองรอบใหม่
                  </button>
                </>
              )}
              {loc.step === "retest" && version && (
                <section className={styles.card}>
                  <h2>ทดลองรอบใหม่จากเวอร์ชัน {version.number}</h2>
                  <p>
                    คัดลอกโจทย์เป็นฉบับร่างใหม่ คำตอบรอบเก่ายังคงอยู่
                    ไม่มีหลักฐานยืนยันว่าเว็บไซต์บ้านเราได้รับการแก้ไข
                    จึงไม่สรุปว่ารอบใหม่เป็นผลของการแก้ไข
                  </p>
                  <button
                    className={styles.primary}
                    onClick={() => {
                      if (test?.draft) move({ step: "test" });
                      else if (commit((s) => newRound(s, version.id)))
                        move({ step: "test" });
                    }}
                  >
                    {test?.draft
                      ? "เปิดฉบับร่างรอบใหม่"
                      : "สร้างฉบับร่างรอบใหม่"}
                  </button>
                  {version.parentId &&
                    (() => {
                      const before = versions.find(
                        (v) => v.id === version.parentId,
                      );
                      if (!before)
                        return <p>ไม่พบเวอร์ชันต้นฉบับ จึงเปรียบเทียบไม่ได้</p>;
                      const compatible = comparableTasks(before, version);
                      return (
                        <>
                          <h3>
                            ต้นฉบับ v{before.number} → รอบใหม่ v{version.number}
                          </h3>
                          <p>
                            เปรียบเทียบคำตอบได้ {compatible.length} จาก{" "}
                            {before.tasks.length} โจทย์
                            โดยโจทย์และมาตราส่วนต้องเหมือนเดิม
                          </p>
                          {compatible.map((t) => {
                            const a = taskSummary(store, before.id, t.id);
                            const b = taskSummary(store, version.id, t.id);
                            return (
                              <article key={t.id}>
                                <h4>{t.instruction}</h4>
                                {a.count && b.count ? (
                                  <p>
                                    ต้นฉบับ {a.count} คำตอบ (ทำได้ {a.done},
                                    ทำไม่ได้ {a.notDone}, ข้าม {a.skipped}) →
                                    รอบใหม่ {b.count} คำตอบ (ทำได้ {b.done},
                                    ทำไม่ได้ {b.notDone}, ข้าม {b.skipped})
                                  </p>
                                ) : (
                                  <p>
                                    ยังเปรียบเทียบไม่ได้
                                    ต้องมีคำตอบที่ส่งครบทั้งสองเวอร์ชัน
                                  </p>
                                )}
                              </article>
                            );
                          })}
                          <button
                            onClick={() =>
                              move({ step: "results", v: before.id })
                            }
                          >
                            ดูหลักฐานต้นฉบับ
                          </button>
                          <button onClick={() => move({ step: "results" })}>
                            ดูหลักฐานรอบใหม่
                          </button>
                        </>
                      );
                    })()}
                </section>
              )}
              {loc.step !== "projects" &&
                (!test || (loc.step !== "test" && !version)) && (
                  <section className={styles.card}>
                    <h2>เลือกแบบทดสอบก่อนทำต่อ</h2>
                    <p>
                      กลับไปโปรเจกต์ เลือกแบบทดสอบ
                      แล้วเลือกเวอร์ชันที่เผยแพร่แล้ว
                      ลิงก์จากเครื่องอื่นไม่มีข้อมูลในเบราว์เซอร์นี้
                    </p>
                    <button onClick={() => move({ step: "projects", s: "" })}>
                      ไปที่โปรเจกต์
                    </button>
                  </section>
                )}
              {runner && version && !session && (
                <section className={styles.card}>
                  <h1>ยังไม่มีรอบทดลองในเครื่องนี้</h1>
                  <button onClick={begin}>เริ่มรอบทดลอง</button>
                  <button onClick={() => move({ step: "test", s: "" })}>
                    กลับไปแบบทดสอบ
                  </button>
                </section>
              )}
              {!steps.some(([step]) => step === loc.step) && !runner && (
                <button onClick={() => move({ step: "projects" })}>
                  กลับไปโปรเจกต์
                </button>
              )}
            </fieldset>
          </>
        )}
      </main>
    </div>
  );
}

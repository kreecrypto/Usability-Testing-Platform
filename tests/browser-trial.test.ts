import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  blankStore,
  publish,
  startSession,
  answerSession,
  submitSession,
  newRound,
  taskSummary,
  comparableTasks,
  addFinding,
  makeReport,
  saveStore,
  decodeStore,
  STORAGE_KEY,
  safeTarget,
} from "../src/lib/trial/model.ts";
const setup = () =>
  publish(
    {
      ...blankStore(),
      projects: [{ id: "p", name: "Banrao", goal: "trial" }],
      tests: [
        {
          id: "t",
          projectId: "p",
          title: "Test",
          draft: {
            testId: "t",
            title: "Test",
            url: "https://banrao-uat.pages.dev",
            tasks: [
              { id: "task1", instruction: "Find house" },
              { id: "task2", instruction: "Read status" },
            ],
          },
        },
      ],
    },
    "t",
  );
function completed() {
  const s = setup();
  const start = startSession(s, s.versions[0].id);
  let store = answerSession(start.store, start.session.id, {
    taskId: "task1",
    outcome: "done",
    ease: 5,
    feedback: "found",
  });
  store = answerSession(store, start.session.id, {
    taskId: "task2",
    outcome: "skipped",
    ease: null,
    feedback: "",
  });
  return {
    store: submitSession(store, start.session.id),
    sessionId: start.session.id,
  };
}
test("published snapshots cannot be overwritten; round retains parent and stable task identity", () => {
  const s = setup(),
    before = JSON.stringify(s.versions[0]);
  let next = newRound(s, s.versions[0].id);
  next.tests[0].draft!.tasks[0].instruction = "Different";
  assert.equal(JSON.stringify(s.versions[0]), before);
  next = publish(next, "t");
  assert.equal(next.versions[1].parentId, next.versions[0].id);
  assert.equal(next.versions[1].number, 2);
  assert.deepEqual(
    comparableTasks(next.versions[0], next.versions[1]).map((t) => t.id),
    ["task2"],
  );
  assert.throws(() => publish(next, "t"));
});
test("sessions resume, answers replace per task and submit retries never increase sample", () => {
  const s = setup();
  const a = startSession(s, s.versions[0].id);
  const resumed = startSession(a.store, s.versions[0].id);
  assert.equal(resumed.session.id, a.session.id);
  assert.throws(() => submitSession(a.store, a.session.id), /ทุกข้อ/);
  let store = answerSession(a.store, a.session.id, {
    taskId: "task1",
    outcome: "not_done",
    ease: null,
    feedback: "",
  });
  store = answerSession(store, a.session.id, {
    taskId: "task1",
    outcome: "done",
    ease: 7,
    feedback: "retry",
  });
  assert.equal(store.sessions[0].answers.length, 1);
  assert.equal(taskSummary(store, s.versions[0].id, "task1").count, 0);
  store = answerSession(store, a.session.id, {
    taskId: "task2",
    outcome: "skipped",
    ease: null,
    feedback: "",
  });
  store = submitSession(store, a.session.id);
  assert.equal(submitSession(store, a.session.id), store);
  assert.equal(taskSummary(store, s.versions[0].id, "task1").count, 1);
  assert.equal(taskSummary(store, s.versions[0].id, "task2").scoreCount, 0);
  assert.throws(() =>
    answerSession(store, a.session.id, {
      taskId: "task1",
      outcome: "done",
      ease: 1,
      feedback: "",
    }),
  );
});
test("answers validate task identity and ease; targets reject executable/credential URLs", () => {
  const s = setup(),
    a = startSession(s, s.versions[0].id);
  for (const answer of [
    { taskId: "missing", outcome: "done", ease: 1, feedback: "" },
    { taskId: "task1", outcome: "done", ease: 8, feedback: "" },
    { taskId: "task1", outcome: "wrong", ease: null, feedback: "" },
  ])
    assert.throws(() => answerSession(a.store, a.session.id, answer as never));
  for (const url of ["javascript:alert(1)", "https://user:pass@example.com"])
    assert.throws(() => safeTarget(url));
});
test("findings only use submitted evidence of same version; report is an immutable snapshot", () => {
  let { store, sessionId } = completed();
  const vid = store.versions[0].id;
  const f = {
    id: "f",
    versionId: vid,
    problem: "unclear",
    impact: "delay",
    recommendation: "clarify",
    evidence: [{ sessionId, taskId: "task1" }],
  };
  assert.throws(() => addFinding(store, { ...f, versionId: "other" }));
  assert.throws(() => addFinding(store, { ...f, evidence: [] }));
  store = addFinding(store, f);
  store = makeReport(store, vid);
  store.findings[0].problem = "edited";
  assert.equal(store.reports[0].findings[0].problem, "unclear");
  assert.equal(decodeStore(JSON.stringify(store)).reports.length, 1);
});
test("corrupt/schema-incompatible data preserved; denied writes and stale tabs never succeed", () => {
  for (const raw of [
    "bad",
    JSON.stringify({ ...blankStore(), schema: 2 }),
    JSON.stringify({ ...setup(), sessions: [{ id: "bad" }] }),
  ])
    assert.throws(() => decodeStore(raw));
  let raw: string | null = null;
  const storage = {
    getItem: (key: string) => (key === STORAGE_KEY ? raw : null),
    setItem: (_k: string, v: string) => {
      raw = v;
    },
  };
  const saved = saveStore(storage, setup(), null);
  assert.equal(decodeStore(saved).revision, 1);
  assert.throws(() => saveStore(storage, setup(), null), /แท็บอื่น/);
  assert.equal(raw, saved);
  assert.throws(
    () =>
      saveStore(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("quota");
          },
        },
        setup(),
        null,
      ),
    /บันทึกไม่ได้/,
  );
});
test("trial isolated from researcher APIs and production data, demo remains read only", () => {
  const source = [
    "src/app/trial/page.tsx",
    "src/app/trial/trial-workspace.tsx",
    "src/lib/trial/model.ts",
  ]
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/|SUPABASE_|service.role/i);
  assert.match(source, /ยังไม่ได้เชื่อมตัวเก็บพฤติกรรม/);
  assert.match(source, /ไม่แชร์คำตอบข้ามเครื่อง/);
});

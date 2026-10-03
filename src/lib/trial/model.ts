export const STORAGE_KEY = "utp.browser-trial.v1";
export type Task = { id: string; instruction: string };
export type Version = {
  id: string;
  testId: string;
  number: number;
  title: string;
  url: string;
  tasks: Task[];
  publishedAt: string;
  parentId?: string;
};
export type Draft = Omit<Version, "publishedAt" | "id" | "number">;
export type TrialTest = {
  id: string;
  projectId: string;
  title: string;
  draft?: Draft;
};
export type Answer = {
  taskId: string;
  outcome: "done" | "not_done" | "skipped";
  ease: number | null;
  feedback: string;
};
export type Session = {
  id: string;
  versionId: string;
  startedAt: string;
  submittedAt?: string;
  answers: Answer[];
};
export type Evidence = { sessionId: string; taskId: string };
export type Finding = {
  id: string;
  versionId: string;
  problem: string;
  impact: string;
  recommendation: string;
  evidence: Evidence[];
};
export type Report = {
  id: string;
  versionId: string;
  createdAt: string;
  findings: Finding[];
};
export type Store = {
  schema: 1;
  revision: number;
  projects: { id: string; name: string; goal: string }[];
  tests: TrialTest[];
  versions: Version[];
  sessions: Session[];
  findings: Finding[];
  reports: Report[];
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const blankStore = (): Store => ({
  schema: 1,
  revision: 0,
  projects: [],
  tests: [],
  versions: [],
  sessions: [],
  findings: [],
  reports: [],
});
export const banraoTasks = (): Task[] => [
  {
    id: uid(),
    instruction:
      "ตรวจสอบว่าบ้านเลขที่ 18/9 ชำระค่าเช่ารอบปัจจุบันแล้วหรือยัง แล้วบอกสิ่งที่คุณพบ",
  },
  {
    id: uid(),
    instruction:
      "ค้นหาบ้านเลขที่ 12/4 แล้วบอกว่าคุณหาข้อมูลบ้านหลังนี้ได้หรือไม่",
  },
  {
    id: uid(),
    instruction:
      "จากหน้าแรก หางานซ่อมที่ต้องติดตามหนึ่งรายการ แล้วบอกว่าคุณพบงานอะไร",
  },
];
export function safeTarget(value: string): string {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "ใช้ลิงก์เว็บไซต์ http หรือ https ที่ไม่มีข้อมูลเข้าสู่ระบบ",
    );
  return url.href;
}
export function publish(store: Store, testId: string): Store {
  const test = store.tests.find((t) => t.id === testId);
  if (!test?.draft) throw new Error("ไม่มีฉบับร่างให้เผยแพร่");
  const draft = test.draft;
  if (
    !draft.title.trim() ||
    !draft.tasks.length ||
    draft.tasks.some((t) => !t.instruction.trim())
  )
    throw new Error("กรอกชื่อแบบทดสอบและโจทย์ทุกข้อก่อนเผยแพร่");
  const version: Version = {
    ...structuredClone(draft),
    url: safeTarget(draft.url),
    id: uid(),
    number: store.versions.filter((v) => v.testId === testId).length + 1,
    publishedAt: now(),
  };
  return {
    ...store,
    versions: [...store.versions, version],
    tests: store.tests.map((t) =>
      t.id === testId ? { ...t, title: draft.title, draft: undefined } : t,
    ),
  };
}
export function newRound(store: Store, versionId: string): Store {
  const v = store.versions.find((v) => v.id === versionId);
  if (!v) throw new Error("ไม่พบเวอร์ชันต้นฉบับ");
  if (store.tests.find((t) => t.id === v.testId)?.draft)
    throw new Error("มีฉบับร่างอยู่แล้ว ให้ตรวจฉบับร่างก่อน");
  return {
    ...store,
    tests: store.tests.map((t) =>
      t.id === v.testId
        ? {
            ...t,
            draft: {
              testId: v.testId,
              title: v.title,
              url: v.url,
              tasks: structuredClone(v.tasks),
              parentId: v.id,
            },
          }
        : t,
    ),
  };
}
export function startSession(
  store: Store,
  versionId: string,
): { store: Store; session: Session } {
  if (!store.versions.some((v) => v.id === versionId))
    throw new Error("เผยแพร่แบบทดสอบก่อนเริ่มทดลอง");
  const existing = store.sessions.find(
    (s) => s.versionId === versionId && !s.submittedAt,
  );
  if (existing) return { store, session: existing };
  const session: Session = {
    id: uid(),
    versionId,
    startedAt: now(),
    answers: [],
  };
  return {
    store: { ...store, sessions: [...store.sessions, session] },
    session,
  };
}
export function answerSession(
  store: Store,
  sessionId: string,
  answer: Answer,
): Store {
  const session = store.sessions.find((s) => s.id === sessionId);
  const version = store.versions.find((v) => v.id === session?.versionId);
  if (
    !session ||
    session.submittedAt ||
    !version?.tasks.some((t) => t.id === answer.taskId)
  )
    throw new Error("รอบนี้รับคำตอบไม่ได้");
  if (
    !["done", "not_done", "skipped"].includes(answer.outcome) ||
    (answer.ease !== null &&
      (!Number.isInteger(answer.ease) || answer.ease < 1 || answer.ease > 7))
  )
    throw new Error("ตรวจคำตอบและคะแนน 1–7 อีกครั้ง");
  return {
    ...store,
    sessions: store.sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            answers: [
              ...s.answers.filter((a) => a.taskId !== answer.taskId),
              structuredClone(answer),
            ],
          }
        : s,
    ),
  };
}
export function submitSession(store: Store, sessionId: string): Store {
  const s = store.sessions.find((s) => s.id === sessionId);
  if (!s) throw new Error("ไม่พบรอบทดลอง");
  if (s.submittedAt) return store;
  const v = store.versions.find((v) => v.id === s.versionId)!;
  if (v.tasks.some((t) => !s.answers.some((a) => a.taskId === t.id)))
    throw new Error("บันทึกคำตอบทุกข้อ หรือเลือกข้าม ก่อนส่งรอบทดลอง");
  return {
    ...store,
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, submittedAt: now() } : s,
    ),
  };
}
export function addFinding(store: Store, finding: Finding): Store {
  if (
    !finding.problem.trim() ||
    !finding.impact.trim() ||
    !finding.recommendation.trim() ||
    !finding.evidence.length
  )
    throw new Error("กรอกปัญหา ผลกระทบ ข้อเสนอแนะ และเลือกหลักฐาน");
  if (
    !finding.evidence.every((e) =>
      store.sessions.some(
        (s) =>
          s.id === e.sessionId &&
          s.versionId === finding.versionId &&
          s.submittedAt &&
          s.answers.some((a) => a.taskId === e.taskId),
      ),
    )
  )
    throw new Error("หลักฐานต้องมาจากคำตอบที่ส่งครบในเวอร์ชันนี้");
  return { ...store, findings: [...store.findings, structuredClone(finding)] };
}
export function makeReport(store: Store, versionId: string): Store {
  const findings = store.findings.filter((f) => f.versionId === versionId);
  if (!findings.length)
    throw new Error("สร้างข้อค้นพบจากหลักฐานก่อนสร้างรายงาน");
  return {
    ...store,
    reports: [
      ...store.reports,
      {
        id: uid(),
        versionId,
        createdAt: now(),
        findings: structuredClone(findings),
      },
    ],
  };
}
export function taskSummary(store: Store, versionId: string, taskId: string) {
  const answers = store.sessions
    .filter((s) => s.versionId === versionId && s.submittedAt)
    .flatMap((s) => s.answers.filter((a) => a.taskId === taskId));
  const scores = answers.flatMap((a) => (a.ease === null ? [] : [a.ease]));
  return {
    count: answers.length,
    done: answers.filter((a) => a.outcome === "done").length,
    notDone: answers.filter((a) => a.outcome === "not_done").length,
    skipped: answers.filter((a) => a.outcome === "skipped").length,
    scores: Array.from({ length: 7 }, (_, i) => ({
      score: i + 1,
      count: scores.filter((s) => s === i + 1).length,
    })),
    scoreCount: scores.length,
  };
}
export function comparableTasks(before: Version, after: Version) {
  return before.tasks.filter((t) =>
    after.tasks.some((a) => a.id === t.id && a.instruction === t.instruction),
  );
}
// Untrusted local data must not become a publishable URL or an evidence relation.
export function decodeStore(raw: string | null): Store {
  if (raw === null) return blankStore();
  try {
    const s: Store = JSON.parse(raw);
    if (s.schema !== 1 || !Number.isInteger(s.revision) || s.revision < 0)
      throw Error();
    for (const key of [
      "projects",
      "tests",
      "versions",
      "sessions",
      "findings",
      "reports",
    ] as const)
      if (!Array.isArray(s[key])) throw Error();
    const str = (v: unknown) => {
      if (typeof v !== "string") throw Error();
    };
    const tasks = (ts: Task[]) => {
      if (
        !Array.isArray(ts) ||
        !ts.length ||
        new Set(ts.map((t) => t.id)).size !== ts.length
      )
        throw Error();
      ts.forEach((t) => {
        str(t.id);
        str(t.instruction);
      });
    };
    s.projects.forEach((p) => {
      str(p.id);
      str(p.name);
      str(p.goal);
    });
    s.tests.forEach((t) => {
      str(t.id);
      str(t.title);
      if (!s.projects.some((p) => p.id === t.projectId)) throw Error();
      if (t.draft) {
        if (t.draft.testId !== t.id) throw Error();
        str(t.draft.title);
        str(t.draft.url);
        tasks(t.draft.tasks);
      }
    });
    s.versions.forEach((v) => {
      str(v.id);
      str(v.title);
      str(v.publishedAt);
      safeTarget(v.url);
      tasks(v.tasks);
      if (
        !s.tests.some((t) => t.id === v.testId) ||
        !Number.isInteger(v.number)
      )
        throw Error();
    });
    s.sessions.forEach((session) => {
      str(session.id);
      str(session.startedAt);
      const v = s.versions.find((v) => v.id === session.versionId);
      if (!v || !Array.isArray(session.answers)) throw Error();
      if (session.submittedAt) str(session.submittedAt);
      if (
        new Set(session.answers.map((a) => a.taskId)).size !==
        session.answers.length
      )
        throw Error();
      session.answers.forEach((a) => {
        if (
          !v.tasks.some((t) => t.id === a.taskId) ||
          !["done", "not_done", "skipped"].includes(a.outcome) ||
          (a.ease !== null &&
            (!Number.isInteger(a.ease) || a.ease < 1 || a.ease > 7))
        )
          throw Error();
        str(a.feedback);
      });
      if (session.submittedAt && session.answers.length !== v.tasks.length)
        throw Error();
    });
    const finding = (f: Finding) => {
      str(f.id);
      str(f.problem);
      str(f.impact);
      str(f.recommendation);
      if (
        !Array.isArray(f.evidence) ||
        !f.evidence.length ||
        !f.evidence.every((e) =>
          s.sessions.some(
            (session) =>
              session.id === e.sessionId &&
              session.versionId === f.versionId &&
              session.submittedAt &&
              session.answers.some((a) => a.taskId === e.taskId),
          ),
        )
      )
        throw Error();
    };
    s.findings.forEach(finding);
    s.reports.forEach((r) => {
      str(r.id);
      str(r.createdAt);
      if (
        !Array.isArray(r.findings) ||
        !r.findings.length ||
        r.findings.some((f) => f.versionId !== r.versionId)
      )
        throw Error();
      r.findings.forEach(finding);
    });
    for (const key of [
      "projects",
      "tests",
      "versions",
      "sessions",
      "findings",
      "reports",
    ] as const)
      if (new Set(s[key].map((x) => x.id)).size !== s[key].length)
        throw Error();
    return s;
  } catch {
    throw new Error(
      "ข้อมูลทดลองเดิมอ่านไม่ได้ หรือเป็นรุ่นที่ยังไม่รองรับ ข้อมูลเดิมยังอยู่ โปรดลองเปิดด้วยรุ่นที่บันทึกข้อมูลนี้",
    );
  }
}
export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export function saveStore(
  storage: Storage,
  next: Store,
  expectedRaw: string | null,
): string {
  if (storage.getItem(STORAGE_KEY) !== expectedRaw)
    throw new Error("ข้อมูลเปลี่ยนในแท็บอื่น โหลดข้อมูลล่าสุดก่อนทำต่อ");
  const raw = JSON.stringify({ ...next, revision: next.revision + 1 });
  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch {
    throw new Error(
      "บันทึกไม่ได้ พื้นที่จัดเก็บอาจเต็มหรือถูกปิด ตรวจการตั้งค่าแล้วลองบันทึกอีกครั้ง",
    );
  }
  return raw;
}

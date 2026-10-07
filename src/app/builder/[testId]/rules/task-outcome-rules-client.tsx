"use client";
import { Button } from '@/components/ui/button';

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Task = { id: string; title: string; ordinal: number };
type RuleType = "screen" | "url" | "route" | "element" | "completion_signal";
type StoredRule =
  | { version: 2; type: RuleType; values: string[] }
  | { type: "presented_node"; nodeIds: string[] };

type RuleState = {
  taskId: string;
  target: {
    provider: "figma_prototype" | "first_party_web" | "external_web";
    capabilities: Record<string, unknown>;
  };
  availableRuleTypes: RuleType[];
  expectedPath: string[];
  successRule: StoredRule | null;
  failureRule: StoredRule | null;
};

const labels: Record<RuleType, string> = {
  screen: "หน้าจอ (Screen ID)",
  url: "URL แบบตรงตัว",
  route: "Route / Path",
  element: "Element ID ที่อนุมัติ",
  completion_signal: "Completion signal",
};

function lines(value: string): string[] {
  return [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

function editorRule(rule: StoredRule | null, fallback: RuleType): { type: RuleType; values: string } {
  if (!rule) return { type: fallback, values: "" };
  if (rule.type === "presented_node") {
    return { type: "screen", values: rule.nodeIds.join("\n") };
  }
  return { type: rule.type, values: rule.values.join("\n") };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  }
  return body as T;
}

export default function TaskOutcomeRulesClient({ testId }: { testId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState("");
  const [ruleState, setRuleState] = useState<RuleState | null>(null);
  const [successType, setSuccessType] = useState<RuleType>("screen");
  const [failureType, setFailureType] = useState<RuleType>("screen");
  const [successValues, setSuccessValues] = useState("");
  const [failureValues, setFailureValues] = useState("");
  const [expectedPath, setExpectedPath] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api<{ tasks: Task[] }>(`/api/tests/${encodeURIComponent(testId)}/tasks`)
      .then(({ tasks: loaded }) => {
        setTasks(loaded);
        setTaskId(loaded[0]?.id ?? "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [testId]);

  useEffect(() => {
    if (!taskId) {
      setRuleState(null);
      return;
    }
    setLoading(true);
    void api<{ rules: RuleState }>(`/api/tasks/${encodeURIComponent(taskId)}/outcome-rules`)
      .then(({ rules }) => {
        setRuleState(rules);
        const fallback = rules.availableRuleTypes[0] ?? "screen";
        const success = editorRule(rules.successRule, fallback);
        const failure = editorRule(rules.failureRule, fallback);
        setSuccessType(rules.availableRuleTypes.includes(success.type) ? success.type : fallback);
        setFailureType(rules.availableRuleTypes.includes(failure.type) ? failure.type : fallback);
        setSuccessValues(success.values);
        setFailureValues(failure.values);
        setExpectedPath(rules.expectedPath.join("\n"));
        setMessage("");
      })
      .catch((error) => {
        setRuleState(null);
        setMessage(error instanceof Error ? error.message : "โหลดเกณฑ์ไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const successList = useMemo(() => lines(successValues), [successValues]);
  const failureList = useMemo(() => lines(failureValues), [failureValues]);
  const overlap = useMemo(() => {
    if (successType !== failureType) return [];
    const success = new Set(successList);
    return failureList.filter((value) => success.has(value));
  }, [successList, failureList, successType, failureType]);

  const validation = useMemo(() => {
    if (!ruleState) return "ยังไม่มีสิ่งที่จะทดสอบหรืองานที่แก้ไขได้";
    if (ruleState.availableRuleTypes.length === 0) return "สิ่งที่จะทดสอบยังไม่มีข้อมูลที่ใช้ตรวจผลอัตโนมัติได้";
    if (successList.length === 0) return "ต้องมีค่าที่ถือว่าสำเร็จอย่างน้อย 1 ค่า";
    if (failureList.length === 0) return "ต้องมีค่าที่ถือว่าไม่สำเร็จอย่างน้อย 1 ค่า";
    if (overlap.length > 0) return `ค่าซ้ำกันระหว่างสำเร็จ/ไม่สำเร็จ: ${overlap.join(", ")}`;
    return null;
  }, [ruleState, successList, failureList, overlap]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskId || validation) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await api<{ rules: RuleState }>(`/api/tasks/${encodeURIComponent(taskId)}/outcome-rules`, {
        method: "PATCH",
        body: JSON.stringify({
          successRule: { type: successType, values: successList },
          failureRule: { type: failureType, values: failureList },
          expectedPath: lines(expectedPath),
        }),
      });
      setRuleState(result.rules);
      setMessage("บันทึกเกณฑ์จบงานแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกเกณฑ์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const card = {
    background: "var(--ah-canvas)",
    border: "1px solid var(--ah-hairline)",
    borderRadius: 12,
    padding: 20,
  } as const;
  const input = {
    width: "100%",
    minHeight: 42,
    border: "1px solid var(--ah-hairline)",
    borderRadius: 8,
    padding: "8px 10px",
    background: "white",
  } as const;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="เมนูผู้วิจัย">
          <a className="navItem" href="/projects">โปรเจกต์</a>
          <a className="navItem active" href={`/builder/${testId}/rules`}>เกณฑ์จบงาน</a>
        </nav>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ตั้งค่าแบบทดสอบ · เกณฑ์จบงาน</p>
            <h1>กำหนดเกณฑ์สำเร็จและไม่สำเร็จ</h1>
          </div>
        </header>

        {message ? <p role="status" style={{ ...card, marginBottom: 16 }}>{message}</p> : null}
        {loading ? <p role="status">กำลังโหลดเกณฑ์…</p> : null}

        {!loading && tasks.length === 0 ? <section style={card}>ยังไม่มีงานให้กำหนดเกณฑ์ กลับไปสร้างงานก่อน</section> : null}

        {tasks.length > 0 ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section style={card}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>เลือกงาน</span>
                <select value={taskId} onChange={(event) => setTaskId(event.target.value)} style={input}>
                  {tasks.map((task) => <option key={task.id} value={task.id}>งาน {task.ordinal} — {task.title}</option>)}
                </select>
              </label>
              {ruleState ? (
                <p style={{ marginBottom: 0, color: "var(--ah-slate)" }}>
                  สิ่งที่จะทดสอบ: <strong>{ruleState.target.provider}</strong> · เกณฑ์ที่ใช้ได้: {ruleState.availableRuleTypes.map((type) => labels[type]).join(", ") || "ยังไม่มี"}
                </p>
              ) : null}
            </section>

            {ruleState ? (
              <form onSubmit={save} style={{ ...card, display: "grid", gap: 16 }}>
                <div>
                  <h2 style={{ margin: "0 0 8px" }}>เมื่องานสำเร็จ</h2>
                  <select value={successType} onChange={(event) => setSuccessType(event.target.value as RuleType)} style={input}>
                    {ruleState.availableRuleTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}
                  </select>
                  <textarea rows={4} value={successValues} onChange={(event) => setSuccessValues(event.target.value)} style={{ ...input, marginTop: 8 }} placeholder="หนึ่งค่าต่อบรรทัด" />
                </div>

                <div>
                  <h2 style={{ margin: "0 0 8px" }}>เมื่องานไม่สำเร็จ</h2>
                  <select value={failureType} onChange={(event) => setFailureType(event.target.value as RuleType)} style={input}>
                    {ruleState.availableRuleTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}
                  </select>
                  <textarea rows={4} value={failureValues} onChange={(event) => setFailureValues(event.target.value)} style={{ ...input, marginTop: 8 }} placeholder="หนึ่งค่าต่อบรรทัด" />
                </div>

                <div>
                  <h2 style={{ margin: "0 0 8px" }}>เส้นทางที่คาดไว้ (ไม่บังคับ)</h2>
                  <textarea rows={4} value={expectedPath} onChange={(event) => setExpectedPath(event.target.value)} style={input} placeholder="Screen ID ตามลำดับ หนึ่งค่าต่อบรรทัด" />
                  <small>ใช้แยกว่าผู้เข้าร่วมไปถึงเป้าหมายตรงเส้นทางหรืออ้อมทาง ไม่ใช้ตัดสินว่างานสำเร็จแทนเกณฑ์ด้านบน</small>
                </div>

                {validation ? <p role="alert" style={{ margin: 0 }}>{validation}</p> : <p role="status" style={{ margin: 0 }}>เกณฑ์พร้อมบันทึก ระบบจะตรวจอีกครั้งก่อนเผยแพร่</p>}
                <Button variant="legacy" className="primaryButton" type="submit" disabled={saving || Boolean(validation)}>
                  {saving ? "กำลังบันทึก…" : "บันทึกเกณฑ์จบงาน"}
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

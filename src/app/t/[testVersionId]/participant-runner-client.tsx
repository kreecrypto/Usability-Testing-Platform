"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFigmaInteractionEventBridge } from "../../../lib/figma/event-bridge.ts";
import {
  createBrowserLocalStorageOutboxStorage,
  createEventOutbox,
  createHttpEventBatchSender,
  type IngestionCredential,
} from "../../../lib/tracking/event-outbox.ts";
import { createRunnerLifecycle } from "../../../lib/tracking/lifecycle.ts";
import type { RawTrackingEvent } from "../../../lib/tracking/events.ts";
import styles from "./participant-runner.module.css";

const CONSENT_VERSION = "utp-privacy-v1";

type RunnerTask = {
  id: string;
  ordinal: number;
  title: string;
  scenario: string | null;
  instruction: string | null;
  timeoutSeconds: number | null;
  postTaskQuestions: Record<string, unknown>;
};

type TestSnapshot = {
  testId: string;
  testVersionId: string;
  versionNo: number;
  title: string;
  description: string | null;
  prototype: {
    sourceUrl: string;
    embedUrl: string;
    liveEmbedUrl: string | null;
    startNodeId: string;
  };
  tasks: RunnerTask[];
};

type RunnerContext = {
  sessionId: string;
  participantId: string;
  testId: string;
  testVersionId: string;
};

type TaskOutcome =
  | "success_direct"
  | "success_indirect"
  | "failed"
  | "give_up"
  | "timeout"
  | "abandoned"
  | "technical_blocked";

type TaskState = {
  taskId: string;
  outcome: TaskOutcome | null;
  startedAt: string;
  endedAt: string | null;
  feedbackSubmittedAt?: string | null;
};

type SessionState = {
  sessionId: string;
  status: "active" | "completed" | "abandoned" | "technical_blocked";
  completedAt: string | null;
  lastSequence: number;
  taskStates: TaskState[];
};

type SessionResponse = {
  participantId: string;
  sessionId: string;
  testId: string;
  testVersionId: string;
  startedAt: string;
  ingestionToken: string;
  ingestionTokenExpiresAt: string;
};

type Stage =
  | "access-loading"
  | "invalid"
  | "consent"
  | "declined"
  | "task-intro"
  | "runner"
  | "give-up-confirm"
  | "feedback"
  | "transition"
  | "complete"
  | "technical"
  | "timeout"
  | "recovery";

type Runtime = {
  context: RunnerContext;
  outbox: ReturnType<typeof createEventOutbox>;
  lifecycle: ReturnType<typeof createRunnerLifecycle>;
};

type QuestionConfig = { enabled: boolean; required: boolean };

function questionConfig(task: RunnerTask, key: "seq" | "open_feedback"): QuestionConfig {
  const raw = task.postTaskQuestions?.[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { enabled: false, required: false };
  return {
    enabled: Reflect.get(raw, "enabled") === true,
    required: Reflect.get(raw, "required") === true,
  };
}

function hasFeedback(task: RunnerTask): boolean {
  return questionConfig(task, "seq").enabled || questionConfig(task, "open_feedback").enabled;
}

function browserSupported(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (typeof globalThis.crypto?.randomUUID !== "function") return false;
    const key = "utp:runner:capability-check";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return typeof window.postMessage === "function";
  } catch {
    return false;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof body?.error === "string" ? body.error : "request_failed";
    throw new Error(error);
  }
  return body as T;
}

function maxPendingSequence(events: readonly RawTrackingEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.sequence), 0);
}

export default function ParticipantRunnerClient({ testVersionId }: { testVersionId: string }) {
  const [stage, setStage] = useState<Stage>("access-loading");
  const [snapshot, setSnapshot] = useState<TestSnapshot | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [technicalReason, setTechnicalReason] = useState("This device or provider state cannot continue safely.");
  const [offline, setOffline] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [seq, setSeq] = useState<number | null>(null);
  const [openFeedback, setOpenFeedback] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const initialCredentialRef = useRef<IngestionCredential | null>(null);

  const currentTask = snapshot?.tasks[taskIndex] ?? null;
  const totalTasks = snapshot?.tasks.length ?? 0;
  const progress = totalTasks > 0 ? Math.min(100, Math.round(((taskIndex + 1) / totalTasks) * 100)) : 0;

  const fetchState = useCallback(async (): Promise<{ context: RunnerContext; state: SessionState } | null> => {
    const response = await fetch("/api/public/sessions/state", { cache: "no-store" });
    if (response.status === 401) return null;
    return readJson<{ context: RunnerContext; state: SessionState }>(response);
  }, []);

  const refreshCredential = useCallback(async (): Promise<IngestionCredential> => {
    const initial = initialCredentialRef.current;
    if (initial) {
      initialCredentialRef.current = null;
      return initial;
    }
    const response = await fetch("/api/public/sessions/token", { method: "POST", cache: "no-store" });
    const body = await readJson<{ ingestionToken: string; ingestionTokenExpiresAt: string }>(response);
    return { token: body.ingestionToken, expiresAt: body.ingestionTokenExpiresAt };
  }, []);

  const configureRuntime = useCallback(async (
    context: RunnerContext,
    state: SessionState | null,
    credential?: IngestionCredential,
  ): Promise<Runtime> => {
    if (credential) initialCredentialRef.current = credential;
    const storage = createBrowserLocalStorageOutboxStorage(context.sessionId);
    const pending = await storage.load() as readonly RawTrackingEvent[];
    const sequence = Math.max(state?.lastSequence ?? 0, maxPendingSequence(pending));
    const pendingStarted = pending.some((event) => event.eventType === "session_started");
    const latestTaskState = state?.taskStates.at(-1) ?? null;

    const outbox = createEventOutbox({
      storage,
      refreshCredential,
      sendBatch: createHttpEventBatchSender({ endpoint: "/v1/events" }),
    });
    const lifecycle = createRunnerLifecycle({
      session: context,
      emit: async (event) => {
        await outbox.enqueue(event);
      },
      initialSequence: sequence,
      initialSessionStarted: Boolean(state && state.lastSequence > 0) || pendingStarted,
      initialSessionTerminal: Boolean(state && state.status !== "active"),
      initialActiveTaskId: latestTaskState?.taskId ?? null,
      initialActiveTaskTerminal: Boolean(latestTaskState?.outcome),
    });
    const runtime = { context, outbox, lifecycle };
    runtimeRef.current = runtime;

    if (!lifecycle.getState().sessionStarted && !lifecycle.getState().sessionTerminal) {
      await lifecycle.startSession();
    }
    return runtime;
  }, [refreshCredential]);

  const deliver = useCallback(async (): Promise<void> => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      await runtime.outbox.flush();
      setOffline(false);
    } catch {
      setOffline(true);
      throw new Error("offline_or_delivery_failed");
    }
  }, []);

  const finishSession = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const terminal = await runtime.lifecycle.completeSession();
    if (terminal) {
      try {
        await deliver();
        setStage("complete");
      } catch {
        setStage("recovery");
      }
    } else {
      const latest = await fetchState().catch(() => null);
      if (latest?.state.status === "completed") setStage("complete");
    }
  }, [deliver, fetchState]);

  const moveAfterTerminal = useCallback(async (index: number, state?: SessionState | null) => {
    if (!snapshot) return;
    const task = snapshot.tasks[index];
    const taskState = state?.taskStates.find((item) => item.taskId === task.id);
    if (hasFeedback(task) && !taskState?.feedbackSubmittedAt) {
      setSeq(null);
      setOpenFeedback("");
      setFeedbackError("");
      setStage("feedback");
      return;
    }
    if (index + 1 < snapshot.tasks.length) {
      setStage("transition");
      return;
    }
    await finishSession();
  }, [finishSession, snapshot]);

  const syncTerminalState = useCallback(async () => {
    if (!currentTask) return;
    const latest = await fetchState();
    if (!latest) return;
    setSessionState(latest.state);
    const taskState = latest.state.taskStates.find((item) => item.taskId === currentTask.id);
    if (taskState?.outcome) {
      const runtime = runtimeRef.current;
      if (runtime && !runtime.lifecycle.getState().activeTaskTerminal) {
        runtime.lifecycle.markTaskTerminal(currentTask.id);
      }
      await moveAfterTerminal(taskIndex, latest.state);
    }
  }, [currentTask, fetchState, moveAfterTerminal, taskIndex]);

  const inferStageFromState = useCallback(async (state: SessionState) => {
    if (!snapshot) return;
    setSessionState(state);
    if (state.status === "completed") {
      setStage("complete");
      return;
    }
    if (state.status === "technical_blocked") {
      setTechnicalReason("This session ended because the prototype or runtime could not continue safely.");
      setStage("technical");
      return;
    }
    if (state.status === "abandoned") {
      setStage("invalid");
      return;
    }

    const active = state.taskStates.find((task) => task.outcome === null);
    if (active) {
      const index = snapshot.tasks.findIndex((task) => task.id === active.taskId);
      if (index >= 0) {
        setTaskIndex(index);
        setStage("runner");
        return;
      }
    }

    let terminalIndex = -1;
    for (let index = 0; index < snapshot.tasks.length; index += 1) {
      const taskState = state.taskStates.find((item) => item.taskId === snapshot.tasks[index].id);
      if (taskState?.outcome) terminalIndex = index;
      else break;
    }
    if (terminalIndex >= 0) {
      setTaskIndex(terminalIndex);
      await moveAfterTerminal(terminalIndex, state);
      return;
    }
    setTaskIndex(0);
    setStage("task-intro");
  }, [moveAfterTerminal, snapshot]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!browserSupported()) {
        if (!cancelled) {
          setTechnicalReason("This browser does not provide the storage or cryptographic APIs required for a reliable anonymous session.");
          setStage("technical");
        }
        return;
      }
      try {
        const response = await fetch(`/api/public/tests/${encodeURIComponent(testVersionId)}`, { cache: "no-store" });
        const body = await readJson<{ test: TestSnapshot }>(response);
        if (cancelled) return;
        setSnapshot(body.test);
        const existing = await fetchState();
        if (cancelled) return;
        if (!existing) {
          setStage("consent");
          return;
        }
        setStage("recovery");
        await configureRuntime(existing.context, existing.state);
        try { await deliver(); } catch { return; }
        const refreshed = await fetchState();
        if (refreshed && !cancelled) await inferStageFromState(refreshed.state);
      } catch {
        if (!cancelled) setStage("invalid");
      }
    })();
    return () => { cancelled = true; };
  }, [configureRuntime, deliver, fetchState, inferStageFromState, testVersionId]);

  useEffect(() => {
    const onOnline = () => {
      if (!runtimeRef.current) return;
      void deliver().then(syncTerminalState).catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [deliver, syncTerminalState]);

  useEffect(() => {
    if (stage !== "runner" || !currentTask || !snapshot || !runtimeRef.current) return;
    const iframe = iframeRef.current;
    const source = iframe?.contentWindow;
    if (!iframe || !source) return;

    const runtime = runtimeRef.current;
    const bridge = createFigmaInteractionEventBridge({
      expectedSource: source,
      session: {
        ...runtime.context,
        taskId: currentTask.id,
      },
      initialScreenId: snapshot.prototype.startNodeId,
      initialSequence: runtime.lifecycle.getState().sequence,
      emitTrackingEvent: async (event) => {
        await runtime.lifecycle.acceptExternalRaw(event);
        void deliver().then(syncTerminalState).catch(() => undefined);
      },
      onOperationalSignal: async (signal) => {
        if (signal === "initial_load") {
          setProviderReady(true);
          return;
        }
        if (signal === "login_screen_shown" || signal === "password_screen_shown") {
          const reason = signal === "login_screen_shown" ? "figma_login_required" : "figma_password_required";
          setTechnicalReason(
            signal === "login_screen_shown"
              ? "Figma requires a login for this prototype. This is a technical access block, not a usability failure."
              : "This Figma prototype is password protected. This is a technical access block, not a usability failure.",
          );
          await runtime.lifecycle.technicalBlock(reason);
          void deliver().catch(() => undefined);
          setStage("technical");
        }
      },
    });

    const handler = (message: MessageEvent) => {
      void bridge.handleMessage({ origin: message.origin, source: message.source, data: message.data });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [currentTask, deliver, snapshot, stage, syncTerminalState]);

  useEffect(() => {
    if (stage !== "runner" || !currentTask?.timeoutSeconds || currentTask.timeoutSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.lifecycle.getState().activeTaskTerminal) return;
      void (async () => {
        await runtime.lifecycle.timeout();
        setStage("timeout");
        try {
          await deliver();
          const latest = await fetchState();
          if (latest) setSessionState(latest.state);
        } catch {
          setStage("recovery");
        }
      })();
    }, currentTask.timeoutSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [currentTask, deliver, fetchState, stage]);

  async function acceptConsent() {
    if (!snapshot || working) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/public/tests/${encodeURIComponent(snapshot.testVersionId)}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          consentVersion: CONSENT_VERSION,
          locale: navigator.language || null,
        }),
      });
      const body = await readJson<{ session: SessionResponse }>(response);
      const session = body.session;
      const context: RunnerContext = {
        sessionId: session.sessionId,
        participantId: session.participantId,
        testId: session.testId,
        testVersionId: session.testVersionId,
      };
      await configureRuntime(context, null, {
        token: session.ingestionToken,
        expiresAt: session.ingestionTokenExpiresAt,
      });
      try { await deliver(); } catch { setStage("recovery"); return; }
      setTaskIndex(0);
      setStage("task-intro");
    } catch {
      setTechnicalReason("A secure anonymous session could not be created. No task interaction was started.");
      setStage("technical");
    } finally {
      setWorking(false);
    }
  }

  async function startTask() {
    if (!currentTask || !runtimeRef.current || working) return;
    setWorking(true);
    setProviderReady(false);
    try {
      await runtimeRef.current.lifecycle.startTask({ id: currentTask.id });
      await deliver();
      if (!snapshot?.prototype.liveEmbedUrl) {
        setTechnicalReason("Live Figma Embed API tracking is not configured for this origin. The study is technically blocked rather than recorded with incomplete evidence.");
        await runtimeRef.current.lifecycle.technicalBlock("embed_api_unconfigured");
        try { await deliver(); } catch { /* durable outbox keeps evidence */ }
        setStage("technical");
        return;
      }
      setStage("runner");
    } catch {
      setStage("recovery");
    } finally {
      setWorking(false);
    }
  }

  async function confirmGiveUp() {
    const runtime = runtimeRef.current;
    if (!runtime || !currentTask || working) return;
    setWorking(true);
    try {
      await runtime.lifecycle.giveUp();
      await deliver();
      const latest = await fetchState();
      if (latest) {
        setSessionState(latest.state);
        await moveAfterTerminal(taskIndex, latest.state);
      } else {
        await moveAfterTerminal(taskIndex, sessionState);
      }
    } catch {
      setStage("recovery");
    } finally {
      setWorking(false);
    }
  }

  async function submitFeedback() {
    if (!currentTask || working) return;
    const seqConfig = questionConfig(currentTask, "seq");
    const openConfig = questionConfig(currentTask, "open_feedback");
    if (seqConfig.required && seq === null) {
      setFeedbackError("Please choose an ease rating before continuing.");
      return;
    }
    if (openConfig.required && !openFeedback.trim()) {
      setFeedbackError("Please add feedback before continuing.");
      return;
    }
    setWorking(true);
    setFeedbackError("");
    try {
      await readJson(await fetch("/api/public/sessions/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: currentTask.id, seq, openFeedback }),
      }));
      const latest = await fetchState();
      if (latest) setSessionState(latest.state);
      if (taskIndex + 1 < totalTasks) setStage("transition");
      else await finishSession();
    } catch {
      setFeedbackError("Your feedback could not be saved yet. Please retry.");
    } finally {
      setWorking(false);
    }
  }

  async function continueFromTimeout() {
    try {
      await deliver();
      const latest = await fetchState();
      if (latest) {
        setSessionState(latest.state);
        await moveAfterTerminal(taskIndex, latest.state);
      } else {
        await moveAfterTerminal(taskIndex, sessionState);
      }
    } catch {
      setStage("recovery");
    }
  }

  async function retryRecovery() {
    setWorking(true);
    try {
      await deliver();
      const latest = await fetchState();
      if (latest) await inferStageFromState(latest.state);
      else setStage("invalid");
    } catch {
      setOffline(true);
    } finally {
      setWorking(false);
    }
  }

  const seqConfig = useMemo(() => currentTask ? questionConfig(currentTask, "seq") : { enabled: false, required: false }, [currentTask]);
  const openConfig = useMemo(() => currentTask ? questionConfig(currentTask, "open_feedback") : { enabled: false, required: false }, [currentTask]);

  if (stage === "access-loading") {
    return <ParticipantShell progress={0} meta="P01 · Access check"><StatusCard title="Checking study access" body="Confirming the published test and this browser’s anonymous-session capabilities." loading /></ParticipantShell>;
  }

  if (stage === "invalid") {
    return <ParticipantShell progress={0} meta="P09 · Unavailable"><StatusCard title="This study link is unavailable" body="The published version may be invalid, closed, expired, or no longer available." /></ParticipantShell>;
  }

  if (stage === "declined") {
    return <ParticipantShell progress={0} meta="P02 · Consent declined"><StatusCard title="You chose not to participate" body="No eligible usability session was created and behavioral tracking did not start." /></ParticipantShell>;
  }

  if (stage === "technical") {
    return <ParticipantShell progress={progress} meta="P10 · Technical blocked"><StatusCard title="We can’t continue this study" body={technicalReason} technical /></ParticipantShell>;
  }

  if (stage === "recovery") {
    return <ParticipantShell progress={progress} meta="P12 · Recovery"><StatusCard title={offline ? "You’re offline" : "Recovering your session"} body="Your original anonymous session and published test version are preserved. Pending events keep their original IDs for safe retry." loading={!offline}><button className={styles.primaryButton} type="button" onClick={() => void retryRecovery()} disabled={working}>{working ? "Retrying…" : "Retry connection"}</button></StatusCard></ParticipantShell>;
  }

  if (!snapshot) return null;

  if (stage === "consent") {
    return (
      <ParticipantShell progress={0} meta="P02 · Consent">
        <section className={styles.card} aria-labelledby="consent-title">
          <span className={styles.eyebrow}>Before you begin</span>
          <h1 id="consent-title">Take part in “{snapshot.title}”</h1>
          <p>This study records task interactions, navigation path, pointer evidence, time, task outcome, SEQ responses, and optional comments after you agree.</p>
          <p>No camera, microphone, screen recording, name, email, or phone number is required in V1.</p>
          <div className={styles.notice}>Behavioral tracking starts only after you choose <strong>Agree and start</strong>.</div>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setStage("declined")} disabled={working}>Decline</button>
            <button className={styles.primaryButton} type="button" onClick={() => void acceptConsent()} disabled={working}>{working ? "Creating secure session…" : "Agree and start"}</button>
          </div>
        </section>
      </ParticipantShell>
    );
  }

  if (stage === "task-intro" && currentTask) {
    return (
      <ParticipantShell progress={progress} meta={`P03 · Task ${taskIndex + 1} of ${totalTasks}`}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Task {taskIndex + 1} of {totalTasks}</span>
          <h1>{currentTask.title}</h1>
          {currentTask.scenario ? <p className={styles.scenario}>{currentTask.scenario}</p> : null}
          {currentTask.instruction ? <p>{currentTask.instruction}</p> : null}
          <p className={styles.helper}>Use the prototype naturally. Expected paths and success targets are intentionally hidden.</p>
          <div className={styles.actions}><button className={styles.primaryButton} type="button" onClick={() => void startTask()} disabled={working}>{working ? "Starting…" : "Start task"}</button></div>
        </section>
      </ParticipantShell>
    );
  }

  if ((stage === "runner" || stage === "give-up-confirm") && currentTask) {
    return (
      <div className={styles.runnerShell}>
        <header className={styles.runnerHeader}>
          <div><strong>Task {taskIndex + 1} of {totalTasks}</strong><span>{currentTask.title}</span></div>
          <button className={styles.ghostButton} type="button" onClick={() => setStage("give-up-confirm")}>Give up</button>
        </header>
        <div className={styles.runnerProgress}><i style={{ width: `${progress}%` }} /></div>
        {offline ? <div className={styles.offlineBanner} role="status">Offline — interactions are queued with stable event IDs and will retry when the connection returns.</div> : null}
        {!providerReady ? <div className={styles.providerLoading} role="status">Connecting to the published prototype…</div> : null}
        <iframe
          ref={iframeRef}
          className={styles.prototypeFrame}
          src={snapshot.prototype.liveEmbedUrl ?? snapshot.prototype.embedUrl}
          title={`${snapshot.title} prototype task ${taskIndex + 1}`}
          allow="fullscreen"
        />
        {stage === "give-up-confirm" ? (
          <div className={styles.modalBackdrop} role="presentation">
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="giveup-title">
              <h2 id="giveup-title">Give up this task?</h2>
              <p>Your attempt will be recorded as Give Up. You can still answer the post-task questions and continue the study.</p>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setStage("runner")} disabled={working}>Keep trying</button>
                <button className={styles.dangerButton} type="button" onClick={() => void confirmGiveUp()} disabled={working}>{working ? "Recording…" : "Give up task"}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === "timeout") {
    return <ParticipantShell progress={progress} meta="P11 · Timed out"><StatusCard title="Time is up for this task" body="This attempt is recorded as Timeout, separate from failure. You can continue according to the published study flow."><button className={styles.primaryButton} type="button" onClick={() => void continueFromTimeout()}>Continue</button></StatusCard></ParticipantShell>;
  }

  if (stage === "feedback" && currentTask) {
    return (
      <ParticipantShell progress={progress} meta="P06 · Post-task feedback">
        <section className={styles.card}>
          <span className={styles.eyebrow}>Task {taskIndex + 1} feedback</span>
          <h1>How was that task?</h1>
          {seqConfig.enabled ? (
            <fieldset className={styles.seqFieldset}>
              <legend>Overall, how difficult or easy was the task?{seqConfig.required ? " *" : ""}</legend>
              <div className={styles.seqScale}>
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <label key={value} className={seq === value ? styles.seqChoiceSelected : styles.seqChoice}>
                    <input type="radio" name="seq" value={value} checked={seq === value} onChange={() => setSeq(value)} />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <div className={styles.scaleAnchors}><span>Very difficult</span><span>Very easy</span></div>
            </fieldset>
          ) : null}
          {openConfig.enabled ? (
            <label className={styles.field}><span>What made this task easy or difficult?{openConfig.required ? " *" : ""}</span><textarea value={openFeedback} onChange={(event) => setOpenFeedback(event.target.value)} rows={5} /></label>
          ) : null}
          {feedbackError ? <p className={styles.errorText} role="alert">{feedbackError}</p> : null}
          <div className={styles.actions}><button className={styles.primaryButton} type="button" onClick={() => void submitFeedback()} disabled={working}>{working ? "Saving…" : "Continue"}</button></div>
        </section>
      </ParticipantShell>
    );
  }

  if (stage === "transition") {
    return <ParticipantShell progress={progress} meta="P07 · Next task"><StatusCard title="Task recorded" body={taskIndex + 1 < totalTasks ? `Next: Task ${taskIndex + 2} of ${totalTasks}.` : "Preparing study completion."}><button className={styles.primaryButton} type="button" onClick={() => { setTaskIndex((index) => Math.min(index + 1, totalTasks - 1)); setStage("task-intro"); }}>Continue to next task</button></StatusCard></ParticipantShell>;
  }

  if (stage === "complete") {
    return <ParticipantShell progress={100} meta="P08 · Complete"><StatusCard title="Thank you" body="Your anonymous usability session is complete. This completion state will not fire again if you reload the page." complete /></ParticipantShell>;
  }

  return null;
}

function ParticipantShell({ progress, meta, children }: { progress: number; meta: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>UT Study</div>
        <div className={styles.headerMeta}><span>{meta}</span><div className={styles.progressTrack} aria-hidden="true"><i style={{ width: `${progress}%` }} /></div></div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>Anonymous session · evidence-first usability testing</footer>
    </div>
  );
}

function StatusCard({ title, body, loading = false, technical = false, complete = false, children }: { title: string; body: string; loading?: boolean; technical?: boolean; complete?: boolean; children?: React.ReactNode }) {
  return (
    <section className={styles.card} data-tone={technical ? "technical" : complete ? "complete" : "neutral"}>
      {loading ? <div className={styles.spinner} aria-hidden="true" /> : <div className={styles.statusIcon} aria-hidden="true">{complete ? "✓" : technical ? "!" : "•"}</div>}
      <h1>{title}</h1>
      <p>{body}</p>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
}

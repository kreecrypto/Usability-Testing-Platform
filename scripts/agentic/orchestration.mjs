// This controller is a Codex workflow guard, not an authorization boundary for MCP.
// Only the Orchestrator may supply verified lease receipts and persist Sheet evidence.
const stages = new Set(['READY', 'DEVELOPING', 'REVIEW', 'FIX', 'REVIEWED', 'RECORDED']);
const sha = /^[a-f0-9]{40}$/;
const id = /^[A-Za-z0-9._:-]{1,160}$/;

export class AgenticError extends Error {
  constructor(code, message) { super(message); this.name = 'AgenticError'; this.code = code; }
}
const fail = (code, message) => { throw new AgenticError(code, message); };

export function validateConfig(config) {
  if (config?.version !== 1 || config.repository !== 'kreecrypto/Usability-Testing-Platform'
      || config.spreadsheetId !== '1car-7heRkDkN2RBiJvD3qr8WlbS2rvFUYSepQS7ABOQ'
      || config.supabaseProjectId !== 'qryvrcwbsehrzpersuoc'
      || config.timezone !== 'Asia/Bangkok' || JSON.stringify(config.scheduleHours) !== '[9,11,13,15,17]'
      || config.maxTasksPerRound !== 3 || config.startTaskWindowSeconds !== 3600
      || config.leaseSeconds !== 4500 || config.heartbeatSeconds !== 300
      || !['read_only', 'enabled'].includes(config.mode)
      || config.autoMerge !== false || config.productionDeploy !== false) {
    fail('SOURCE_GAP', 'Agentic configuration conflicts with the approved plan');
  }
  return config;
}

function validTaskCheckpoint(t) {
  if (!t.acceptance?.trim()) return false;
  const handoff = sha.test(t.commit ?? '') && id.test(t.developer ?? '')
    && /^codex\/[A-Za-z0-9._/-]+$/.test(t.branch ?? '') && !!t.worktree
    && Array.isArray(t.checks) && t.checks.length > 0;
  const review = handoff && id.test(t.qa?.agentId ?? '') && t.qa.agentId !== t.developer
    && t.qa.commit === t.commit && ['PASS', 'FAIL'].includes(t.qa.result)
    && Number.isInteger(t.qa.criticalCount) && t.qa.criticalCount >= 0
    && Array.isArray(t.qa.evidence) && t.qa.evidence.length > 0;
  const passed = review && t.qa.result === 'PASS' && t.qa.criticalCount === 0;
  if (t.stage === 'REVIEW') return handoff;
  if (t.stage === 'FIX') return review && !passed;
  if (t.stage === 'REVIEWED') return passed;
  if (t.stage === 'RECORDED') {
    if (t.status === 'BLOCKED_EXTERNAL') return !!t.blocker?.trim();
    return passed && !!t.prUrl && ['QA', 'COMPLETE'].includes(t.status)
      && Array.isArray(t.evidence) && t.evidence.length > 0
      && (t.status !== 'COMPLETE' || (t.acceptancePassed === true
        && (t.runtimeApplicable === false || t.runtimePassed === true)));
  }
  return true;
}

export function validateCheckpoint(state) {
  if (state?.version !== 1 || !id.test(state.runId ?? '') || !id.test(state.owner ?? '')
      || !/^MAJOR-(?:\d{2}|[A-C])$/.test(state.majorId ?? '')
      || !Number.isFinite(state.startedAt) || !Number.isInteger(state.revision) || state.revision < 0
      || !Array.isArray(state.tasks) || state.tasks.length > 3
      || new Set(state.tasks.map(t => t.id)).size !== state.tasks.length
      || state.tasks.some(t => !id.test(t.id ?? '') || t.majorId !== state.majorId || !stages.has(t.stage)
          || !validTaskCheckpoint(t)
          || (t.commit && !sha.test(t.commit))
          || (t.prUrl && !/^https:\/\/github\.com\/kreecrypto\/Usability-Testing-Platform\/pull\/\d+$/.test(t.prUrl)))
      || state.tasks.filter(t => t.stage !== 'RECORDED').length > 1) {
    fail('SOURCE_GAP', 'Invalid or conflicting checkpoint; do not discard or guess progress');
  }
  return state;
}

export function resumeCheckpoint(checkpoint, { runId, owner, now = Date.now }) {
  validateCheckpoint(checkpoint);
  const pending = checkpoint.tasks.find(t => t.stage !== 'RECORDED');
  if (!pending) return null;
  return validateCheckpoint({ ...structuredClone(checkpoint), runId, owner, startedAt: now(),
    previousRunId: checkpoint.runId, revision: 0, tasks: [structuredClone(pending)], status: 'READY', lease: null });
}

export class RoundController {
  constructor({ config, runId, owner, majorId, now = Date.now, checkpoint = null }) {
    this.config = validateConfig(config); this.now = now;
    this.state = checkpoint ? structuredClone(validateCheckpoint(checkpoint)) : {
      version: 1, runId, owner, majorId, startedAt: now(), revision: 0, tasks: [], status: 'READY', lease: null
    };
    validateCheckpoint(this.state);
    if (this.state.runId !== runId || this.state.owner !== owner || this.state.majorId !== majorId) {
      fail('SOURCE_GAP', 'Resume requires the same run/owner/MAJOR and a freshly verified lease');
    }
    // Stored lease metadata is never accepted as proof after process restart.
    this.proof = null;
  }
  receipt(proof) {
    if (proof?.verified !== true || proof.claimed !== true || proof.majorId !== this.state.majorId
        || proof.runId !== this.state.runId || proof.owner !== this.state.owner
        || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= this.now()
        || proof.observedAt > this.now() || this.now() - proof.observedAt > 300000
        || !Number.isFinite(proof.observedAt)) {
      this.state.status = 'LEASE_LOST'; this.proof = null;
      fail('LEASE_LOST', 'Live claim/refresh proof is missing, expired, stale or owned by another run');
    }
    this.proof = structuredClone(proof); this.state.lease = structuredClone(proof);
    return this;
  }
  mutation(proof = this.proof) {
    if (this.config.mode !== 'enabled') fail('READ_ONLY', 'Writer pilot must pass before enabling work mutations');
    if (['CLOSED', 'RELEASE_UNVERIFIED'].includes(this.state.status)) fail('ROUND_CLOSED', 'Resume in a new round with a fresh lease');
    this.receipt(proof);
    this.state.revision += 1;
  }
  startTask(task, proof) {
    this.mutation(proof);
    if (this.state.status === 'CLOSED') fail('ROUND_CLOSED', 'A released round cannot start work');
    if (this.now() - this.state.startedAt >= this.config.startTaskWindowSeconds * 1000) {
      fail('ROUND_TIME_LIMIT', 'Do not start a new Task after 60 minutes');
    }
    if (this.state.tasks.some(t => t.stage !== 'RECORDED')) fail('TASK_IN_FLIGHT', 'Finish or checkpoint the current Task first');
    if (this.state.tasks.length >= 3) fail('TASK_LIMIT', 'Maximum three Tasks per round');
    if (!id.test(task?.id ?? '') || task.majorId !== this.state.majorId || !task.acceptance?.trim()
        || !['IN_PROGRESS', 'QA', 'TODO_EXECUTABLE', 'PLANNED', 'BLOCKED_SELF_FIXABLE'].includes(task.status)
        || task.ready !== true) fail('SOURCE_GAP', 'Only a fresh queue-verified Task in the claimed MAJOR can start');
    if (this.state.tasks.some(t => t.id === task.id)) fail('TASK_ALREADY_ATTEMPTED', 'Resume the existing Task, do not create another branch/PR');
    this.state.tasks.push({ id: task.id, majorId: task.majorId, stage: 'DEVELOPING', acceptance: task.acceptance,
      sourceRef: task.sourceRef, branch: null, worktree: null, commit: null, prUrl: null, qa: null, blocker: null });
    this.state.status = 'IN_PROGRESS'; return this.current();
  }
  current() {
    const task = this.state.tasks.at(-1);
    if (!task || task.stage === 'RECORDED') fail('NO_ACTIVE_TASK', 'No active Task');
    return task;
  }
  developerCompleted(handoff, proof) {
    this.mutation(proof); const task = this.current();
    if (!['DEVELOPING', 'FIX'].includes(task.stage) || !id.test(handoff.agentId ?? '')
        || !sha.test(handoff.commit ?? '') || !/^codex\/[A-Za-z0-9._/-]+$/.test(handoff.branch ?? '')
        || !handoff.worktree || !Array.isArray(handoff.checks) || !handoff.checks.length) {
      fail('INVALID_HANDOFF', 'Developer handoff needs exact commit, isolated branch/worktree and checks');
    }
    if (task.branch && task.branch !== handoff.branch) fail('SOURCE_GAP', 'Resume must retain the existing branch');
    Object.assign(task, { developer: handoff.agentId, commit: handoff.commit, branch: handoff.branch,
      worktree: handoff.worktree, checks: handoff.checks, stage: 'REVIEW', qa: null }); return task;
  }
  review(result, proof) {
    this.mutation(proof); const task = this.current();
    if (task.stage !== 'REVIEW' || !id.test(result.agentId ?? '') || result.agentId === task.developer
        || result.commit !== task.commit || !['PASS', 'FAIL'].includes(result.result)
        || !Array.isArray(result.evidence) || !result.evidence.length
        || !Number.isInteger(result.criticalCount) || result.criticalCount < 0) {
      fail('INVALID_REVIEW', 'A separate Reviewer must verify the exact Developer commit with evidence');
    }
    task.qa = structuredClone(result);
    task.stage = result.result === 'PASS' && result.criticalCount === 0 ? 'REVIEWED' : 'FIX';
    return task;
  }
  linkPR(url, proof) {
    this.mutation(proof); const task = this.current();
    if (task.stage !== 'REVIEWED' || !/^https:\/\/github\.com\/kreecrypto\/Usability-Testing-Platform\/pull\/\d+$/.test(url)) {
      fail('INVALID_PR', 'Create/update a draft PR only after independent review');
    }
    if (task.prUrl && task.prUrl !== url) fail('DUPLICATE_PR', 'Update the recorded PR, do not replace it');
    task.prUrl = url; return task;
  }
  record({ status, evidence, acceptancePassed = false, runtimeApplicable = true, runtimePassed = false }, proof) {
    this.mutation(proof); const task = this.current();
    if (task.stage !== 'REVIEWED' || !task.prUrl || !['QA', 'COMPLETE'].includes(status)
        || !Array.isArray(evidence) || !evidence.length
        || (status === 'COMPLETE' && (!acceptancePassed || (runtimeApplicable && !runtimePassed)))) {
      fail('INVALID_EVIDENCE', 'Record only the verified scope; missing acceptance/runtime evidence stays QA');
    }
    task.status = status; task.evidence = evidence; task.acceptancePassed = acceptancePassed;
    task.runtimeApplicable = runtimeApplicable; task.runtimePassed = runtimePassed; task.stage = 'RECORDED'; return task;
  }
  block(reason, proof) {
    this.mutation(proof); const task = this.current();
    if (!reason?.trim()) fail('SOURCE_GAP', 'External blocker requires the missing input and reason');
    task.blocker = reason; task.status = 'BLOCKED_EXTERNAL'; task.stage = 'RECORDED'; return task;
  }
  close({ released }) {
    this.state.status = released === true ? 'CLOSED' : 'RELEASE_UNVERIFIED';
    this.proof = null; this.state.lease = null; this.state.revision += 1;
    return this.snapshot();
  }
  snapshot() { return structuredClone(this.state); }
}

// All integrations are injected by the Codex host. No API keys, MCP credentials,
// autonomous merge/deploy, or application endpoints exist in this module.
export async function runRound({ config, selection, adapters, runId, owner, now = Date.now, checkpoint = null }) {
  validateConfig(config);
  if (config.mode === 'read_only' || selection.status !== 'READY') {
    return { status: selection.status, mode: 'read_only', selection };
  }
  const preflight = await adapters.lease.preflight();
  if (preflight.verified !== true) fail('BLOCKED_EXTERNAL', 'Lease functions/permissions are not verified');
  const controller = new RoundController({ config, runId, owner, majorId: selection.major.id, now, checkpoint });
  const claim = await adapters.lease.claim(controller.snapshot());
  if (claim.claimed !== true) return { status: 'CLAIM_CONFLICT', majorId: selection.major.id };
  const proof = async () => {
    const p = await adapters.lease.refresh(controller.snapshot());
    controller.receipt(p); return p;
  };
  try {
    controller.receipt(claim);
    await adapters.checkpoint.save(controller.snapshot());
    let fresh = selection;
    while (true) {
      const pending = controller.state.tasks.find(t => t.stage !== 'RECORDED');
      if (controller.state.tasks.length >= 3 && !pending) break;
      if (now() - controller.state.startedAt >= 3600000 && !pending) break;
      if (fresh.status !== 'READY' || fresh.major.id !== controller.state.majorId) break;
      const candidate = fresh.tasks.find(t => !controller.state.tasks.some(done => done.id === t.id));
      if (pending && !fresh.tasks.some(t => t.id === pending.id)) fail('SOURCE_GAP', 'Pending Task must be revalidated in the fresh queue before resume');
      if (!pending && !candidate) break;
      let task = pending ?? controller.startTask({ ...candidate, ready: true }, await proof());
      await adapters.checkpoint.save(controller.snapshot());
      // Refresh while waiting via the host; never let a child own the lease.
      if (['DEVELOPING', 'FIX'].includes(task.stage)) {
        const handoff = await adapters.developer(task, { heartbeat: proof });
        controller.developerCompleted(handoff, await proof());
        await adapters.checkpoint.save(controller.snapshot());
      }
      if (controller.current().stage === 'REVIEW') {
        const review = await adapters.reviewer(controller.current(), { heartbeat: proof });
        controller.review(review, await proof());
        await adapters.checkpoint.save(controller.snapshot());
      }
      if (controller.current().stage !== 'REVIEWED') break;
      const url = controller.current().prUrl ?? await adapters.draftPR(controller.current(), await proof());
      controller.linkPR(url, await proof());
      await adapters.checkpoint.save(controller.snapshot());
      const evidence = await adapters.evidence(controller.current(), await proof());
      controller.record(evidence, await proof());
      await adapters.checkpoint.save(controller.snapshot());
      // Re-read Sheet before advancing; do not assume this PR has satisfied dependencies.
      fresh = await adapters.refreshQueue(controller.snapshot());
    }
  } catch (error) {
    controller.state.status = error.code ?? 'WORKER_FAILED';
    // Do not put arbitrary tool errors/credentials into durable checkpoints.
    controller.state.blocker = 'Round interrupted; inspect host evidence before resuming';
    throw error;
  } finally {
    let released = false;
    try { released = await adapters.lease.release(controller.snapshot()); }
    finally { await adapters.checkpoint.save(controller.close({ released })); }
  }
  return controller.snapshot();
}

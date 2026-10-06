import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { RoundController, runRound, resumeCheckpoint, validateConfig, validateCheckpoint } = await import(pathToFileURL(resolve('scripts/agentic/orchestration.mjs')).href);
const base = JSON.parse(readFileSync('agentic/config.json', 'utf8'));
const enabled = { ...base, mode: 'enabled' };
const commit = 'a'.repeat(40);
const task = (n = 1) => ({ id: `MT-${n}`, majorId: 'MAJOR-02', status: 'TODO_EXECUTABLE', acceptance: 'Verified behavior', ready: true });
const proof = (time = 1000) => ({ verified: true, claimed: true, majorId: 'MAJOR-02', owner: 'orchestrator', runId: 'run-1', observedAt: time, expiresAt: time + 4500000 });
const make = (config = enabled) => new RoundController({ config, runId: 'run-1', owner: 'orchestrator', majorId: 'MAJOR-02', now: () => 1000 });
const handoff = { agentId: 'developer', commit, branch: 'codex/task-MT-1', worktree: '/tmp/task-MT-1', checks: ['targeted PASS'] };
const review = { agentId: 'reviewer', commit, result: 'PASS', criticalCount: 0, evidence: ['exact-commit regression PASS'] };
const url = 'https://github.com/kreecrypto/Usability-Testing-Platform/pull/146';
const record = { status: 'QA', evidence: ['Sheet read-after-write matches commit'], acceptancePassed: false };

test('read-only config refuses mutation and forbidden merge/deploy config', () => {
  assert.throws(() => make(base).startTask(task(), proof()), { code: 'READ_ONLY' });
  assert.throws(() => validateConfig({ ...enabled, autoMerge: true }), { code: 'SOURCE_GAP' });
  assert.throws(() => validateConfig({ ...enabled, productionDeploy: true }), { code: 'SOURCE_GAP' });
});
test('no local checkpoint can substitute expired/stale/foreign ownership', () => {
  for (const bad of [{ ...proof(), expiresAt: 1000 }, { ...proof(), owner: 'another' }, { ...proof(), observedAt: -400000 }, { ...proof(), verified: false }]) {
    assert.throws(() => make().startTask(task(), bad), { code: 'LEASE_LOST' });
  }
  const c = make(); c.startTask(task(), proof());
  const resumed = new RoundController({ config: enabled, runId: 'run-1', owner: 'orchestrator', majorId: 'MAJOR-02', now: () => 1000, checkpoint: c.snapshot() });
  assert.throws(() => resumed.developerCompleted(handoff), { code: 'LEASE_LOST' });
});
test('cannot cross MAJOR or run simultaneous tasks', () => {
  const c = make();
  assert.throws(() => c.startTask({ ...task(), majorId: 'MAJOR-03' }, proof()), { code: 'SOURCE_GAP' });
  c.startTask(task(), proof());
  assert.throws(() => c.startTask(task(2), proof()), { code: 'TASK_IN_FLIGHT' });
});
test('independent Reviewer and exact commit are required; failed review cannot publish', () => {
  const c = make(); c.startTask(task(), proof()); c.developerCompleted(handoff, proof());
  assert.throws(() => c.review({ ...review, agentId: 'developer' }, proof()), { code: 'INVALID_REVIEW' });
  assert.throws(() => c.review({ ...review, commit: 'b'.repeat(40) }, proof()), { code: 'INVALID_REVIEW' });
  c.review({ ...review, result: 'FAIL' }, proof());
  assert.equal(c.current().stage, 'FIX');
  assert.throws(() => c.linkPR(url, proof()), { code: 'INVALID_PR' });
});
test('missing acceptance/runtime stays QA and PR identity survives repair/resume', () => {
  const c = make(); c.startTask(task(), proof()); c.developerCompleted(handoff, proof()); c.review(review, proof()); c.linkPR(url, proof());
  assert.throws(() => c.linkPR(url.replace('146', '147'), proof()), { code: 'DUPLICATE_PR' });
  assert.throws(() => c.record({ ...record, status: 'COMPLETE', acceptancePassed: true }, proof()), { code: 'INVALID_EVIDENCE' });
  const next = resumeCheckpoint(c.snapshot(), { runId: 'run-2', owner: 'orchestrator', now: () => 2000 });
  assert.equal(next.tasks[0].prUrl, url); assert.equal(next.tasks[0].commit, commit); assert.equal(next.previousRunId, 'run-1');
  c.record(record, proof());
  assert.equal(c.state.tasks[0].status, 'QA');
});
test('three Task cap, 60 minute admission and closed round are enforced', () => {
  const c = make();
  for (let n = 1; n <= 3; n++) { c.startTask(task(n), proof()); c.block('Researcher account not available', proof()); }
  assert.throws(() => c.startTask(task(4), proof()), { code: 'TASK_LIMIT' });
  const late = new RoundController({ config: enabled, runId: 'run-1', owner: 'orchestrator', majorId: 'MAJOR-02', now: () => 3601000,
    checkpoint: { ...make().snapshot(), startedAt: 1000 } });
  assert.throws(() => late.startTask(task(), proof(3601000)), { code: 'ROUND_TIME_LIMIT' });
  const closed = make(); closed.close({ released: true });
  assert.throws(() => closed.startTask(task(), proof()), { code: 'ROUND_CLOSED' });
});

function adapters(options: Record<string, unknown> = {}) {
  const calls: string[] = []; const checkpoints: unknown[] = [];
  return { calls, checkpoints,
    lease: { preflight: async () => ({ verified: true }), claim: async () => ({ ...proof(), claimed: options.conflict !== true }),
      refresh: async () => { calls.push('refresh'); if (options.leaseLost) return { ...proof(), claimed: false }; return proof(); },
      release: async () => { calls.push('release'); return true; } },
    checkpoint: { save: async (s: unknown) => { checkpoints.push(structuredClone(s)); } },
    developer: async () => { calls.push('developer'); if (options.workerFails) throw new Error('worker failed'); return handoff; },
    reviewer: async () => { calls.push('reviewer'); return { ...review, result: options.qaFails ? 'FAIL' : 'PASS' }; },
    draftPR: async () => { calls.push('draftPR'); return url; },
    evidence: async () => { calls.push('evidence'); return record; },
    refreshQueue: async () => ({ status: 'NO_EXECUTABLE_TASK' }) };
}
const selection = { status: 'READY', major: { id: 'MAJOR-02' }, tasks: [task()] };
test('dry run never calls integrations or claims work', async () => {
  const a = adapters(); const result = await runRound({ config: base, selection, adapters: a, runId: 'run-1', owner: 'orchestrator' });
  assert.equal(result.mode, 'read_only'); assert.deepEqual(a.calls, []); assert.deepEqual(a.checkpoints, []);
});
test('claim conflict writes no task/checkpoint and spawns no worker', async () => {
  const a = adapters({ conflict: true }); const r = await runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000 });
  assert.equal(r.status, 'CLAIM_CONFLICT'); assert.deepEqual(a.calls, []); assert.deepEqual(a.checkpoints, []);
});
test('worker failure and lost lease checkpoint safely and release owned claim', async () => {
  for (const fault of [{ workerFails: true }, { leaseLost: true }]) {
    const a = adapters(fault); await assert.rejects(runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000 }));
    assert.ok(a.calls.includes('release')); assert.ok(!a.calls.includes('draftPR'));
    assert.equal((a.checkpoints.at(-1) as { status: string }).status, 'CLOSED');
  }
});
test('QA failure stops with repair checkpoint, no PR or Sheet evidence', async () => {
  const a = adapters({ qaFails: true }); const r = await runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000 });
  assert.equal(r.tasks[0].stage, 'FIX'); assert.ok(!a.calls.includes('draftPR')); assert.ok(!a.calls.includes('evidence'));
});
test('reviewed checkpoint resumes existing PR without Developer, Reviewer or duplicate PR', async () => {
  const c = make(); c.startTask(task(), proof()); c.developerCompleted(handoff, proof()); c.review(review, proof()); c.linkPR(url, proof());
  const a = adapters(); const r = await runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000, checkpoint: c.snapshot() });
  assert.equal(r.tasks[0].prUrl, url); assert.ok(!a.calls.includes('developer')); assert.ok(!a.calls.includes('reviewer')); assert.ok(!a.calls.includes('draftPR'));
});
test('fresh queue cannot move to another MAJOR', async () => {
  const a = adapters(); a.refreshQueue = async () => ({ status: 'READY', major: { id: 'MAJOR-03' }, tasks: [{ ...task(2), majorId: 'MAJOR-03' }] } as any);
  const r = await runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000 });
  assert.equal(r.tasks.length, 1); assert.equal(a.calls.filter(c => c === 'developer').length, 1);
});


test('forged reviewed checkpoints cannot skip independent exact-commit review', () => {
  const c = make(); c.startTask(task(), proof()); c.developerCompleted(handoff, proof()); c.review(review, proof());
  for (const patch of [{ qa: null }, { commit: null }, { developer: null },
    { qa: { ...review, agentId: 'developer' } }, { qa: { ...review, commit: 'b'.repeat(40) } },
    { qa: { ...review, result: 'FAIL' } }, { qa: { ...review, evidence: [] } }]) {
    const x = c.snapshot(); Object.assign(x.tasks[0], patch);
    assert.throws(() => validateCheckpoint(x), { code: 'SOURCE_GAP' });
  }
});
test('PR identity is durable before evidence writes and survives interrupted evidence adapter', async () => {
  const a = adapters();
  a.evidence = async () => {
    assert.equal((a.checkpoints.at(-1) as any).tasks[0].prUrl, url);
    throw new Error('interrupted before Sheet write');
  };
  await assert.rejects(runRound({ config: enabled, selection, adapters: a, runId: 'run-1', owner: 'orchestrator', now: () => 1000 }));
  const saved = a.checkpoints.at(-1) as any;
  assert.equal(saved.tasks[0].prUrl, url); assert.equal(saved.tasks[0].stage, 'REVIEWED');
  const resumed = resumeCheckpoint(saved, { runId: 'run-1', owner: 'orchestrator', now: () => 1000 });
  const b = adapters(); await runRound({ config: enabled, selection, adapters: b, runId: 'run-1', owner: 'orchestrator', now: () => 1000, checkpoint: resumed });
  assert.ok(!b.calls.includes('draftPR'));
});

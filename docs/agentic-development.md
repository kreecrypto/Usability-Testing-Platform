# Agentic development team

This extends [team workflow](team-workflow.md) from PR #145. The Google Sheet remains planning authority. These agents develop UTP through Codex; no AI is added to the app.

## Roles and ownership

The Orchestrator alone reads fresh planning, owns/refreshes/releases the MAJOR lease and writes Sheet status/evidence. Developer works in one Task worktree and supplies an exact commit, branch, PR identity and checks. An independent QA agent reviews that commit after Developer stops editing. QA returns defects to Developer; changed commits require new review. The human owns product scope, accounts/billing and merge/Production deployment.

## Schedule and activation

Daily at 09:00, 11:00, 13:00, 15:00 and 17:00 Asia/Bangkok. One heartbeat belongs to this chat. Check existing automation.toml files before creating it; Agent Workstreams rows are not schedulers and must not be changed.

`agentic/config.json` defaults to `read_only`. The initial scheduler is PAUSED until a real Task pilot has claim, separate worker/reviewer and read-back Sheet evidence. Fixture tests and a successful lease probe do not enable writes. If blocked, manually run dry-run and report the missing input; do not change mode automatically. Activation requires a reviewed config change and verified pilot evidence. Local execution needs the machine and Codex available; see [official automation documentation](https://learn.chatgpt.com/docs/automations?surface=app).

## Read-only commands

```sh
npm run agentic:doctor
npm run agentic:dry-run -- /path/to/fresh-connector-snapshot.json
npm run test:agentic
```

Snapshot input is Google Sheets connector CellData / structuredContent for Task Hierarchy A:L, Task List A:N, Task Detail A:N and Feature Tasks A:P, including headers and all populated rows. Read metadata and grow bounded ranges if needed; never use latest-five records as the queue. Keep snapshots/checkpoints under ignored `.utp-agentic/`, without credentials. Missing sheets/headers stop selection; conflicting records become SOURCE GAP and cannot authorize dependencies.

Selection: IN_PROGRESS, QA, P0/P1/P2 among TODO_EXECUTABLE/PLANNED, then BLOCKED_SELF_FIXABLE. Only MAJOR Auto Eligible YES; a subtask NO means it is not independently scheduled. Choose one MAJOR and at most three currently ready tasks. Re-read before each next task; a draft PR does not satisfy a COMPLETE dependency. External blockers are recorded, and independent tasks within the same MAJOR may continue. No ready task: NO_EXECUTABLE_TASK; ambiguous source: SOURCE GAP.

## Codex host integration

The modules are guards and an injected-adapter harness, not a standalone MCP client or an access-control boundary. Codex supplies connectors and agents. There is no public API, browser credential, SDK key, local concurrency lock or migration.

The host uses `RoundController` for individual transitions (including external blockers), or `runRound` for an automated successful-work path. `runRound` requires lease, checkpoint, developer, reviewer, draftPR, evidence and refreshQueue adapters. Adapters must execute real tool calls and return observed results; fabricated verified flags are prohibited. Do not enable scheduling with mocked adapters.

1. Read AGENTS completely, current Sheet and GitHub base/dependency. Inspect existing checkpoint and PR before creating work. An unfinished task must remain authorized in the fresh queue; otherwise stop for SOURCE GAP. Use `resumeCheckpoint` with a new run ID, retaining branch/commit/PR. Checkpoints never establish ownership.
2. Preflight the three exact internal lease signatures, real SQL definitions, privileges and active lease rows. Invoke only `internal.try_claim_auto_major`, `internal.refresh_auto_major_lease` and `internal.release_auto_major` through the verified private Supabase connector. No public RPC/endpoint and no service credentials in files/browser.
3. Claim with MAJOR, unique owner/run ID and 4500 seconds. False means CLAIM_CONFLICT: no workers, Sheet edits or work mutations. Read back owner/run/expiry from `internal.auto_major_execution_leases`. Supply a receipt bound to those observations and current timestamps.
4. Refresh every 300 seconds and immediately before every work/Sheet/PR mutation. Orchestrator refreshes while waiting for workers, using bounded waits under 60 seconds. Any failed refresh, ownership mismatch or expired lease stops mutation; interrupt workers and checkpoint locally, then release only the owned lease. Never release another run's claim.
5. Save an atomic checkpoint before/after each transition with `writeCheckpoint`. It records run/MAJOR/Task, stage, branch/worktree, exact commit, existing PR, QA and blocker. Store no raw tool errors or secrets. A malformed checkpoint is an error, not permission to start over.
6. Start one Task worktree from the real dependency base. Give Developer the acceptance criteria and limits. QA is a distinct agent, reads the handoff exact commit in a separate worktree, and cannot edit Developer files. On FAIL: checkpoint FIX, return defects and re-review; no PR publication until PASS. QA can stop this round; resume the same branch next round.
7. On PASS create/update one draft PR; attach it to this chat. Inspect remote tree against reviewed local content and CI/Preview for the exact remote commit. Persist PR identity before Sheet mutation; don't make a duplicate on resume.
8. Orchestrator writes minimal Sheet evidence after checking fresh lease, then reads back the exact cells. Missing runtime/acceptance proof stays QA or the precise blocker. COMPLETE requires actual acceptance/runtime evidence. Findings, reports and research gates are untouched by tooling QA.
9. Re-read the same MAJOR queue. Maximum three Tasks including attempted external blockers. Stop admitting new tasks at 60 minutes; preserve unfinished work. Release in finally, read back release result, and save CLOSED or RELEASE_UNVERIFIED. Resume failures, don't replace their PRs.

`runRound` stops after a failed review/worker failure; a host using the controller can explicitly record an external blocker and continue within the same MAJOR. No integration may call merge or Production deploy. Unmerged FEAT-13/IA work remains on its actual dependency branch.

## Verification and reporting

Run targeted tests, repository tests, typecheck, build and design checks. There is no lint script; do not claim lint. Test source gaps, blocked/complete/empty queues, collision, lease expiry/loss, worker failures, failed independent QA, exact-commit resume, 3-task/60-minute caps and same-MAJOR enforcement. Live probes cover claims and privileges; fixtures alone cannot prove the scheduler or research runtime.

Thai report per round: Task/MAJOR, PR, exact commit/QA evidence, blocker and next step. No artificial progress or duplicate PR. Agentic/Trial/Demo QA never closes FEAT-13.07 or MAJOR-A/B/C.

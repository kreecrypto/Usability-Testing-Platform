# PM readiness round — 11 October 2026

Scope: user-approved PM team setup and read-only Workspace/Data handoffs. No researcher feature implementation, database mutation, live account creation or Production deployment in this round.

## Developer A — Workspace handoff

FEAT-01.11 remains QA / BLOCKED_EXTERNAL for real-account acceptance. IA-05/06/07 remain dependent on real account and development DB. No confirmed new self-fixable code defect was found in this scoped inspection.

- Fresh GitHub #139: open/draft, remote `0e90e4bea5b8180b8afac9aeb6fec18f471439d9`, branch `codex/researcher-workspace`, base main `c1be144`.
- Local Auth checkout `69131f1f4e6e03bd849b40ec04a0d4fa9062ece6`, tree `8e7a966aa8585c658939a00436593b11533626a2`; today's tests are local evidence, not exact remote-head certification.
- Fresh #141: open/draft, remote `f27bc4659a2e5319aab4ab36b647f8620101e1a9`, branch `codex/release-full`. Local `ff6bed238200a97524e609f791060760d47cb1e8` tree `e6bfdf2f3a7efa06abe28edf528bdbe2a35f730c` matches the tree recorded in PR evidence.
- Fresh command in Auth checkout: `node --test tests/researcher-access-recovery.test.ts tests/researcher-auth-boundary.test.ts tests/researcher-auth-routes.test.ts tests/researcher-login-flow.test.ts`: **17/17 PASS**. No files changed.

Existing code supports signup/recovery/safe return, browser-bound PKCE callback, HttpOnly refresh rotation, same-account reauthentication and draft recovery. Full candidate provides Workspace/Project/Test pagination and exact-version overview with permission-aware counts.

Owner-controlled account/mailbox is required. On exact #139 Preview test signup confirmation in originating browser → Projects → Workspace/Project/Test → reload; verify `/auth/callback` allowlist; expired/different-browser callback recovery; access/refresh expiry and preserved drafts; logout/deep-link denial; recovery email → `/reset-password`. Do not record passwords or tokens. Callback allowlist/email delivery are unverified gates, not diagnosed failures.

After isolated DB readiness, test #141 pagination beyond one page, search/status/archive, permission denial, explicit draft/published selection, allowed participant counts, No Data, desktop/320/390px and keyboard/network recovery. Real-account acceptance and FP-01–09 cannot be replaced with these local tests.

## Developer B — Data handoff

Live Supabase `list_branches` returned only `main` for `qryvrcwbsehrzpersuoc`, `MIGRATIONS_FAILED`, with `preview_project_status=ACTIVE_HEALTHY`. The response contains no failing migration SQL/version/error; **root cause remains unverified**. Service health does not prove migration readiness.

On local full candidate `ff6bed238200a97524e609f791060760d47cb1e8`:

- `node scripts/check-migration-history.mjs`: **PASS — 26 immutable reconciled migration versions**.
- `node --test tests/feat13-method-results.test.ts tests/feat13-runner-retry.test.ts tests/feat13-study-contract.test.ts tests/task50-52-findings-retest.test.ts tests/task54-58-nonfigma-release-qa.test.ts`: **18/18 PASS**, reported by Developer B.
- Existing documents record PostgreSQL 16 dual-history replay and CI PostgreSQL 17 FEAT-13 authorization smoke; these were **not rerun live today**.

Historical filenames and recorded grant/ACL statements were reconciled in the candidate. That evidence does not establish why the cloud branch failed. Obtain execution logs and compare the failing SQL before claiming a cloud fix. Do not rewrite Production history or run FEAT-13 on Production to test it.

Next sequence: PO provides approved isolated database → B captures actual failing version/error and runs reconciled history there → schema + `tests/feat13-migration-smoke.sql` grants/RLS/cross-workspace/anon-denial checks → published immutability and cloning → invite expiry/replay/screener → atomic Finding/citation/count/orphan rejection → deletion and legacy compatibility → C executes all four methods → independent QA recomputes evidence and tests failure/device cases.

Missing billing/database availability: BLOCKED_EXTERNAL. Accessible diagnostic/code/config repairs: BLOCKED_SELF_FIXABLE. FEAT-13.07 release and MAJOR-B/C admission: TODO_DEPENDENCY_BLOCKED. Task53 prototype source artifacts and Task58 numeric performance budget remain source gaps; do not invent them.

## PM setup validation

- Fresh planning ranges and PRs are recorded in [PM delivery](../pm-delivery.md).
- `node scripts/agentic/cli.mjs doctor`: HOST_PREFLIGHT_REQUIRED, config read_only, autoMerge=false, productionDeploy=false. Doctor does not claim a lease.
- `node --test tests/agentic-*.test.ts`: **32/32 PASS** on PM worktree. Existing guards cover claim collision, expiry, failed review, resume, same-MAJOR and task/time limits.
- Existing automation `utp-agentic-development-team` configuration inspected: **PAUSED**. No schedule/config/workstream changes.
- Local managed-worktree tool reported Git unavailable. PM created isolated `codex/pm-delivery` checkout using command-scoped `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; no machine configuration changed.
- Document QA checks diff and relative Markdown links. No new app build/typecheck/browser/Production proof is claimed for this documentation-only change.

Independent QA must review the committed PM delivery artifacts after PM stops editing. Reviewer result is reported separately with exact commit; it does not certify Auth, live DB or research release. Sheet task statuses/release gates remain unchanged.

## Round 2 — Builder/Participant and Trial

User approved continuation on 11 October 2026. Fresh Sheet Feature Tasks162–167/197–198 and GitHub #141/#155/#156/#157 read before dispatch. Existing #157 head983c2e060d6732dc862578b2353189d1d9780135 passed all four triggered CI workflows. Scheduler remains PAUSED/read_only.

Developer C inspected full candidate ff6bed238200a97524e609f791060760d47cb1e8 and ran `node --test tests/feat13-study-contract.test.ts tests/feat13-runner-retry.test.ts tests/feat13-entry-route.test.ts tests/feat13-method-results.test.ts`: **9/9 PASS**. Inline mock reproductions revealed two gaps not covered by these tests:

- P1 Tree final retry recalculates duration after accepted response/completion failure; changed retry is correctly rejected with409. Reload with all responses saved but session active can render a blank running panel.
- P2 Survey scale clearing converts empty string to0, silently adding a valid zero or rejecting an optional answer depending on range.

These are supported FEAT-13.04/.02 defects, BLOCKED_SELF_FIXABLE. PM verified live internal lease definitions and privileges (anon/authenticated denied; internal role allowed), found no active owners, claimed/read back MAJOR-08 under owner codex-pm-round2/run UTP-PM-R2-20261011 and mirrored ownership in Sheet. This is explicit manual repair, not auto-admission of MAJOR-08. Developer C alone owns isolated codex/method-runner-recovery based on #141; lease refresh/release and independent code QA are required. No FEAT-13.07 or MAJOR-A/B/C closure follows from the fix.

Developer D inspected Trial local ec89d84e9b00e8cb9f9e4fbc018daa35c3a637b0; working tree stayed clean:

- `node --test tests/trial-task-results.test.ts tests/trial-density.test.ts tests/trial-behavior.test.ts tests/browser-trial.test.ts tests/trial-target.test.ts`: **33/33 PASS**.
- `npm run test:trial:e2e -- trial-density.spec.ts trial-task-results.spec.ts trial-results.spec.ts --output=/tmp/utp-round2-trial-audit-rerun --reporter=list`: **23/23 PASS**.
- Initial browser attempt aborted before launch because Chromium1243 was missing. Matching runtime installed with existing `npx playwright install chromium`, cache only; rerun executed and passed product assertions. No package/config edits.
- Checked actual simulated clicks, exact frozen event/session/version scopes through Finding/Report, density modes/zooms/geometry, Canvas/background failure, technical/incomplete/No Data/Median semantics, storage/conflict recovery, desktop1280/mobile320/390, keyboard/focus/Escape and scoped axe. Mobile320 screenshot inspected. No actionable Trial defect found.

Trial evidence is fresh local synthetic QA, not fresh Preview or real researcher/Supabase QA. Existing P4/P5 COMPLETE remains scoped to Trial/Preview. Legacy Trial builds still cannot read the new technical outcome enum; no new rollback compatibility claim is made.

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

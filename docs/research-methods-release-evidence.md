# FEAT-13 release evidence (2026-09-28)

Status: **IN_PROGRESS**. Production exposure is **TODO_DEPENDENCY_BLOCKED**. Do not mark FEAT-13 or MAJOR-08 COMPLETE from this document alone.

The reviewable PR stack is [contract #127](https://github.com/kreecrypto/Usability-Testing-Platform/pull/127) → [builder, runner and invites #128](https://github.com/kreecrypto/Usability-Testing-Platform/pull/128) → [results, findings, report and retest #129](https://github.com/kreecrypto/Usability-Testing-Platform/pull/129). All remain draft; they are intended to release together after the original MAJOR-A/B/C proof gates.

Local QA on the complete stack: `npm test` passed 299/299; `npm run typecheck`, `npm run build`, `npm run check:design-system`, and `npm run check:high-fi` passed. The repository has no separate lint script. All repository migrations were applied in order to a disposable PostgreSQL 16 database. `tests/feat13-migration-smoke.sql` passed publish, immutable published blocks, screener acceptance/rejection, invite replay prevention, exact-version response uniqueness, clone to a new draft, researcher/non-member/anon RLS, Finding → method response linking, and session deletion cascades. The same smoke runs in Task 21 Authorization QA.

GitHub CI at the latest contract head `4bbcd11`, runner head `a1a2ed0`, and results head `b692700` passed GWD-11 Build QA, Task 20 Schema QA, Task 21 Authorization QA, and Local Demo QA. The [results Preview](https://usability-testing-platform-3ebavd6we.vercel.app) for `b692700` reached READY. This verifies deployment/build only; no real participant session was run there.

Remaining release gates:

- **BLOCKED_EXTERNAL:** Supabase project `qryvrcwbsehrzpersuoc` has no development branch; its listed `main` branch status is `MIGRATIONS_FAILED`. Creating a branch requires cost confirmation. Do not apply FEAT-13 migration to production to bypass this gate.
- **TODO_DEPENDENCY_BLOCKED:** MAJOR-A/B/C and the exact-main production proof remain open in the Sheet.
- **IN_PROGRESS:** On an isolated Supabase branch, run authenticated researcher create → publish → invite/screener → participate → results → Finding/Report → Retest for each method, plus expiry, mobile/keyboard, deletion/RLS and legacy-session compatibility. Only then merge the stack, expose once, run production smoke, and record the exact evidence in the Sheet.

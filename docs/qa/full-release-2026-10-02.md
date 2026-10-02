# Full research release candidate — 2 October 2026

Status: QA for the integrated code; Production TODO_DEPENDENCY_BLOCKED.

## Scope and integration

The release candidate starts at main c1be144 and combines Project/Test workflow #140 (including FEAT-13 and IA #123–133), methods UX writing #137, Retest comparability #138 and the Next.js 16.3.8 patch to Auth #139. Public Demo remains synthetic and read-only. The standalone Auth release can proceed only after its real-account gate; research features must ship together after all gates pass.

Retest integration retains shared navigation and links to each version's results, alongside server-derived metric snapshots, eligibility context and comparability reasons. Unsupported mixed usability/method runs remain explicitly unsupported. There is no claim of recordings, panel, AI, native-app tests or email distribution.

## Local evidence

- npm run qa: build, typecheck and 323/323 tests pass.
- AH design-system and high-fi checks pass; npm audit --omit=dev reports 0 vulnerabilities.
- No separate lint script exists.
- Reconciled 26 recorded Supabase baseline versions with repository files; check:migration-history verifies unchanged applied SQL baselines and unique versions.
- Both recorded SQL plus FEAT-13 and the aligned repository migrations replay successfully in disposable PostgreSQL 16.15 databases. FEAT-13 migration/RLS smoke passes on both; final schema and ACL token streams match. See migration-history-2026-10-02.md and supabase/migration-history.json.
- No Production schema, migration history or application data was written.
- Auth patched head 0e90e4b: 297 tests and all 6 GitHub Actions workflows passed; Vercel Preview READY at https://usability-testing-platform-lec4t7k59.vercel.app. Signed-out Login renders semantic email/password fields and signup/recovery links. This is not authenticated flow evidence.

## Remaining gates

| Gate | Status and required evidence |
| --- | --- |
| Auth #139 | BLOCKED_EXTERNAL: user has no researcher account. User-created signup/confirmation, Login → Projects → create workspace, refresh, logout and recovery on exact Preview. |
| FP-01–09 / MAJOR-A | TODO_DEPENDENCY_BLOCKED: real authenticated Production first-party workflow after the preparatory Auth release. |
| Cloud migration replay | BLOCKED_EXTERNAL: user says Pro/development branch is not ready. Only main exists and reports MIGRATIONS_FAILED. Local history reconciliation passes; cloud status remains unresolved. |
| FEAT-13.07 / MAJOR-B/C | TODO_DEPENDENCY_BLOCKED: all four real method journeys, version/evidence recomputation, retry/network, No Data, permission/tenant isolation, immutability, deletion, legacy sessions and desktop/mobile/keyboard proof on the exact release Preview with isolated database. Critical must be zero. |

## Deployment order

1. Validate Auth on its exact Preview, then merge/release #139 alone and run FP-01–09. Rebase this combined candidate onto the resulting main; do not merge research dependency PRs separately into main.
2. Connect the approved isolated development branch to the reconciled migration history; verify ordered replay, migration/RLS smoke and old-client compatibility there. Do not repair Production history or apply FEAT-13 there to test.
3. Run live full release gates on the exact candidate commit. Use caller JWT/RLS; Demo and disposable PostgreSQL fixtures are not live participant proof.
4. Only after the gates pass, apply the reviewed compatible additive migration and ship the combined research release once. Verify deployed commit, health, real flow and runtime logs before COMPLETE in the Sheet.
5. Capture the verified current Production deployment before rollout. If post-release smoke fails, revert the app to that candidate while retaining the compatible database changes; stop rollout and record the failure. Do not use a destructive down migration.

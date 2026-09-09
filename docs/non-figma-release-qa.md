# Non-Figma Release QA — Tasks 54–60

This document records the source-supported work that can be completed without Figma account/provider evidence. It deliberately does **not** convert external or source-gapped release gates into PASS.

## Task 54 — QA dataset

`tests/release-qa-fixture.ts` provides a deterministic, provider-neutral engineering dataset with:

- 24 sessions (minimum required: 20);
- more than 500 unique accepted raw/derived events;
- success_direct, success_indirect, failed, give_up, timeout, abandoned and technical_blocked outcomes;
- detour/backtrack and derived misclick/rage-click evidence;
- retry/duplicate delivery copies with stable event identity;
- SEQ and open-feedback answer fixtures.

`tests/task54-58-nonfigma-release-qa.test.ts` verifies the coverage and minimum sizes.

**Release status remains BLOCKED.** Task 54 depends on Task 53's three source-defined seed prototypes. This synthetic provider-neutral fixture is engineering QA only and does not pretend to be Mobile Checkout, Desktop CRM Case Creation, or Mobile Banking evidence.

## Task 55 — Metric recomputation

The same fixture independently recomputes and checks the displayed non-Figma metrics against accepted evidence:

- eligible denominator excludes technical_blocked;
- completion and give-up percentages;
- successful Median/P75/P90 duration;
- misclick count/rate;
- task outcomes and sample size;
- SEQ sample size;
- event schema/test-version/rule-version traceability;
- provider evidence metadata preservation;
- defined-funnel conversion/drop-off.

No Data behavior is already covered by the Results regression suite.

**Release status remains BLOCKED.** Task 55 depends on Task 54 and includes provider capability/coordinate-transform evidence. That Figma-bound part is intentionally excluded from this non-Figma execution cycle.

## Task 56 — Cross-browser / cross-device

Automated repository build/typecheck/tests and Vercel HTTP runtime smoke can prove route/build availability, but they do not substitute for the Sheet-required mobile/desktop browser matrix and Critical=0 evidence.

**Release status remains BLOCKED_EXTERNAL** until an actual browser/device matrix is executed. No physical-device PASS is claimed by this document.

## Task 57 — Privacy & security

Task 57 is already COMPLETE. Its exact-head Build/Schema/Authorization suite and hosted Supabase workspace-isolation/RLS/grant checks are recorded separately in `docs/task57-privacy-security-qa.md`.

## Task 58 — Performance & event load

The non-Figma harness verifies two source-supported reliability properties:

1. duplicate delivery leaves task/session aggregates unchanged;
2. a conflicting event that reuses one `(sessionId, idempotencyKey)` identity is rejected.

Existing GWD-07 tests continue to cover bounded retry, DLQ and database dedupe behavior.

### SOURCE GAP — performance budget

The current Sheet requires dashboard query performance to stay inside a **defined performance budget**, but no numeric dashboard latency/throughput budget was found in the current repository or planning source. A new threshold must not be invented. Consequently Task 58 cannot be marked COMPLETE solely from the synthetic load fixture.

## Task 59 — Internal UAT

The acceptance gate requires a UX Designer to create a test, publish it, complete the participant flow and read a Finding end-to-end with Critical UX Issue = 0.

Automation can prepare the workflow and verify route/build behavior, but it cannot truthfully replace the required human usability evidence. Task 59 therefore remains BLOCKED until internal UAT is performed after upstream release blockers are cleared.

## Task 60 — Production release / rollback

The production gate must stay closed while any required dependency is not PASS. Non-Figma release preparation uses this rollback plan:

1. **Code rollback:** identify the last known-good production Git SHA and redeploy/promote that immutable Vercel deployment.
2. **Database migrations:** migrations are forward-only by default. Before applying a release migration, verify it is backward-compatible with the last known-good app. For destructive changes, prepare and review an explicit compensating migration before release; do not improvise a production down migration.
3. **Event ingestion:** if correctness is uncertain, stop the affected release path rather than accepting events under an unverified contract. Preserve stable event IDs/idempotency keys so retry remains safe after recovery.
4. **Observability:** verify `/api/health`, Vercel runtime errors, collector errors/DLQ and Supabase security state immediately after rollout.
5. **Data safety:** never disable RLS/grants or expose service-role credentials as a rollback shortcut.
6. **Release decision:** do not reopen participant traffic until required release gates are PASS and Critical issue count is zero.

This rollback plan closes the self-fixable documentation gap only. Task 60 remains BLOCKED by its upstream release dependencies and must not be marked launched early.

# Tasks 44–49 — Results Analytics

## Source boundary

Requirements and dependency gates come from the UTP Google Sheet. Metric formulas, eligibility, path semantics and No Data behavior come from `docs/analytics.md` and `docs/metric-dictionary.md`. Existing Task 25 aggregation remains the canonical base instead of reimplementing competing formulas.

## Task 44 — Results Overview

The Results overview is derived from accepted canonical events for one exact `testVersionId`.

- Participants: distinct participant IDs represented by accepted session evidence.
- Completion: total direct + indirect success divided by total eligible task sessions. Percentages are not averaged across tasks.
- Headline duration: median successful-task duration from lifecycle timestamps.
- Misclick and give-up use the documented eligibility denominators.
- Technical-blocked task sessions are reported separately.
- Key friction shows derived misclick/rage-click/backtrack plus give-up counts.
- Empty denominators stay `null` / No Data.

## Task 45 — Task Detail

Task detail reuses the exact Task 25 aggregate for completion, Median/P75/P90, misclick, sample size and technical-blocked count. SEQ is exposed as raw 1–7 responses together with scale version and sample size. No unapproved SEQ mean or silent scale inversion is introduced because the canonical metric dictionary does not define one.

## Task 46 — Path & Detour

- Actual path = ordered raw canonical `screen_view` IDs per task/session.
- Expected path = the immutable task `expected_path` stored with the published version.
- Detour count = actual screen visits outside the versioned expected path, matching the metric dictionary.
- Repeated screen count is separate.
- Backtrack count uses derived `backtrack` evidence; no universal raw browser back event is fabricated.
- Terminal outcome follows first-terminal canonical ordering.

## Task 47 — Screen Heatmap — BLOCKED

Task 47 remains blocked by Task 39's source/capability gap. GWD-05 has a deterministic transform, but the current simplified V1 publish path has no source-approved immutable Figma geometry snapshot. Results must not substitute browser CSS coordinates.

## Task 48 — Funnel & Drop-off — IMPLEMENTED / DEPENDENCY BLOCKED

Task 48 implementation is present and independently QA-covered. `test_versions.funnel_config` stores the versioned ordered funnel definition, `src/lib/analytics/funnel.ts` computes deterministic ordered progression, Largest Drop and No Data semantics, and `tests/task48-funnel.test.ts` covers schema validation, technical-block exclusion, conversion/drop-off formulas and tie-breaking. The hosted migration `20260909123000_task48_funnel_definition.sql` has already been applied according to the current task evidence.

Task 48 must still remain dependency-blocked in planning because its Sheet dependency includes Task 40, which is not yet release-complete. This is a dependency gate, not a missing Task 48 implementation. Do not reimplement funnel configuration while Task 40 is blocked; re-run Task 48 QA when Task 40 clears, then update the task status from the planning source.

## Task 49 — Session Timeline & Response Detail

Session detail combines accepted raw/derived canonical events with persisted answers. Raw sequence/provenance and timestamps remain visible in the read model, task terminal outcomes are derived using first-terminal evidence, and feedback stays linked to session/task without fabricating deleted or unsupported evidence.

## Security

The Results API uses the existing researcher access token plus the Supabase publishable key. PostgREST RLS remains authoritative. No service-role key is used in the Results read path.

## QA

`tests/task44-49-results.test.ts` recomputes the required metrics from deterministic accepted-event fixtures and verifies technical-block exclusion, No Data behavior, raw SEQ scale preservation, expected-vs-actual path behavior, derived backtrack evidence and session feedback timeline coverage.

Task 48 additionally has `tests/task48-funnel.test.ts` plus its dedicated migration and documentation. Dependency-blocked status must not be interpreted as absent implementation.

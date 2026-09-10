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

## Task 47 — Screen Heatmap — IMPLEMENTED / RELEASE QA OPEN

Task 39 now supplies the source-supported integration path: source-backed Figma node bounds are stored in the immutable published test-version snapshot, the collector strips any client-supplied canonical point, and server-side normalization emits canonical 0..1 coordinates only when presented/target/scroller geometry resolves consistently.

`src/lib/analytics/heatmap.ts` consumes only those canonical points. It distinguishes Available, No Data, and Unsupported states and supports exact filtering by test version, task, screen, source-backed device class, and terminal outcome. `src/app/results/[testVersionId]` exposes the filterable heatmap view and scales points using normalized coordinates and stored frame aspect ratio. Browser CSS pixels are never a fallback.

Task 47 must remain short of COMPLETE until the Release Gate has real published-test/provider pointer evidence proving the full persisted geometry → collector normalization → Results heatmap path.

## Task 48 — Funnel & Drop-off — COMPLETE

Task 48 has Release Gate=NO and is COMPLETE in the planning source. `test_versions.funnel_config` stores the versioned ordered funnel definition, `src/lib/analytics/funnel.ts` computes deterministic ordered progression, Largest Drop and No Data semantics, and `tests/task48-funnel.test.ts` covers schema validation, technical-block exclusion, conversion/drop-off formulas and tie-breaking. The hosted migration `20260909123000_task48_funnel_definition.sql` was applied according to the recorded task evidence.

## Task 49 — Session Timeline & Response Detail

Session detail combines accepted raw/derived canonical events with persisted answers. Raw sequence/provenance and timestamps remain visible in the read model, task terminal outcomes are derived using first-terminal evidence, and feedback stays linked to session/task without fabricating deleted or unsupported evidence.

## Security

The Results API uses the existing researcher access token plus the Supabase publishable key. PostgREST RLS remains authoritative. No service-role key is used in the Results read path.

Task 47 canonicalization happens at the collector/server trust boundary before event persistence; a participant-supplied `canonicalPoint` is not trusted.

## QA

- `tests/task44-49-results.test.ts` covers Tasks 44–46/49 canonical results behavior.
- `tests/task47-screen-heatmap.test.ts` covers canonical-only heatmap points, exact filters, geometry-version matching, and No Data vs Unsupported.
- `tests/gwd05-heatmap-transform.test.ts` covers scaling, device-frame, overlay, scrolling-frame and fail-closed transform invariants.
- `tests/task39-geometry-integration.test.ts` covers immutable geometry contract and collector-side canonicalization.
- `tests/task48-funnel.test.ts` covers Task 48.

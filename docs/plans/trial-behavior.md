# TRIAL-02 — browser-local simulated behavior

User-approved plan, 2026-10-04. Dependency: TRIAL-01 PR #142, Preview verified. Scope: Project → Test → simulated target Participant → Results → Finding → Report → Retest, browser/origin only, no Login.

Offer an immutable version-pinned UTP simulated housing/repair target, distinct from external Banrao. Collect consent/task-scoped screen, pointer, action and scroll events through an exact origin/window first-party bridge. No typed values/PII, researcher API, Supabase or Cloudflare. Preserve existing Trial data. Durable local acceptance and event IDs avoid loss/duplicate counting; storage failure stops target tracking until retry succeeds.

Heatmap uses version-pinned target DOM render as background, document coordinates including scroll, exact viewport/layout/version groups and a separate trial contract. Keyboard actions do not fabricate points. Results include event IDs and per-session paths, filters and No Data/unsupported reasons. Findings/reports reference exact evidence; Retest behavior comparison requires compatible task/target/layout. Self-report stays separate; no inferred success/misclick. Preview only; research gates unchanged.

Acceptance: no events before consent/active task or after finish; wrong source/origin ignored; refresh/resume, retry/dedup, corrupt/quota/stale storage, legacy decoding, viewport/scroll geometry and changed-layout exclusion; keyboard and 320/390 desktop complete flow. Run repository tests/typecheck/build/design/high-fi (no lint script), verify Preview actual interactions before COMPLETE. No Production deployment.

## User-approved audit remediation — TRIAL-02.P1 → TRIAL-02.P2

2026-10-04: preserve Trial-only contracts and backend isolation. P1 first: add Playwright real-browser regressions with per-context fixtures and test-only Storage faults, covering pause/blocked navigation, exact-event retry, cross-tab reload and terminal-task conflict export/explicit acknowledgement. No production fault hooks. Fix any observed failures before P2.

P2: distinguish no collection from empty filters and reset filters; click map loading/error/timeout/retry/mismatch states; center a geometry-preserving narrow map; explain missing path within selected evidence; use “แผนที่ตำแหน่งคลิก” without density/success claims. Verify desktop/320/390 keyboard, frozen Finding/Report event IDs and coordinates. Run unit + browser tests/typecheck/build/design checks (no lint script). Update draft PR #143, inspect final Preview and record evidence; no Production deploy or research release-gate completion. If Preview access remains unavailable, classify only that verification as BLOCKED_EXTERNAL.

## TRIAL-02.P3 — click-map usability
Approved 2026-10-04, after P1/P2. Separate page from exact collection geometry; add contained fit/100/150/200% zoom, expanded native dialog and numbered 44px click controls with overlap chooser and keyboard list. Inspect raw metadata and focus #event evidence, then preselect exactly one valid submitted-session event in the existing Finding form. Invalid/incomplete/cross-version selections remain unselected. Preserve frozen Report subsets, read-only target and original coordinates; no new API/schema/density metrics/external-site tracking. Preview only.

# TRIAL-02 — browser-local simulated behavior

User-approved plan, 2026-10-04. Dependency: TRIAL-01 PR #142, Preview verified. Scope: Project → Test → simulated target Participant → Results → Finding → Report → Retest, browser/origin only, no Login.

Offer an immutable version-pinned UTP simulated housing/repair target, distinct from external Banrao. Collect consent/task-scoped screen, pointer, action and scroll events through an exact origin/window first-party bridge. No typed values/PII, researcher API, Supabase or Cloudflare. Preserve existing Trial data. Durable local acceptance and event IDs avoid loss/duplicate counting; storage failure stops target tracking until retry succeeds.

Heatmap uses version-pinned target DOM render as background, document coordinates including scroll, exact viewport/layout/version groups and a separate trial contract. Keyboard actions do not fabricate points. Results include event IDs and per-session paths, filters and No Data/unsupported reasons. Findings/reports reference exact evidence; Retest behavior comparison requires compatible task/target/layout. Self-report stays separate; no inferred success/misclick. Preview only; research gates unchanged.

Acceptance: no events before consent/active task or after finish; wrong source/origin ignored; refresh/resume, retry/dedup, corrupt/quota/stale storage, legacy decoding, viewport/scroll geometry and changed-layout exclusion; keyboard and 320/390 desktop complete flow. Run repository tests/typecheck/build/design/high-fi (no lint script), verify Preview actual interactions before COMPLETE. No Production deployment.

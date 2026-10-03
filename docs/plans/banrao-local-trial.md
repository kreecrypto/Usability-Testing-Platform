# TRIAL-01 — Browser-local Banrao workflow

Approved plan + Implement (2026-10-03); Source of Truth: Feature Tasks row 179.
Priority P0, IN_PROGRESS. No dependencies on research/Auth release. Separate main-based branch.

Route /trial: project → test → participant → results → findings → report → retest.
Local versioned storage only. No researcher APIs, Supabase reads, service credentials, migrations or changes to Auth/RLS. Existing /demo remains synthetic/read-only. External target https://banrao-uat.pages.dev opens in a new tab; no target mutations or tracking bridge assumptions.

Projects contain tests; drafts can edit URL/tasks, publication snapshots are immutable. Anonymous local sessions resume and submit once, using three answers (done/not done/skipped), optional ease 1–7 and text. Counts derive from stored sessions, scores from actual answers. No behavioral completion/time/click/path/heatmap metrics. Findings reference exact session/task/version; reports capture same-version findings and support browser print. Retest copies task IDs and retains parent version; comparisons only for unchanged instruction and scale. No claim of a validated fix to Banrao.

Local storage schema 1; malformed/unsupported data is preserved with an error, never replaced silently. Writes must succeed before showing saved; stale tabs cannot overwrite newer revisions. No cross-device invites or identity/contact collection. Local answers are not FEAT-13.07 / MAJOR-A/B/C release evidence.

QA: meaningful model tests; immutable publish; retry/resume; invalid/incomplete answers; No Data; evidence ownership; changed retest instructions; corrupt/quota/stale storage. Full repo tests/typecheck/build/design checks. Browser complete journey + refresh + 320/390 + keyboard + absence of researcher requests, on Preview. No production release in this task.

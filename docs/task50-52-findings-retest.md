# Tasks 50–52 — Findings, Evidence & Retest

## Source boundary

Requirements and dependency gates come from the UTP Google Sheet. Existing Supabase `findings`, `finding_evidence` and `retests` tables are the implementation base. Retest metric semantics come from `docs/analytics.md`. No external issue tracker or statistical method is invented because the current Source of Truth does not require one.

## Task 50 — Findings model & severity

The V1 Finding record now carries the acceptance-criteria fields explicitly:

- `problem` — non-empty observable usability problem;
- optional `task_id` and `screen_id`;
- severity: `critical | high | medium | low`;
- status: existing canonical finding status;
- `metric_snapshot` — exact metric value or No Data, sample size, technical-blocked count, test-version ID, aggregation version, rule versions and source event IDs.

The create API does not trust workspace/project scope from browser input. It resolves workspace/project from the requested `testVersionId` through the authenticated user's Supabase RLS context, then persists the finding.

## Task 51 — Evidence & actionable issue

A Finding itself is the V1 actionable UX issue. No Jira/GitHub/Linear ticket provider is added without a Source-of-Truth requirement.

Evidence types are explicit:

- session;
- event;
- answer;
- path;
- heatmap.

`finding_evidence.workspace_id` is derived from the parent Finding and backed by composite foreign keys so tenant consistency is structural, not RLS-only. Path evidence stores the canonical expected/actual path context that was already derived by Results. Heatmap evidence is accepted only with an explicit canonical payload; the UI keeps Heatmap disabled while Task 47/39 geometry is blocked and never manufactures CSS-pixel evidence.

## Task 52 — Retest comparison

Retest creation is anchored to an existing Finding. The API derives workspace scope from the Finding and requires `originalTestVersionId` to equal that Finding's version.

The comparison shows:

- baseline value;
- retest value;
- absolute delta;
- relative delta only when both values exist and the baseline is non-zero;
- baseline and retest sample sizes;
- technical-blocked counts;
- both test-version IDs.

`statisticalSignificance` remains `null`. The UI explicitly says “Not claimed” because no statistical method is defined in V1. It also does not infer whether a positive/negative delta is better or worse without metric-specific product semantics.

## Security & privacy

Researcher APIs use the existing publishable Supabase key plus authenticated user JWT. Existing RLS/editor-role policies remain authoritative. No service-role key is introduced to Findings/Retest researcher paths.

Finding evidence receives workspace-scoped composite references to Finding/Session/Event/Answer where applicable. This prevents cross-workspace evidence attachment even if application validation regresses.

## QA

`tests/task50-52-findings-retest.test.ts` verifies:

- metric snapshots stay tied to the exact published version and preserve No Data;
- retest absolute/relative delta behavior and no significance claim;
- sample size and technical-block context remain visible;
- evidence inserts derive workspace scope from the parent Finding;
- path/heatmap evidence fails closed without required canonical payload.

Release-gated tasks still require their configured runtime/release evidence before being marked COMPLETE.

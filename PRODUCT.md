# Usability Testing Platform

## Register

product

## Platform

web

## Users

UX researchers and designers create multi-target usability studies and inspect evidence. Product viewers read aggregate results with restricted access to participant content. Participants run a published study without a workspace account.

## Product Purpose

`Test Target → Test → Behavior → Evidence → Friction → UX Finding → Fix → Retest`

UTP is not a generic analytics dashboard. Its North Star is:

`Behavior → Evidence → UX Decision`

## Positioning

Usability Testing & UX QA Platform for Figma prototypes, owned UAT/Production websites, and supported external websites.

A provider is not assumed to expose every signal. Capability-dependent evidence must be classified as Available / Partial / Unsupported / No Data and must never be fabricated.

## Product mental model

`Workspace → Project → Test → Published Test Version → Immutable Target Snapshot → Participant Session → Evidence → Results / Report → Finding → Fix → Retest`

## Design Principles

- Use Test Target as the product-level mental model; Figma is one provider.
- Preserve published Test Version and Target Snapshot immutability.
- Keep participant instructions free of success targets and expected paths.
- Separate `technical_blocked` from usability failure.
- Show sample size, denominator, target/provider context and exact published version with analytics.
- No Data is not numeric zero.
- Findings are researcher-authored interpretations supported by evidence.
- Report claims must drill down to evidence.
- Unsupported external/provider capability fails closed.

## Release Proof Model

Task 60 is not closed by task-count completion.

Release confidence is proven in order:

1. **MAJOR-A — Flow Proven**
   - real Production study
   - Create → Publish → Participant → Results → Finding → Report
2. **MAJOR-B — Evidence Proven**
   - Raw/Accepted Event → Outcome → Metric → Evidence → Finding → Report provenance
3. **MAJOR-C — Adversarial Proven**
   - refresh / duplicate / retry / network / abandon / provider unavailable / auth / multi-tab / immutability / No Data / device / delete / load

Then:

`MAJOR-A + MAJOR-B + MAJOR-C → MAJOR-07 V1 Release Gate → Task 60`

## Accessibility & Inclusion

Keyboard focus, validation, disabled actions, semantic structure, contrast, touch targets and responsive mobile layouts remain required. Participant Runner is P0 responsive work. A desktop PASS does not imply a mobile PASS.

## Sources

Planning authority:
- Google Sheet — Usability Testing Platform — Task List
- Tabs: Task Hierarchy / Task List / Task Detail / Source Governance

Implementation authority:
- GitHub repository `kreecrypto/Usability-Testing-Platform`
- `docs/test-target-contract.md`
- `docs/research-evidence-report-contract.md`
- `docs/proof-gate-execution.md`
- `docs/major-auto-execution.md`
- `docs/vercel-runtime.md`

Runtime/data authority:
- Vercel Production for runtime evidence
- Supabase for canonical persisted data and Auth

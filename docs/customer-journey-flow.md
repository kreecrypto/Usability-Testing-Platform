# UTP Customer Journey Flow

Status: **DERIVED UX VIEW — does not replace Google Sheet planning authority**

This document turns the current UTP planning + implementation structure into a customer-journey view. It preserves the existing product loop:

`Test Target → Test → Behavior → Evidence → Friction → UX Finding → Fix → Retest`

Sources:
- Google Sheet: Usability Testing Platform — Task List
- GitHub README / information architecture / proof-gate execution / research evidence & report contract / wireframes
- Current main implementation status as of 2026-09-25

## End-to-end journey

```text
RESEARCHER — BUILD
Open Workspace / Project
→ Create Test
→ Configure Target
→ Create Scenario / Tasks
→ Define Outcome Rules
→ Preview
→ Publish Immutable Test Version
→ Share Public Link

PARTICIPANT — RUN
Access Link
→ Availability / Capability Check
→ Consent
→ Task Intro
→ Target Runner
→ Perform Task
→ Deterministic Outcome
→ SEQ / Feedback
→ Next Task / Complete

RESEARCHER — UNDERSTAND
Results
→ Evidence
→ Metric Observation
→ Finding
→ Usability Report

PRODUCT TEAM — IMPROVE
Fix
→ New Draft / Retest
→ Run New Cohort
→ Compare Compatible Evidence
→ Decision
```

## Journey map

| Stage | Phase | Actor | Goal | Main action | Platform response | Evidence / data | Main risk | Success signal | Major domain | Proof gate | Current status | Screen / flow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | BUILD | Researcher | Enter the product quickly | Open workspace/project or temporary researcher session | Resolve workspace + project context without mandatory V1 signup | workspace/project context | auth/bootstrap block, wrong workspace | researcher reaches project context | MAJOR-01 | MAJOR-A Flow Proven | IN PROGRESS (proof) | S03 → S05 → S06 |
| 2 | BUILD | Researcher | Create a real study | Create Test | Create Draft Test under project | projectId / testId / draft | unclear next action | usable draft exists | MAJOR-01 | MAJOR-A | IN PROGRESS (real-study proof) | S08 → S09 |
| 3 | BUILD | Researcher | Choose what to test without provider lock-in | Configure Figma / UAT / Production / supported external Target | Classify + preflight provider/capability; fail closed for invalid/restricted target | provider + capability snapshot | Unsupported misread as 0/success | target state is explicit: Available / Partial / Unsupported / Restricted | MAJOR-01 / MT-04 | MAJOR-A + MAJOR-C | PASS | Target step, S10–S11 |
| 4 | BUILD | Researcher | Define unbiased participant work | Create Scenario / Tasks | Persist task instructions/order without exposing expected path | taskId / scenario / order | ambiguous or leading task | each task has clear objective | MAJOR-01 | MAJOR-A | PASS | S12–S14 |
| 5 | BUILD | Researcher | Define deterministic completion semantics | Configure Success / Failure / Give-up / Timeout + post-task question | Enable only rules supported by Target capability | rule version + capability requirements | provider-specific or unsupported rule | exactly one deterministic terminal outcome | MAJOR-02 / MT-08 | MAJOR-A + MAJOR-B | PARTIAL in planning; implementation advanced | S15–S16 |
| 6 | BUILD | Researcher | Verify readiness before real users | Preview → Validate → Publish | Create immutable Published Test Version + Target Snapshot | testVersionId + immutable snapshot | publish invalid config / later mutation changes history | published version stays reproducible | MAJOR-01 | MAJOR-A + MAJOR-C | PASS | S17 → S20 |
| 7 | RUN | Participant | Enter the test reliably | Open public link | Check access / availability / capability and preserve version/session context | publicToken + session bootstrap | invalid token, provider unavailable | continue or fail closed as technical block | MAJOR-02 | MAJOR-A + MAJOR-C | IN PROGRESS | P01, P09–P12 |
| 8 | RUN | Participant | Understand rights before tracking | Review Consent → Accept/Decline → Task Intro | No consent-dependent behavior before Accept | consent state / timestamp | pre-consent tracking, biased copy | consent precedes tracking | MAJOR-02 | MAJOR-A + MAJOR-C | IN PROGRESS | P02 → P03 |
| 9 | RUN | Participant | Perform the task with minimal UTP interference | Start Task → use real target | Resolve immutable target snapshot and capture only trustworthy provider evidence | canonical events / path / click / completion signal when supported | provider failure, duplicate/retry, unsupported embed, multi-tab collision | supported target works; provider failure = technical_blocked | MAJOR-02 + MAJOR-03 | MAJOR-A + MAJOR-B + MAJOR-C | IN PROGRESS | P04 → P05 + exception states |
| 10 | RUN | Participant | Finish task and provide feedback naturally | Outcome → SEQ → Feedback → Next / Complete | Record one deterministic terminal state + post-task response | outcome + SEQ + answer + task lifecycle | duplicate terminal state, timeout/abandon miscount | result is tied to exact session + version | MAJOR-02 / MT-08 | A + B + C | IN PROGRESS | P05 → P08 |
| 11 | UNDERSTAND | Researcher | Understand what happened and why | Open Results / Tasks / Paths / Heatmaps / Sessions | Show Metric Observation with availability, n, denominator, technical blocks and drill-down | accepted evidence → deterministic metrics | No Data rendered as 0; missing provenance | every metric can be recomputed | MAJOR-03 + MAJOR-04 | MAJOR-B Evidence Proven | QA | S22 → S27 |
| 12 | UNDERSTAND | Researcher | Turn evidence into an actionable research decision | Create Finding → severity → recommendation → Report | Keep Findings researcher-authored; Report synthesizes existing evidence instead of inventing new metrics | evidence bundle + finding + report claim | auto-causal conclusion / duplicated analytics logic | every report claim drills down to evidence | MAJOR-05 / MT-10 | MAJOR-A + MAJOR-B | GAP / dependency blocked | S29; Report target-state |
| 13 | IMPROVE | Researcher / Product Team | Prove the fix improved usability | Fix → Retest → new cohort → compare | Compare only compatible metric definition / capability / eligibility contexts | baseline + retest observations + n + technical blocks | invalid comparison across incompatible targets/metrics | valid before/after delta or fail closed | MAJOR-06 / MT-12 | MAJOR-B + MAJOR-C | TODO_DEPENDENCY_BLOCKED | S30 → new draft S09 |

## Proof-gate overlay

The customer journey is not release-ready just because the screens exist.

```text
Flow Proven (MAJOR-A)
Create → Publish → Participant → Results → Finding → Report
        ↓
Evidence Proven (MAJOR-B)
Raw / Accepted Evidence → Outcome → Metric → Evidence Bundle → Finding → Report Claim
        ↓
Adversarial Proven (MAJOR-C)
Refresh / Retry / Network / Abandon / Provider / Auth / Multi-tab / No Data /
Device / Delete / Load failures recover safely or fail closed
        ↓
MAJOR-07 / Task 60
Final exact-main release decision
```

## Cross-journey UX invariants

1. Participant never sees expected path, success criteria, failure rule, internal analytics, or researcher notes.
2. Consent happens before consent-dependent behavioral tracking.
3. `technical_blocked` is separate from usability failure.
4. `Unsupported`, `Partial`, `No Data`, and numeric zero are distinct.
5. Published Test Version + Target Snapshot are immutable.
6. Every reportable metric must be reproducible from accepted evidence.
7. Findings are researcher-authored interpretations supported by evidence.
8. Report is the synthesis layer, not a second analytics engine.
9. Retest delta is shown only when comparison semantics are compatible.
10. Mobile/Desktop and adversarial paths are part of the journey, not post-launch polish.

## Planning reconciliation notes

Current planning and current main implementation are not fully synchronized in every row. In particular:
- App Workflow Audit still marks provider-neutral outcome rules as PARTIAL, while GitHub main includes MT-08 deterministic rule work.
- Participant flow remains IN PROGRESS at the planning/proof level even though provider-neutral runner and first-party bridge implementation has advanced.
- Usability Report remains the largest explicit journey GAP and blocks a complete Build → Run → Understand → Fix → Retest loop.

When status conflicts, Google Sheet remains planning authority; GitHub is implementation evidence.

# UTP Proof Gate Execution

Status: **REQUIRED V1 release governance**

Planning authority: Google Sheet — Usability Testing Platform — Task List.

## Why this model exists

UTP must prove more than a happy path. A release can appear functional while evidence is wrong, incomplete, duplicated, or misleading.

The release confidence model is:

```text
Flow Proven
    ↓
Evidence Proven
    ↓
Adversarial Proven
    ↓
MAJOR-07 V1 Release Gate
    ↓
Task 60 — Production Release
```

Task 60 depends directly on MAJOR-A, MAJOR-B, and MAJOR-C.

## MAJOR-A — Flow Proven

Question:

> Can a real user complete the end-to-end UTP journey on Production?

Canonical first proof uses one owned first-party web target so Core UTP can be proven independently of Figma account configuration.

Required path:

```text
Create real Study
→ Configure Target
→ Create Scenario / Tasks
→ Publish immutable Test Version
→ Run real Participant session
→ Persist session/task/events/answers
→ Open Results
→ Create evidence-linked Finding
→ Generate Usability Report
```

Planning Sub Tasks: `FP-01..FP-09`.

Gate rules:

- use real Production study/session evidence
- do not close from fixture/mock-only evidence
- Critical flow blocker = 0
- the Report must refer to the same exact published Test Version used by the Participant

## MAJOR-B — Evidence Proven

Question:

> Does UTP tell the truth, and can each material claim be reproduced?

Required trace:

```text
Raw/provider evidence
→ Accepted canonical event / answer
→ Session / task lifecycle
→ Deterministic outcome
→ Metric observation
→ Evidence bundle
→ Finding
→ Report claim
```

Planning Sub Tasks: `EP-01..EP-08`.

Gate rules:

- rejected/unsupported signals never become reportable evidence
- `technical_blocked` remains separate from usability failure
- numerator / denominator / sample / technical blocks remain inspectable
- Unsupported / Partial / No Data / numeric zero remain distinct
- report claims drill down to exact Test Version, Target Snapshot, session/task and evidence provenance

Existing Tasks 54–55 remain supporting evidence under this gate.

## MAJOR-C — Adversarial Proven

Question:

> When real-world failure happens, does UTP recover safely or fail closed without lying?

Planning Sub Tasks: `AP-01..AP-12`.

Required adversarial classes include:

- refresh during task
- duplicate/retry/idempotency
- network failure/offline recovery
- give-up/timeout/abandon
- provider unavailable/restricted
- expired/wrong-session authorization
- multiple tabs/session isolation
- published Target immutability after draft change
- missing evidence / No Data semantics
- mobile/desktop/rotation variation
- retention/delete propagation
- event burst/retry/DLQ/load stress

Gate rules:

- no duplicate terminal outcomes
- no duplicate metric contribution
- no silent reportable-evidence loss
- unsupported capability fails closed
- no synthetic metric/chart/evidence for unavailable signals
- workspace/session/version isolation remains intact
- Critical = 0 for the supported release matrix

Existing Tasks 53, 56–58 and MT-13/MT-14 remain supporting evidence under this gate.

## MAJOR-07 — V1 Release Gate

MAJOR-07 contains Task 60 as the final release decision.

It does not reopen already-proven work. It verifies:

- MAJOR-A = COMPLETE
- MAJOR-B = COMPLETE
- MAJOR-C = COMPLETE
- exact-main Vercel Production deployment = READY
- canonical Production health passes
- rollback candidate is identifiable
- no new release-blocking runtime error cluster

## Relationship to capability MAJORs

MAJOR-01..06 remain implementation/capability domains. They feed the Proof Gates.

A capability task can be implemented and QA-passing while a proof gate remains open because real Production/session/evidence/adversarial proof is missing.

Therefore:

`Implemented ≠ Proven ≠ Release Ready`

## Evidence rule

No gate may be marked COMPLETE without verifiable evidence from the appropriate authority:

- Planning state: Google Sheet
- Implementation/tests/migrations: GitHub
- Persisted runtime data/Auth: Supabase
- Runtime/deployment: Vercel Production
- Human/device/provider proof: actual required execution evidence

No synthetic Production research data may be created merely to close a gate.

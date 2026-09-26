# Research Evidence & Usability Report Contract

Status: **PROPOSED REQUIRED for V1**  
Primary planning tasks: **MT-09, MT-10, MT-11, MT-12, MT-13, MT-14**  
Research basis: project contracts + Deep Research review on 2026-09-23.

## Purpose

UTP must not stop at behavioral analytics. The product must preserve a trustworthy chain from participant behavior to a research decision:

```text
Target
→ Participant Behavior
→ Canonical Evidence
→ Deterministic Derivation
→ Metric Observation
→ Researcher Interpretation
→ Finding
→ Usability Report
→ Fix
→ Retest
```

This contract defines the minimum research-truth semantics required across Results, Findings, Report and Retest.

The platform must never convert missing capability, missing data, or a technical failure into a negative usability conclusion.

## 1. Research-truth invariants

1. Every actionable report claim must be traceable to accepted evidence.
2. Every metric must be bound to an exact published test version.
3. Every metric must retain target provider and immutable target snapshot context.
4. `technical_blocked` is operational evidence, not a usability failure.
5. `Unsupported`, `Partial`, `No Data`, and numeric zero are different states.
6. Derived events must remain traceable to raw canonical evidence and a rule/version.
7. A metric anomaly is not automatically a UX Finding.
8. Findings are researcher-authored interpretations supported by evidence.
9. Retest comparison is allowed only when the compared metric definitions and required capabilities are compatible.
10. Unsupported external-target behavior must fail closed; UTP must not fabricate click, path, scroll, heatmap, or completion evidence.

## 2. Availability state contract

Every capability-dependent metric or visualization must expose one of these states:

| State | Meaning | UI rule |
| --- | --- | --- |
| `Available` | Required trustworthy evidence exists | Show value/visualization |
| `Partial` | Some evidence exists, but full claim is not supported | Show limitation and supported subset |
| `Unsupported` | Provider/runtime cannot supply trustworthy evidence | Do not render a synthetic metric/chart |
| `No Data` | Capability is supported but accepted evidence is absent for this scope | Show No Data, never 0 |

Zero is a valid numeric observation only when the denominator/evidence exists and the computed value is actually zero.

## 3. Evidence provenance contract

A reportable observation must be traceable through this chain:

```text
Finding / Report Claim
↓
Metric Observation or Evidence Bundle
↓
Aggregation / Rule Version
↓
Canonical Event IDs / Answer IDs / Path Evidence
↓
Session + Task
↓
Published Test Version
↓
Immutable Target Snapshot
↓
Provider + Capability Snapshot
```

Minimum provenance fields for any reportable metric:

- `testVersionId`
- target provider
- immutable target snapshot identifier/hash or equivalent stable context
- metric key
- metric-definition version
- aggregation version
- required capability set
- availability state
- numerator/denominator where applicable
- sample size
- `technicalBlockedCount`
- source evidence identifiers or a stable evidence manifest
- computed timestamp

Physical persistence may use tables, views, materialized data, or versioned JSON. The physical schema is an implementation decision; the provenance semantics above are required.

## 4. Metric observation contract

A metric value is not sufficient by itself. Results and Report surfaces must treat a metric as an observation with context.

Recommended logical shape:

```ts
type MetricObservation = {
  metricKey: string;
  metricDefinitionVersion: string;
  testVersionId: string;
  taskId?: string;
  screenId?: string;
  targetProvider: string;
  availability: "available" | "partial" | "unsupported" | "no_data";
  value: number | null;
  numerator?: number;
  denominator?: number;
  sampleSize: number;
  technicalBlockedCount: number;
  aggregationVersion: string;
  ruleVersions: string[];
  evidenceRefs: string[];
};
```

Existing formulas in `docs/analytics.md` remain canonical unless the planning source changes them.

## 5. Finding contract

A Finding is a human research interpretation, not an automatic conversion of a low metric or friction signal.

Every Finding must support:

- observable problem statement
- affected task/screen/context
- severity
- affected sample context
- supporting metric observations when available
- direct evidence references (session/event/answer/path/heatmap)
- researcher interpretation
- recommendation
- exact test-version and target context
- optional contradicting/context evidence
- retest link when created

Automation may surface a **Finding Candidate** but must not silently assign the final problem statement, severity, causal explanation, or recommendation.

## 6. Consolidated Usability Report IA

The V1 Report is an interactive research decision surface, not a PDF-first export.

```text
Usability Report
├── Study Context
│   ├── Test + published version
│   ├── Target provider + immutable snapshot
│   ├── Participant / eligible-attempt counts
│   ├── Technical blocks
│   └── Capability coverage
├── Executive Summary
│   ├── Overall outcomes
│   ├── Top friction
│   ├── Critical / High findings
│   └── Researcher decision note
├── Task Outcomes
│   ├── Completion / failure / give-up / timeout
│   ├── Median / P75 / P90 time
│   ├── SEQ
│   ├── Friction metrics where supported
│   └── Technical blocks
├── Findings
│   └── Finding
│       ├── Problem
│       ├── Severity
│       ├── Affected sample
│       ├── Metric context
│       ├── Evidence bundle
│       ├── Researcher interpretation
│       └── Recommendation
├── Evidence Explorer
│   ├── Sessions
│   ├── Event timeline
│   ├── Paths
│   ├── Heatmaps
│   └── Answers
└── Retest
    ├── Baseline context
    ├── Retest context
    ├── Comparable metrics
    └── Delta + decision
```

### Evidence bundle

Each Finding in the Report should expose a compact evidence bundle:

- observed sessions / affected sample
- relevant task outcomes
- metric observation(s)
- representative session/path/answer evidence
- provider and capability state
- target snapshot/test version
- aggregation/rule version
- link to detailed evidence

## 7. Results IA relationship

Results remains the analytical workspace. Report becomes the synthesis layer.

Target-state order inside one exact test version:

```text
Results
├── Report
├── Overview
├── Tasks
├── Paths
├── Heatmaps
├── Sessions
├── Findings
└── Retest
```

Interpretation:

- **Overview / Tasks / Paths / Heatmaps / Sessions** = investigation surfaces.
- **Findings** = researcher interpretation surface.
- **Report** = stakeholder + decision synthesis surface.
- **Retest** = fix-validation surface.

Report must link down to analysis/evidence. It must not duplicate independent metric logic.

## 8. Retest comparability contract

A baseline/retest comparison may show a delta only when:

- metric key is the same,
- metric-definition version is compatible,
- required capability exists in both cohorts,
- target/provider context is shown,
- eligibility semantics are the same,
- numerator/denominator/sample context is retained.

Always show:

- baseline value and sample
- retest value and sample
- technical-blocked counts
- test-version IDs
- target provider/snapshot context
- absolute delta
- relative delta only when mathematically meaningful

Do not claim statistical significance unless an approved method is explicitly implemented.

## 9. QA acceptance

MT-13 multi-target QA must verify, at minimum:

1. Figma, first-party web, supported external web, and blocked/restricted external cases.
2. Consent occurs before consent-dependent behavioral collection.
3. Runtime target resolution uses the immutable published target snapshot.
4. Provider/runtime failures become `technical_blocked`, not usability failure.
5. Unsupported capability never renders synthetic metric/chart evidence.
6. `No Data` is not represented as zero.
7. A displayed metric can drill down to evidence/provenance.
8. A Finding can link to supporting evidence.
9. A Report claim can drill down to Finding/metric/evidence.
10. Browser/device matrix and accessibility checks pass for supported flows.
11. A researcher can complete Create → Publish → Participate → Analyze → Finding → Report end-to-end.

## 10. V1 release gate addition

MT-14 / Task 60 must not pass unless:

- provider-neutral task rules are deterministic,
- event/evidence ingestion is duplicate-safe,
- metric recomputation from accepted evidence passes,
- capability semantics are consistent across Builder, Runner, Results and Report,
- first-class Usability Report exists,
- report claims are traceable to evidence,
- Findings retain test/target/provenance context,
- multi-target browser/device QA passes,
- internal Researcher UAT passes,
- Critical UX issues = 0.

## 11. Non-goals for this change

Do not add these only because they are common in competing research products:

- AI auto-severity
- AI causal Finding generation
- generic UX score
- statistical significance claims without an approved method
- synthetic external-site heatmaps
- PDF-first reporting architecture
- new survey/recruitment/moderated-research modules

## 12. Source classification

### REQUIRED from current UTP direction

- immutable published test versions
- provider-neutral Test Target
- capability-aware evidence
- `technical_blocked` exclusion from usability denominators
- No Data ≠ 0
- deterministic/reproducible metrics
- evidence-backed Findings
- multi-target QA and release gate

### PROPOSED by Deep Research and this contract

- first-class consolidated Report as the default synthesis surface
- explicit Metric Observation logical model
- explicit Evidence Bundle in Findings/Report
- Report-first ordering within Results
- Finding Candidate terminology for automated suggestions

These proposals become implementation requirements only after they are accepted into the Google Sheet planning source.

## 13. External research references

The Deep Research review used current external standards/practice only to strengthen research integrity, not to overwrite UTP requirements:

- NIST Common Industry Format / usability reporting guidance
- ISO 9241-11:2018 usability concepts
- Figma Embed API capability documentation
- Web same-origin / CSP framing constraints

UTP remains governed by the project planning source and repository contracts.

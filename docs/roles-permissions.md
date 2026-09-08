# V1 Roles, JTBD & Permission Baseline

This document translates the product role model into an engineering authorization baseline.

## Product personas

### UX Researcher

**JTBD:** Plan and run usability studies, define task/success rules, publish tests, inspect sessions, and turn evidence into findings.

Baseline capabilities:
- create/edit projects and tests
- configure tasks, success/failure rules, and questions
- preview, publish, and close tests
- view full results, paths, heatmaps, sessions, and responses
- create/edit findings and retest comparisons
- access participant/session identifiers only when needed for research operations

### UX/UI Designer

**JTBD:** Import Figma prototypes, configure test flows, inspect friction evidence, fix designs, and retest quickly.

Baseline capabilities:
- create/edit projects and test content
- connect/import Figma prototypes
- configure tasks, start points, and success/failure rules
- preview tests
- view results, paths, heatmaps, sessions, and findings
- create/edit findings and retest comparisons
- publish when granted Project Editor capability
- no workspace membership or retention-policy administration by default

### Product Viewer

**JTBD:** Review summarized usability evidence and findings for product decisions without changing tests or gaining unnecessary participant-data access.

Baseline capabilities:
- read project/test summaries
- read aggregated results, findings, and retest comparisons
- view only evidence exposed to viewers
- read-only at the API/authorization layer
- no test edits, publishing, deletion, raw participant identifiers, or raw event export

### Participant

**JTBD:** Open a published test link, understand consent, complete tasks, and submit feedback without a workspace account.

Baseline capabilities:
- access only a specific published test version through a participant link/token
- read consent and task instructions
- interact with the prototype
- submit explicit task actions such as give-up
- submit SEQ/open feedback
- no workspace, results, or cross-participant access

## Permission matrix

| Capability | Researcher | Designer | Product Viewer | Participant |
| --- | --- | --- | --- | --- |
| View project/test | yes | yes | yes | published run only |
| Create/edit test | yes | yes | no | no |
| Connect Figma | yes | yes | no | no |
| Preview | yes | yes | no | no |
| Publish/close | yes | project-editor capability | no | no |
| Aggregated results | yes | yes | yes | no |
| Session-level evidence | yes | yes | restricted | no |
| Raw participant identifiers | need-based | restricted/need-based | no | own session only |
| Create/edit findings | yes | yes | no | no |
| Workspace/admin settings | no by default | no by default | no | no |

## Engineering invariants

1. Product persona and workspace administration are separate concepts.
2. Workspace Owner/Admin is a system authorization role, not one of the four product personas.
3. Participant access does not use workspace membership and must never inherit authenticated workspace permissions.
4. Every server-side mutation/read requiring workspace access must authorize from server-trusted membership/capability data.
5. Product Viewer read-only behavior must be enforced by API/database authorization, not only UI controls.
6. Privacy-restricted participant/session fields require separate field/view policy from aggregated-results access.
7. Client-provided role/capability claims are never trusted as authorization evidence.

## RLS handoff

Task `21 — Implement Auth, Workspace & RLS` must implement and test these invariants, including negative cross-workspace and viewer-write cases.

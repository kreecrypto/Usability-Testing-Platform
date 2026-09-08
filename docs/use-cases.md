# V1 Prototype Usability Test Use Cases

This document defines the canonical product scenarios used by tracking, analytics, runner, and QA.

## UC-01 — Happy Path / Direct Success
Participant opens a published test, accepts consent, starts a task, follows the expected path, reaches the success rule, answers post-task feedback, and completes the test.

Expected outcome: `success_direct`.

## UC-02 — Indirect Success / Detour
Participant reaches the success rule through a different path or after detours/backtracking.

Expected outcome: `success_indirect`; completion still counts as success.

## UC-03 — Explicit Failure Rule
Participant triggers a configured failure rule.

Expected outcome: derived `failed`, traceable to raw evidence.

## UC-04 — Give Up
Participant explicitly gives up during a task.

Expected raw event: `task_give_up`; outcome: `give_up`.

## UC-05 — Timeout
The task exceeds its configured time limit before another terminal outcome occurs.

Expected raw event: `task_timeout`; outcome: `timeout`.

## UC-06 — Abandon
Participant exits/closes the flow before completion.

Expected raw evidence: `task_abandoned` and/or `session_abandoned`; outcome: `abandoned`.

## UC-07 — Technical Blocked
The participant cannot continue because of provider/access/runtime failure such as Figma login/password/permission/embed failure/provider outage.

Expected outcome: `technical_blocked`; excluded from usability denominators and reported as an operational failure.

## UC-08 — Consent Declined
Participant does not consent to the study.

Expected behavior:
- do not start consent-dependent behavioral tracking
- do not create an eligible usability task session
- persist only operational consent-decline evidence permitted by policy

## UC-09 — Reload / Temporary Disconnect / Retry
The participant reloads the runner or event delivery retries after a temporary failure.

Expected behavior:
- preserve session/test-version identity when resumable
- retry event delivery idempotently
- if recovery is impossible, apply a deterministic abandon/technical-blocked rule

## UC-10 — Closed / Invalid Published Link
The participant opens a closed, expired, invalid, or unavailable published test link/token.

Expected behavior:
- do not start a usability session
- show an explicit access state
- do not create failed/abandoned usability outcomes

## Cross-use-case invariants

1. A session is bound to one immutable published test version.
2. A task has at most one canonical terminal outcome.
3. Derived events never mutate raw evidence.
4. Technical/access failure is not treated as usability failure.
5. Every reported metric must be reproducible from accepted raw evidence plus versioned rules.

# V1 Deterministic Task Outcome Rules

## Canonical outcomes

- `success_direct`
- `success_indirect`
- `failed`
- `give_up`
- `timeout`
- `abandoned`
- `technical_blocked`

## Global invariant — first valid terminal wins

A task has at most one canonical terminal outcome.

Rules are evaluated in canonical raw-event order (`sequence`, then `occurredAt`). Once a terminal outcome is committed, later terminal signals cannot change it. Duplicate/retried evidence must not create a second terminal result.

## Direct success

Trigger when the published test's success rule is satisfied and the actual canonical path matches its expected-path rule.

Output: derived `task_success` with outcome `success_direct`.

## Indirect success

Trigger when the success rule is satisfied but the actual path differs from the versioned expected path or satisfies the configured detour condition.

Output: derived `task_success` with outcome `success_indirect`.

## Failed

Trigger when an explicit published failure rule is satisfied before any other terminal outcome.

Output: derived `task_failed` with outcome `failed`. The derived event must reference the triggering raw evidence through `derivedFromEventIds`.

## Give up

Trigger when an active participant explicitly submits Give Up.

Input: raw `task_give_up`; outcome: `give_up`.

## Timeout

Trigger when the configured timeout threshold is reached while the task is active and no earlier terminal outcome exists.

Input: raw/system `task_timeout`; outcome: `timeout`.

Timeout configuration belongs to the immutable published test version.

## Abandoned

Trigger when the task/session ends without another terminal outcome and the versioned abandonment rule is satisfied, for example after explicit runner exit or expiry of a resume/heartbeat window.

Input: raw `task_abandoned`; outcome: `abandoned`.

A temporary disconnect must not become abandoned until the configured recovery window expires.

## Technical blocked

Trigger when access/provider/runtime failure prevents a valid task attempt from continuing and no earlier terminal outcome exists.

Input: raw `task_technical_blocked`; outcome: `technical_blocked`.

This is an operational result and is excluded from usability denominators.

## Race rules

1. Success before Give Up -> success remains canonical.
2. Accepted Give Up before success trigger -> give-up remains canonical.
3. Success and failure triggers on different raw events -> the earlier canonical event wins.
4. Timeout after committed success/failure -> ignore for task outcome.
5. Successful reconnect inside the resume window -> do not create abandoned.
6. Technical failure after completed task -> record operational error separately; do not replace outcome.
7. Client-provided outcome labels are never trusted, except explicit raw actions allowed by the event contract such as Give Up.

## Versioning requirements

Each published test version must bind:
- success rule version
- failure rule version
- expected path definition/version
- timeout configuration
- abandonment policy version

Derived success/failure events must persist `ruleVersion` and `derivedFromEventIds`.

# V1 Usability Metric Dictionary

This is the product/analytics glossary for V1. Detailed formulas remain canonical in `docs/analytics.md`.

## Eligibility

`eligible task sessions = started task sessions - technical_blocked task sessions`

`technical_blocked` is operational and must not be silently counted as usability failure.

## Completion Rate

`(success_direct + success_indirect) / eligible task sessions * 100`

## Time on Task

`terminal.occurredAt - task_started.occurredAt`

Headline: median duration for successful tasks. Secondary: P75 and P90. Technical-blocked sessions are excluded.

## Misclick Rate

`derived misclick events / eligible pointer_interaction events * 100`

Misclick detection and provider coordinate/capability logic must be versioned.

## Give-up Rate

`give_up task sessions / eligible task sessions * 100`

## Failure Rate

`failed task sessions / eligible task sessions * 100`

## Drop-off Rate

For funnel transition A -> B:

`(entered A - reached B) / entered A * 100`

Funnel definitions belong to the published test version. Technical-blocked sessions are reported separately.

## Detour

Count of transitions/screen visits outside the versioned expected path before terminal outcome, derived from ordered canonical `screen_view` evidence.

## Backtrack

A derived path behavior where the ordered `screen_view` sequence revisits a previously traversed screen according to a versioned rule.

## SEQ

Store the raw numeric Single Ease Question response together with the scale version. Never silently invert direction.

## Retest Delta

Show baseline value, retest value, absolute delta, relative delta where meaningful, both sample sizes, technical-blocked counts, and test-version IDs.

Do not imply statistical significance unless an explicit statistical method is implemented.

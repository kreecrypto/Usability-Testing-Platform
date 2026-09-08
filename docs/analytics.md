# Analytics Contract

Analytics in V1 must be derived from accepted raw canonical events and an exact published test version.

## Eligibility rule

A task session with terminal outcome `technical_blocked` is excluded from usability-rate denominators because it represents an operational/access failure rather than product usability.

```text
eligible task sessions = started task sessions - technical_blocked task sessions
```

## Completion rate

```text
(success_direct + success_indirect) / eligible task sessions × 100
```

Report direct and indirect success separately when useful, while the headline completion rate includes both.

## Time on task

There is no `time_on_task` event.

For a task session with a canonical terminal outcome:

```text
terminal_event.occurredAt - task_started.occurredAt
```

`technical_blocked` sessions are excluded from usability time summaries.

Default headline summary: **Median successful-task duration** where outcome is `success_direct` or `success_indirect`.

Also expose P75 and P90. Failed, give-up, timeout and abandoned durations may be inspected through outcome filters but must not be silently mixed into the successful-task headline.

Average may be shown as secondary context, not the only summary.

## Time on screen

There is no `time_on_screen` event.

For an ordered screen sequence:

```text
next screen_view.occurredAt - current screen_view.occurredAt
```

For the final screen, use the first relevant task/session terminal timestamp.

Idle-adjusted time must use a separately versioned rule if implemented later.

## Misclick rate

`misclick` is a derived event.

```text
versioned misclick events / eligible pointer_interaction events × 100
```

The numerator and denominator must be produced under a declared provider-capability and detection-rule version so historical results remain reproducible.

## Give-up rate

```text
give_up task sessions / eligible task sessions × 100
```

## Failure rate

```text
failed task sessions / eligible task sessions × 100
```

## Drop-off rate

For a defined funnel transition A → B:

```text
(entered A - reached B) / entered A × 100
```

Funnel configuration must be stored with the published test version.

`technical_blocked` sessions must be reported separately and not silently treated as a product drop-off.

## Path analysis

An actual path is the ordered list of canonical `screen_view` IDs visited during a task session.

Derived path metrics:

- expected-path match
- detour count
- backtrack count
- repeated screen count
- terminal outcome

Paths must use internal canonical screen/frame IDs rather than presentation labels or provider-specific names.

`backtrack` is derived from the ordered screen sequence; universal raw `back` / `forward` events are not required.

## Heatmap

Heatmap inputs come from canonical `pointer_interaction` evidence transformed into stable frame coordinates.

Normalized output coordinates are:

```text
normalizedX ∈ [0,1]
normalizedY ∈ [0,1]
```

Heatmaps should be filterable by:

- test version
- task
- screen/frame
- device class
- terminal outcome

Provider-specific coordinate transforms are versioned separately.

## SEQ

Single Ease Question is stored as the raw numeric response plus the question scale version.

Do not silently invert scales. The UI must know which end means easier/harder.

## Retest comparison

Retest comparisons must show context, not only delta:

```text
baseline value
retest value
absolute delta
relative delta (when meaningful)
baseline sample size
retest sample size
technical-blocked counts
test version IDs
```

Do not imply statistical significance unless a defined statistical method is actually implemented.

## Quality rule

Every metric displayed in the Results UI must have:

1. a documented formula,
2. an input event/query definition,
3. a declared eligibility rule,
4. a deterministic test fixture,
5. a QA case that recomputes the value from raw canonical events.

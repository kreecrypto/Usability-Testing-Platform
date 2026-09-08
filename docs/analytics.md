# Analytics Contract

Analytics in V1 must be derived from accepted raw events and a specific published test version.

## Completion rate

```text
successful task sessions / started task sessions × 100
```

Report direct and indirect success separately when useful, while the headline completion rate includes both.

## Time on task

For completed task sessions:

```text
task terminal timestamp - task_started timestamp
```

Primary summary: **Median**.

Also expose P75 and P90. Average may be shown as secondary context, not the only summary.

## Misclick rate

```text
misclick events / eligible click-or-tap events × 100
```

The misclick detection rule must have a version so historical results remain reproducible.

## Give-up rate

```text
give_up task sessions / started task sessions × 100
```

## Drop-off rate

For a defined funnel transition A → B:

```text
(entered A - reached B) / entered A × 100
```

Funnel configuration must be stored with the test version.

## Path analysis

An actual path is the ordered list of canonical screen/frame IDs visited during a task session.

Derived path metrics:

- expected-path match
- detour count
- backtrack count
- repeated screen count
- terminal outcome

Paths must use internal canonical screen/frame IDs rather than presentation labels.

## Heatmap

Heatmap inputs are normalized interaction points:

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
test version IDs
```

Do not imply statistical significance unless a defined statistical method is actually implemented.

## Quality rule

Every metric displayed in the Results UI must have:

1. a documented formula,
2. an input event/query definition,
3. a deterministic test fixture,
4. a QA case that recomputes the value from raw events.

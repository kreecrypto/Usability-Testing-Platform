# Task 14 — High-fidelity UI + accessibility-state QA

Status: high-fidelity review artifact complete; production runtime/browser conformance remains in dedicated engineering/QA tasks.

## Review route

Run the app and open:

```text
/high-fi
```

The route provides:

- all researcher screens `S01–S36`,
- all participant screens `P01–P12`,
- all 170 states from the Task 12 coverage contract,
- Desktop and Mobile review modes,
- screen/state selectors,
- component-family context from the Task 13 mapping.

## Visual baseline

The high-fidelity artifact uses the AXA Collab-Distrib-inspired UT Platform baseline defined in:

- `docs/design-system/baseline.md`
- `src/styles/tokens.css`
- `docs/design-system/accessibility-state-matrix.md`
- `docs/design-system/screen-component-map.json`

The artifact does not copy AXA wholesale. UT-specific analytics and research patterns remain Extend components.

## Required Task 14 states

The review implementation explicitly represents the screen-level combinations needed to inspect:

- Default / ready
- Loading / connecting / buffering / processing
- Empty / no data / no eligible data
- Error / invalid / validation / conflict
- Restricted / permission denied / redacted
- Unsupported provider / transform / evidence
- Warning / low sample / technical-blocked context
- Disabled CTA
- Focus-visible treatment
- Selected / active state
- Responsive desktop/mobile composition
- Reduced-motion behavior

## Accessibility implementation signals

The review CSS includes:

- visible `:focus-visible` treatment using design-system tokens,
- keyboard-operable native buttons, links, selects, inputs, radios and checkbox controls,
- radio-group semantics for SEQ,
- explicit labels and text for analytics legends/statuses,
- technical-blocked semantics distinct from usability failure,
- non-color status text,
- disabled action styling,
- reduced-motion override,
- mobile-first participant hierarchy.

This is an artifact-level implementation gate. It is **not** a claim that Task 56 cross-browser / assistive-technology QA has already run.

## Analytics state handling

- Funnel exposes stage labels/counts.
- Path Analysis exposes ordered node labels and a textual expected/actual summary.
- Heatmap includes a legend and sample context; unsupported transform states suppress misleading visual evidence.
- Session Timeline is also an ordered event list.
- Retest Comparison exposes baseline/retest values, unit-aware deltas and both cohort contexts.
- Unknown or ineligible values use unavailable/empty states rather than fabricated zero values.

## Participant safeguards

- Researcher success criteria / expected path are never shown in participant screens.
- Consent precedes behavioral study flow.
- Give-up is explicit and cancelable.
- Technical blocked is framed as an operational problem, not participant failure.
- Timeout and recovery keep the original task/session context visible.
- Post-task SEQ states show scale direction in text.

## Automated artifact QA

```bash
npm run check:design-system
npm run check:high-fi
```

`check:high-fi` verifies:

- 48 unique screen IDs,
- 170 states,
- S01–S36 / P01–P12 coverage,
- researcher and participant renderers,
- Desktop/Mobile review controls,
- semantic token usage signals,
- focus, disabled, loading, empty, error, restricted and reduced-motion CSS signals,
- the explicit boundary that this is not production data/integration.

## Release-gate decision

Task 14 design artifact can pass when the high-fi route, responsive styling, screen/state map and automated artifact QA remain together in the same change set.

Separate gates remain responsible for:

- runtime/dependency pinning and production build verification — GWD-11,
- Figma provider/OAuth behavior — Tasks 15–19 and GWD tasks,
- real data/auth/tracking/analytics implementation — later engineering tasks,
- cross-browser/device QA — Task 56,
- privacy/security QA — Task 57,
- production launch — Task 60.

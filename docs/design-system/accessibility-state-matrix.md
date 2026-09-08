# DS-09 — Accessibility State Matrix

Status: V1 release-gate specification  
Target: keyboard-operable, visible-focus, responsive UI with explicit state communication. This document defines product requirements; it is not a claim that the production app has already passed accessibility conformance testing.

## Global interaction requirements

- Every keyboard-interactive control exposes a visible focus indicator.
- UT baseline focus ring: `2px` brand outline + `2px` offset, matching the evidenced AXA Button/Card focus treatment.
- DOM/tab order follows visual reading order.
- Disabled and read-only are distinct states.
- Hover never contains information that cannot also be reached by keyboard/touch.
- Error messages identify what failed and how to recover.
- Field errors remain associated with their field and a page/section summary is used for multi-field blocking validation.
- Status is never communicated by color alone.
- Reduced-motion preference suppresses non-essential transitions.
- Touch targets should meet the platform minimum token (`--ut-touch-target-min`) unless the native control itself provides a larger hit target.
- Loading updates must not unexpectedly steal keyboard focus.
- Content that becomes unavailable through privacy deletion/redaction is labeled explicitly instead of disappearing without explanation.

## Component matrix

Legend: **R** required, **A** as applicable, `—` not a meaningful state for that component.

| Component | Default | Hover | Focus | Active | Selected / Checked | Filled | Loading | Disabled | Read-only | Error | Restricted | Keyboard rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary Button | R | R | R | R | — | — | A | R | — | — | A | Enter/Space activates |
| Secondary Button | R | R | R | R | — | — | A | R | — | — | A | Enter/Space activates |
| Danger Button | R | R | R | R | — | — | A | R | — | — | A | Enter/Space; confirmation for material loss |
| Icon Button | R | R | R | R | A | — | A | R | — | — | A | Accessible name required; Enter/Space |
| Text Input | R | A | R | — | — | R | A | R | R | R | A | Tab enters; normal text editing |
| Textarea | R | A | R | — | — | R | A | R | R | R | A | Tab enters; multiline editing |
| Select | R | A | R | A | R | R | A | R | R | R | A | Native/combobox keyboard model |
| MultiSelect | R | A | R | A | R | R | A | R | R | R | A | Arrow/selection behavior documented in component |
| Checkbox | R | A | R | R | R | — | — | R | — | A | A | Space toggles |
| Radio Group | R | A | R | R | R | — | — | R | — | R | A | Arrow navigation within group |
| Search Field | R | A | R | — | — | R | R | R | R | R | A | Search results remain keyboard reachable |
| SEQ Scale | R | A | R | R | R | — | — | A | — | R | — | Radio-group semantics; arrows/Tab |
| Tabs | R | R | R | A | R | — | A | A | — | — | A | Arrow keys within tablist; active panel relationship |
| Sidebar Nav Item | R | R | R | R | R | — | — | A | — | — | R | Link/button semantics; current page exposed |
| Breadcrumb Link | R | R | R | R | A | — | — | A | — | — | — | Ordered navigation landmark |
| Step / Vertical Step | R | A | R | A | R | — | A | A | — | R | A | Current/completed/blocked state text exposed |
| Card Link/Action | R | R | R | R | A | — | A | R | — | A | A | Entire actionable region reachable once, no nested conflicts |
| Metric Card | R | A | A | — | A | — | R | — | — | A | R | Value + label + sample/context readable as text |
| Table | R | A | A | — | A | — | R | — | — | A | R | Header/cell associations; sort state announced |
| Tag / Badge | R | — | — | — | A | — | — | — | — | — | A | Text label always present; not a control unless interactive variant |
| Tooltip / Popover | R | A | R | — | — | — | — | — | — | — | A | Trigger keyboard reachable; Esc dismisses non-modal popup |
| Modal | R | — | R | — | — | — | A | — | — | A | A | Focus enters modal, is trapped appropriately, Esc/close, focus returns |
| Toast | R | — | A | — | — | — | A | — | — | A | A | Not sole carrier of critical error; live announcement if appropriate |
| Message / Alert | R | — | A | — | — | — | A | — | — | R | R | Message type represented by text/icon, not color alone |
| Validation Summary | R | — | R | — | — | — | A | — | — | R | A | Links/focus moves to affected fields where implemented |
| Pagination | R | R | R | R | R | — | A | R | — | — | A | Previous/next and page controls named |
| Empty State | R | — | A | — | — | — | — | — | — | — | A | CTA keyboard reachable if present |
| Loader / Skeleton | R | — | — | — | — | — | R | — | — | — | — | Preserve layout; loading text/state exposed as needed |
| Funnel | R | A | A | A | A | — | R | — | — | A | R | Stage label/count available without relying on geometry/color |
| Path Analysis | R | A | A | A | A | — | R | — | — | A | R | Ordered path has text/list equivalent or accessible detail view |
| Heatmap | R | A | A | A | A | — | R | — | — | A | R | Text hotspot summary required; unsupported transform suppresses overlay |
| Session Timeline | R | A | A | A | A | — | R | — | — | A | R | Ordered event list readable without visual timeline |
| Finding Severity | R | A | A | A | R | — | — | A | A | R | A | Severity label text required |

## Focus-state rules

### Standard controls

```css
:focus-visible {
  outline: var(--ut-focus-ring-width) solid var(--ut-color-focus-ring);
  outline-offset: var(--ut-focus-ring-offset);
}
```

Do not use `outline: none` unless the same state receives an equal or stronger visible replacement.

### Focus vs selected

Focus = current keyboard interaction location.  
Selected = persistent product state.

Examples:

- A selected sidebar item can be selected while focus is elsewhere.
- A selected radio option still receives a focus ring when keyboard focus lands on it.
- A selected heatmap filter cannot rely on the focus ring as its only selected treatment.

## Form validation states

### Inline error

Must include:

1. error styling token,
2. text explaining the issue,
3. programmatic association between field and message,
4. recovery once corrected.

### Blocking summary

Use for Builder/Publish screens when multiple errors prevent progression. Summary items identify the affected section/field and support navigation to the issue where feasible.

### Disabled CTA

A disabled CTA does not replace validation messaging. If the user cannot infer why `Publish`, `Continue`, or `Create` is disabled, the blocking reason must be visible nearby.

## Loading states

### Action loading

- Preserve button width where practical.
- Prevent duplicate submission.
- Keep the action label or accessible loading name meaningful.
- Do not move focus automatically on every polling update.

### Page/data loading

- Skeletons approximate final structure rather than arbitrary blocks.
- If data fails, transition to an explicit recoverable error state.
- Analytics must never briefly display `0` as a placeholder for unknown data.

## Empty / error / restricted / unavailable states

These are distinct:

- **Empty:** valid request, no records/content.
- **No search results:** dataset exists, current filter/search returns none.
- **Error:** request or operation failed.
- **Restricted:** data/action exists but current role lacks access.
- **Deleted/Redacted:** evidence was intentionally removed or hidden by privacy rules.
- **Unsupported:** provider/capability cannot produce the evidence safely.
- **No eligible data:** events may exist but denominator is zero after eligibility rules.

Each state uses explicit heading/copy and an appropriate next action, if one exists.

## Analytics accessibility rules

- Chart title and purpose are available as text.
- Legend labels remain visible and understandable without color.
- Important values have a textual alternative or detail table/list.
- Hover details are also keyboard/touch reachable where interaction is required.
- Technical-blocked counts are separately labeled from usability failures.
- Low-sample or partial-data warnings remain adjacent to the affected metric/chart.
- Filtering state is visible outside the chart marks themselves.

## Participant runner rules

- Mobile-first reading order: progress → scenario → prototype → necessary task actions.
- Participant never receives researcher-only success criteria/expected path.
- Give-up confirmation exposes both confirm and cancel paths clearly.
- Technical blocked state explains operational recovery and is not framed as participant failure.
- Post-task SEQ uses a real single-choice group; scale direction is written in text.
- Recovery/resume confirms which task/session context is being restored.

## Release-gate checklist

- [x] Matrix defines required component states.
- [x] Focus-visible treatment is explicit.
- [x] Keyboard behavior is defined for core controls/navigation.
- [x] Color-only communication is prohibited.
- [x] Loading/error/empty/restricted/unsupported semantics are separated.
- [x] Analytics require non-visual/text equivalents for essential interpretation.
- [x] Participant-specific accessibility behavior is defined.
- [ ] Production components tested in browser/assistive technology — Task 14/56 implementation QA, not claimed by this spec.

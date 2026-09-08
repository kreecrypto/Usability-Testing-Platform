# Task 13 — V1 Design System Baseline

Status: implementation-ready baseline for DS-02 through DS-08  
Primary reference: AXA France Design System — Collab-Distrib / Distributeur  
Pinned AXA source: `cfd646c12507b2f176489dd31a5d831a3e3c848b` (2026-09-07)  
Parent task: Task 13 — Create Design System Baseline

## Purpose

This baseline turns the Task 12 low-fidelity inventory into a stable visual and interaction system before high-fidelity UI work begins. AXA Collab-Distrib is the primary reference because AXA explicitly positions that universe for B2B/internal applications.

The baseline uses three decision labels:

- **Adopt** — keep the AXA component purpose and interaction model.
- **Adapt** — keep the AXA pattern but change density, composition, responsive behavior, or UT-specific semantics.
- **Extend** — create a UT-specific pattern because no equivalent AXA component is evidenced in the pinned source.

The product must consume semantic `--ut-*` tokens from `src/styles/tokens.css`. High-fidelity screens must not introduce ad-hoc color, type, spacing, radius, elevation, or status semantics.

## Evidence

- AXA repository: https://github.com/AxaFrance/design-system
- AXA README / universes: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/README.md
- AXA Distributeur exports: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-react/src/distributeur.ts
- AXA Distributeur tokens: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/common/tokens.css
- AXA reset / body typography: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/common/reboot.css
- AXA Button: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/Button/Button.css
- AXA Card: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/Card/Card.css
- AXA Title: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/Title/Title.css
- AXA Storybook: https://axafrance.github.io/design-system/distributeur/react/latest/
- AXA Figma reference linked by repository: https://www.figma.com/design/reZserxMfytQ9M82bt20Bi/DS-Slash-V3
- UT V1 screen inventory: `docs/screen-inventory.md`

---

# DS-02 — Foundation Color & Semantic Tokens

## Token architecture

Use three layers only:

1. **Primitive** — raw palette values retained from the pinned AXA source where evidenced.
2. **Semantic** — product meaning such as text, surface, action, success, technical-blocked.
3. **Component-local** — component implementation variables that reference semantic tokens, never raw hex values.

Example:

```css
--ut-primitive-blue-80: #00008f;
--ut-color-brand: var(--ut-primitive-blue-80);
--button-background: var(--ut-color-action-primary-bg);
```

## Brand and neutral mapping

| UT token | Source / decision | V1 use |
| --- | --- | --- |
| `--ut-color-brand` | Adopt AXA `--axablue80` | Primary actions, active navigation, link emphasis |
| `--ut-color-brand-hover` | Adopt AXA `--axablue100` | Hover state |
| `--ut-color-brand-active` | Adopt AXA `--axablue90` | Pressed/active state |
| `--ut-color-bg-page` | Adopt AXA gray background behavior | Application canvas |
| `--ut-color-bg-surface` | Adopt white | Cards, panels, modals |
| `--ut-color-text-primary` | Adopt AXA `--gray80` | Primary copy |
| `--ut-color-text-secondary` | Adapt `--gray60` | Secondary metadata |
| `--ut-color-border-default` | Adopt `--gray40` | Default separators and controls |

## Status semantics

AXA provides green, red, orange and cyan/blue families. UT Platform adds explicit semantic names so visual meaning stays stable across Results, Sessions, Findings and operational states.

| Meaning | Token | Rule |
| --- | --- | --- |
| Success | `--ut-color-success` | Successful action or task outcome |
| Warning | `--ut-color-warning` | Non-blocking caution, low sample, give-up context |
| Error | `--ut-color-error` | Validation error or usability failure |
| Info | `--ut-color-info` | Neutral operational information |
| Technical blocked | `--ut-color-outcome-technical` | Must not use failure semantics |
| Abandoned | `--ut-color-outcome-abandoned` | Neutral, not error red |
| Timeout | `--ut-color-outcome-timeout` | Distinct from failure and technical block |

### Do

- Pair status color with a text label and, where useful, icon or shape.
- Keep `technical_blocked` visually distinct from `failed`.
- Show unavailable metrics as `—`, not a gray `0%`.
- Use the same semantic token for the same meaning across Dashboard, Task Detail and Session Detail.

### Don't

- Do not use red for every negative-looking state.
- Do not encode task outcome with color alone.
- Do not use chart palette colors as semantic success/failure colors unless the series itself represents that meaning.
- Do not place raw AXA primitive names directly into feature code.

## Data visualization palette

`src/styles/tokens.css` defines six categorical data colors plus a neutral series and a sequential heatmap scale.

Rules:

- Always provide a legend or direct label.
- Preserve series identity across hover, detail drawer and exported view.
- Use texture, marker, line style, explicit label or symbol when series need to remain distinguishable without color.
- Heatmap intensity represents density only; it must not imply severity.
- Unsupported coordinate transforms render an explicit unsupported state instead of a misleading heatmap.

---

# DS-03 — Typography Scale & Content Hierarchy

## Font family

AXA Distributeur loads `Source Sans Pro` and uses it for body and controls. UT Platform adopts it as the Latin UI baseline:

```css
font-family: "Source Sans Pro", "Source Sans 3", Arial, sans-serif;
```

If a future locale requires glyphs not covered by this stack, locale-specific fallback must be added intentionally rather than replacing the global family ad hoc.

## Base behavior

AXA reset evidence:

- body `1rem`
- body weight `400`
- body line-height `1.5`
- Button `1rem / 1.25rem`, weight `700`
- Title h2 `1.5rem`, h3 `1.25rem`, h4 `1.125rem`, weight `600`

UT V1 keeps those proportions but adds explicit semantic roles.

| Role | Size | Weight | Line height | Use |
| --- | ---: | ---: | ---: | --- |
| Caption | 12px | 400/600 | 1.33 | metadata, timestamps, chart footnotes |
| Label | 14px | 600 | 1.43 | form labels, compact filters, table metadata |
| Body | 16px | 400 | 1.5 | standard content |
| Body strong | 16px | 600 | 1.5 | emphasized content |
| Title small | 18px | 600 | 1.3 | card/panel headings |
| Title medium | 20px | 600 | 1.3 | subsection headings |
| Title large | 24px | 600 | 1.3 | major section headings |
| Page title | 28px | 600 | 1.3 | screen title |
| Metric | 32px | 600/700 | 1.25 | headline analytics value |

## Hierarchy rules

- One page title per screen content region.
- Panel headings follow DOM heading order; visual size must not be used to fake hierarchy.
- Metric values always have a nearby metric label and sample/context when relevant.
- Validation, status and helper copy do not compete with the field label.
- Table headers use label sizing/weight, not page-heading styles.
- Participant instructions prioritize scenario copy and task progress over platform navigation.

---

# DS-04 — Spacing, Grid, Radius & Elevation

## Spacing

UT uses a 4px base scale defined in `tokens.css`:

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

Rules:

- Use 4–8px for icon/label internal gaps.
- Use 12–16px for compact control groups.
- Use 16–24px for card/panel internal padding.
- Use 24–32px between screen sections.
- Use 32–48px only for major page-group separation.
- Do not add arbitrary 18px, 22px, 30px spacing values to feature CSS.

## Responsive breakpoints

AXA Distributeur evidences these custom-media thresholds:

- 576px tablet portrait
- 772px tablet landscape
- 1016px desktop small
- 1272px desktop medium
- 1432px desktop large

UT V1 adopts those thresholds and groups behavior into:

- **Mobile:** `<576px`
- **Tablet:** `576–1015px`
- **Desktop:** `>=1016px`

The detailed AXA thresholds remain available for dense analytics/table behavior when required.

## Researcher app layout

### Desktop

- Persistent left app navigation: 240px tokenized width.
- Top application header: 64px.
- Main content uses responsive gutters and max width token.
- Builder screens can use a split layout: structure rail / editor / validation context, but each region must remain keyboard reachable.
- Analytics tables may scroll inside their own container; the whole page must not create accidental horizontal overflow.

### Tablet

- Sidebar collapses to compact/overlay navigation.
- Primary content remains single reading order.
- Secondary contextual panels may move below the main panel.

### Mobile

- No persistent 240px sidebar.
- One primary content column.
- Sticky actions are allowed only when they do not obscure validation or system messages.
- Tables convert to responsive rows/cards or use intentional internal horizontal scroll with a visible affordance.

## Participant runner layout

Participant flow is mobile-first:

- Task scenario and progress are primary.
- Platform chrome is minimal.
- Prototype canvas gets the maximum available viewport area.
- Give-up and recovery actions must remain accessible without competing visually with the task scenario.

## Radius

AXA Card evidences a 4px radius while AXA Button is square. UT uses:

- `0` for AXA-style square action patterns where appropriate.
- `4px` as the primary evidenced surface radius.
- `8px` and `12px` only for UT Adapt/Extend containers where separation improves comprehension.
- pill radius only for compact tags/chips, never general cards.

## Elevation

AXA Card evidences a subtle `0 0 0.5625rem rgb(0 0 0 / 18%)` shadow. UT uses:

- no shadow for flat tables and grouped form sections,
- card shadow for raised cards,
- stronger popover/modal shadows only for true overlay layers.

Elevation must represent layer, not decoration.

---

# DS-05 — Form, Action & Feedback Components

## AXA component evidence

Distributeur exports include:

- Checkbox
- Choice
- Date
- File
- MultiSelect
- NestedQuestion
- Number
- Password
- Radio
- Select
- Slider
- Text
- Textarea
- Field / FieldError / HelpMessage
- Button
- Message
- Modal
- Loader

## V1 form inventory

| UT component | Decision | Required states |
| --- | --- | --- |
| TextInput | Adopt/Adapt | default, hover, focus, filled, disabled, error, read-only |
| Textarea | Adopt/Adapt | default, focus, filled, disabled, error |
| Select | Adopt/Adapt | closed, open, selected, focus, disabled, error, loading |
| MultiSelect | Adopt/Adapt | empty, selected, open, focus, disabled, error |
| Checkbox | Adopt | unchecked, checked, focus, disabled, error where grouped |
| Radio | Adopt | unchecked, checked, focus, disabled, error where grouped |
| SearchField | Adapt | empty, typing, results, no results, loading, error |
| NumberInput | Adopt | default, focus, filled, disabled, error |
| FieldMessage | Adopt | help, error, warning, success |
| QuestionScale/SEQ | Adapt | unselected, selected, focus, validation |

## Action inventory

AXA Button evidences primary, secondary, validated, danger, small, ghost and disabled behavior including a `2px` focus-visible outline with `2px` offset.

UT V1:

- Primary
- Secondary
- Tertiary/Ghost
- Danger
- Icon button
- Split/overflow action only where actions exceed the clear primary/secondary hierarchy

Rules:

- Exactly one dominant primary action per action group.
- Disabled action must have an explanation when the cause is not obvious.
- Destructive action requires explicit confirmation when loss is material.
- `Publish`, `Delete data`, `Close test` and similar lifecycle operations must reflect their gate state, not rely only on disabled styling.

## Feedback inventory

| Pattern | Decision | Use |
| --- | --- | --- |
| Inline validation | Adopt | field-level correction |
| Validation summary | Extend | builder/publish blocking errors |
| Message/Alert | Adopt | persistent system or contextual feedback |
| Toast | Adapt | brief confirmation; never the only place for critical errors |
| Empty state | Extend composition | first-use / no-results / no-data |
| Loading/Skeleton | Extend composition | content pending without layout jump |
| Error state | Extend composition | recoverable page or data-load failure |
| Technical-blocked warning | Extend | operational state, not usability failure |
| Restricted/Redacted | Extend | privacy/permissions |

---

# DS-06 — Navigation & Responsive App Shell

## AXA component evidence

Distributeur exports `Header`, `NavBar`, `NavBarItem`, `Tabs`, `Steps`, `VerticalStep`, `MainContainer`, `Link` and `Footer`.

## Researcher shell

### Primary navigation

V1 items follow the locked IA:

- Home
- Projects
- Results
- Participants
- Settings

Rules:

- Current section is identified with semantic selected state, not color alone.
- Keyboard order follows visual reading order.
- Collapsed navigation preserves accessible names for icon-only controls.
- Product Viewer and restricted roles do not see misleading enabled edit actions.

### Context navigation

Within a Project/Test:

- Project Overview
- Tests
- Build / Preview / Share / Results as state-dependent actions or tabs
- Results: Overview / Tasks / Paths / Heatmaps / Sessions / Findings

Tabs are for sibling views. Steps are for ordered creation/publish workflows. They must not be substituted for one another.

### Breadcrumb

No dedicated breadcrumb export was confirmed in the pinned Distributeur entry point. UT therefore treats Breadcrumb as **Extend**, built from semantic links/list structure and UT tokens.

Use when hierarchy depth exceeds what the page title and tabs communicate clearly. Do not show it in the public participant runner.

## Builder navigation

Task Builder requires a clear model of:

1. Prototype
2. Tasks
3. Success rules
4. Questions
5. Validation
6. Preview
7. Publish

The exact layout may use a vertical step/navigation rail on desktop and a compact step selector on mobile/tablet. Progress must be based on configuration state, not merely the current route.

## Participant navigation

Participant UI has no researcher app navigation. It exposes only:

- study/task progress,
- task content,
- necessary escape/give-up/recovery controls,
- feedback progression,
- complete state.

Success targets and expected paths are never exposed to participants.

---

# DS-07 — Data Display Components

## AXA component evidence

Distributeur exports `Card`, `CardData`, `Table`, `Tag/Badge`, `Popover`, `Summary`, `Restitution`, `Timeline`, `Loader`, `Message`.

## V1 inventory

| Component | Decision | Required UT behavior |
| --- | --- | --- |
| Card | Adopt/Adapt | neutral/interactive/selected/disabled/error |
| MetricCard | Adapt from CardData | value, label, sample/context, delta, unavailable |
| Table | Adopt/Adapt | sort/filter context, loading, empty, restricted, responsive |
| Tag | Adopt | status, role, filter state; never color-only |
| Tooltip/Popover | Adopt/Adapt | supplemental explanation; keyboard dismissible |
| Pagination | Extend if not supplied by product shell | current page, disabled bounds, result count |
| Summary | Adapt | validation/results summary blocks |
| Timeline | Adapt | session event chronology |
| EvidenceCard | Extend | event/frame/session evidence + privacy state |
| FindingCard | Extend | severity, status, evidence count, retest state |

## Metric display rules

Every headline metric must answer:

- What is measured?
- Which published test version?
- What eligible sample is used?
- Is the value complete, partial, low confidence, unavailable or technically blocked?

Examples:

- Completion Rate: show successful / eligible denominator context.
- Time on Task: state successful-task basis when using the canonical metric definition.
- SEQ: show scale direction and sample count.
- Retest delta: show both cohorts and use percentage points where the source metric is a percentage.

`0` and `—` are not interchangeable.

## Table rules

- Headers remain associated with cells semantically.
- Sort is exposed in text/ARIA state and icon, not icon alone.
- Empty search results differ from empty dataset.
- Restricted rows explain the permission boundary.
- Deleted evidence does not leave a fake retained snapshot.

---

# DS-08 — Analytics Visualization Extensions

AXA provides general display building blocks but the following research/analytics patterns are UT-specific and are therefore **Extend**.

## Funnel

Purpose: show stage conversion/drop-off through a test/task flow.

Required states:

- ready
- partial data
- no data
- low sample
- filter applied
- technical-blocked context

Rules:

- Denominator must be explicit.
- Technical blocks remain separately visible and excluded where defined by the analytics contract.
- Stages use labels and counts, not width/color alone.

## Path Analysis

Purpose: compare ordered actual navigation with expected/reference path evidence.

Required states:

- expected vs actual
- no path data
- unsupported provider/evidence
- filtered cohort

Rules:

- Ordered nodes come from canonical screen/frame evidence.
- Never invent browser-back events when the provider does not expose evidence.
- Detour/backtrack annotations reference derived evidence/rule version where applicable.

## Heatmap

Purpose: aggregate click/tap coordinates within a canonical frame coordinate system.

Required states:

- ready
- no clicks
- unsupported transform/provider
- filtered
- low sample

Rules:

- Do not render clusters when coordinate normalization is unsupported.
- Include click count / participant/session sample context.
- Sequential heatmap color communicates density only.
- Provide accessible textual summaries for key hotspots; do not make a raster overlay the only interpretation.

## Session Timeline

AXA provides a Timeline component that can be adapted structurally. UT extends its event semantics.

Rows can include:

- task lifecycle
- screen/frame views
- pointer interaction summaries
- answers
- derived evidence annotations
- technical blocks
- privacy redaction/deletion states

Ordering follows the canonical event contract: sequence first for raw session order, with occurredAt/receivedAt retained for diagnostics as specified elsewhere in the project.

## Retest Comparison

Required states:

- no baseline
- ready
- low sample
- technical context
- incompatible configuration/version context

Each comparison shows:

- baseline version/cohort
- retest version/cohort
- metric value for each
- delta with unit
- sample size
- technical-blocked count/context

Do not imply statistical significance unless a separate approved method has actually been implemented.

## Finding Severity

Finding severity is a research interpretation, not the same as event/task outcome.

Recommended V1 model:

- Critical
- High
- Medium
- Low

Severity UI must include the text label. Avoid using the same raw red/orange/green status treatment used for task outcome without additional distinguishing structure.

---

# Cross-component State Contract

All interactive components implement only the states that make semantic sense, selected from:

- Default
- Hover
- Focus Visible
- Active/Pressed
- Selected/Checked
- Filled
- Loading
- Disabled
- Read-only
- Error
- Warning
- Success
- Restricted

Rules:

- Focus Visible is never removed without a replacement.
- Disabled and read-only are distinct.
- Loading actions preserve context and prevent duplicate submission when required.
- Validation recovery must be possible after correcting the input.
- Hover is never the only discoverability mechanism.
- Reduced-motion preference suppresses non-essential transitions.

Detailed per-component coverage is in `docs/design-system/accessibility-state-matrix.md`.

---

# Naming Convention

## CSS tokens

```text
--ut-{category}-{role}-{state?}
```

Examples:

- `--ut-color-text-primary`
- `--ut-color-action-primary-bg-hover`
- `--ut-color-outcome-technical`
- `--ut-space-6`
- `--ut-radius-sm`

## React components

PascalCase semantic product names:

- `MetricCard`
- `ValidationSummary`
- `TechnicalBlockedNotice`
- `HeatmapLegend`
- `SessionTimeline`
- `FindingSeverity`

Wrapper components may encapsulate AXA Canopee components, but feature code should import UT Platform components once wrappers exist. This keeps AXA upgrades and UT semantics separated.

## Variants

Use meaning, not color:

Good: `variant="danger"`, `outcome="technical_blocked"`  
Bad: `variant="red"`, `status="blue"`

---

# Design System Release Rules

Before Task 14 high-fidelity UI can pass:

1. Every V1 screen maps to design-system component families.
2. Every Task 12 state maps to a visual/interaction state or an explicit composition state.
3. No feature CSS introduces raw colors where semantic tokens exist.
4. Focus-visible state is defined for all keyboard-interactive controls.
5. Loading, empty, error, restricted, technical-blocked and evidence-deleted states are represented where required by the screen inventory.
6. Analytics components show sample/version context and unsupported states instead of fabricated values.
7. Participant screens remain mobile-first and do not expose researcher-only success targets.

The machine-auditable screen/state mapping is maintained in `docs/design-system/screen-component-map.json` and verified by `scripts/check-design-system.mjs`.

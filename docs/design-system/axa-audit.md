# DS-01 — AXA France Design System audit

Status: Complete audit input for Task 13 / DS-02–DS-10  
Audit date: 2026-09-08  
AXA source commit: `cfd646c12507b2f176489dd31a5d831a3e3c848b` (2026-09-07)  
Primary source: https://github.com/AxaFrance/design-system

## Decision

Use **AXA France Design System — Collab-Distrib / Distributeur** as the primary reference for the Usability Testing Platform design-system baseline because AXA explicitly positions that universe for **B2B/internal applications**.

Do not copy the design system wholesale. Apply a three-way mapping:

- **Adopt** — patterns/components that fit the UT Platform without changing their behavioral purpose.
- **Adapt** — AXA patterns that are structurally useful but need UT-specific layout, density, responsive behavior, or semantics.
- **Extend** — UT-specific research/analytics patterns that are not provided as equivalent AXA components.

This audit is evidence-first. Token values and component availability below are limited to what is present in the pinned AXA repository source.

## Evidence map

- AXA README / universe definition and package usage: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/README.md
- Distributeur React exports: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-react/src/distributeur.ts
- Distributeur CSS tokens: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/common/tokens.css
- Distributeur CSS bundle: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/packages/canopee-css/src/distributeur/distributeur.css
- MIT license: https://github.com/AxaFrance/design-system/blob/cfd646c12507b2f176489dd31a5d831a3e3c848b/LICENSE
- AXA Storybook (Distributeur/latest): https://axafrance.github.io/design-system/distributeur/react/latest/
- AXA Figma reference linked by the repository: https://www.figma.com/design/reZserxMfytQ9M82bt20Bi/DS-Slash-V3

## Package and universe structure

AXA exposes two implementation layers for every universe:

- `@axa-fr/canopee-react`
- `@axa-fr/canopee-css`

The repository documents three universes:

| Universe | AXA positioning | UT Platform decision |
| --- | --- | --- |
| Prospect | B2C, prospect-facing | Not primary |
| Client | B2C, existing-customer-facing | Not primary |
| Collab-Distrib / Distributeur | B2B, internal applications | **Primary reference** |

For Collab-Distrib the current package entry points are:

```ts
import { Button } from '@axa-fr/canopee-react/distributeur';
```

and CSS can be loaded from the `distributeur` path, including the common token layer.

The repository states that older Slash mirror packages are being removed in favor of the Canopee `distributeur` entry point. New UT Platform work should therefore reference the current Canopee paths rather than legacy Slash package names.

## Foundation audit

### Confirmed primitives

The pinned `tokens.css` contains these primitive groups:

- AXA blue scale: `--axablue10` through `--axablue100`
- neutral gray scale: `--gray10` through `--gray80`
- green, red and orange status families
- additional cyan and tariff-oriented palettes
- `--black`, `--white`, `--azur`

Examples that can seed DS-02 mapping, but should not yet be renamed as UT semantic tokens:

- `--axablue80: #00008F`
- `--gray80: #333333`
- `--green30: #0C7D3B`
- `--red30: #C7102E`
- `--orange40: #BC4C2D`

### Confirmed AXA semantic tokens

The same source includes semantic aliases such as:

- `--text-color`
- `--disabled-color`
- `--error-color`
- `--input-border-color`
- `--brand-primary`
- `--warning-color`
- `--help-color`
- `--valid-element-color`
- `--inactive-button-background`
- `--inactive-button-border-color`
- `--active-button-border-color`
- `--button-primary-default`
- border aliases for default / hover / selected

**DS-02 rule:** preserve the distinction between primitive and semantic layers. Do not bind analytics meanings directly to primitive AXA colors.

### Typography evidence

The Distributeur React entry imports Source Sans Pro weights:

- 400
- 600
- 700

The CSS token source defines `--font-size-base: 16`.

**DS-03 rule:** treat these as reference evidence only. The UT type scale still needs explicit role mapping for page titles, section titles, body, labels, helper text, tables and analytics metrics.

### Responsive evidence

The AXA token source defines custom-media breakpoints at:

- 0 px
- 576 px
- 772 px
- 1016 px
- 1272 px
- 1432 px

**DS-04 rule:** adapt the breakpoint strategy to the existing researcher/participant wireframes instead of assuming every AXA breakpoint must be adopted unchanged.

## Confirmed Collab-Distrib component families

The current Distributeur React export surface confirms the following families.

### Adopt candidates

These have a close semantic match to UT Platform needs and should be inspected first for direct reuse/reference:

- Button
- Link
- Divider
- Accordion
- Tag (`Badge` exists only as a deprecated alias)
- Message (`Alert` exists only as a deprecated alias)
- Loader / ItemLoader / SquareLoader
- Modal
- Tabs
- Table
- Card
- CardData
- Title
- Popover

### Form candidates

Confirmed exports include:

- Checkbox
- Choice
- Date
- File
- MultiSelect
- NestedQuestion
- Number
- Password (`Pass`)
- Radio
- Select
- Slider
- Text
- Textarea
- shared field/error/help/form primitives

These are the primary input for DS-05.

### Navigation/layout candidates

Confirmed exports include:

- Header
- NavBar and NavBarItem variants
- MainContainer
- Footer
- Steps / Step / VerticalStep
- Tabs

These are the primary input for DS-06.

### Feedback/data-display candidates

Confirmed exports include:

- Message
- EditorialMessage
- Tag
- Card / CardData
- Table
- Loader variants
- Summary
- Restitution family
- Timeline

These are the primary input for DS-07 and DS-08.

## Adopt / Adapt / Extend draft

| UT Platform need | AXA evidence | Decision | Reason |
| --- | --- | --- | --- |
| Buttons / icon actions | Button, Action | Adopt/Adapt | Same action semantics; UT states still need full matrix |
| Core form controls | Form exports | Adopt | Strong direct mapping |
| Inline feedback | Message, field messages | Adopt | Direct semantic fit |
| Loading | Loader variants | Adopt | Direct semantic fit |
| Tags/status chips | Tag | Adopt/Adapt | Use UT semantic status names, not arbitrary palette |
| Header/top nav | Header, NavBar | Adapt | Research app shell requires UT IA and responsive rules |
| Sidebar navigation | No equivalent confirmed in export audit | Extend | UT researcher IA depends on persistent workspace/project navigation |
| Breadcrumb | No dedicated component confirmed by repository code search | Extend/Adapt | Add only where hierarchy warrants it |
| Step flow | Steps / VerticalStep | Adopt/Adapt | Useful for builder/publish progression |
| Tables | Table | Adopt/Adapt | UT results require density, sorting and unavailable-data states |
| Metric cards | CardData | Adapt | UT metrics need denominator/version context |
| Modal dialogs | Modal | Adopt | Direct fit for confirmations/destructive actions |
| Timeline | Timeline | Adapt | Can inform session timeline visual language but UT evidence semantics differ |
| Heatmap | No Heatmap code match found | Extend | Domain-specific interaction visualization |
| Path analysis | No dedicated path-analysis component confirmed | Extend | Domain-specific sequence/network visualization |
| Funnel/drop-off | No dedicated funnel component confirmed | Extend | Domain-specific analytics visualization |
| Retest delta | No dedicated comparison component confirmed | Extend | Requires baseline/retest cohort semantics |
| Finding severity/evidence | No dedicated UX-finding component confirmed | Extend/Adapt | Can reuse Tag/Card/Table primitives but needs domain pattern |
| Session evidence panel | Card/Table/Timeline primitives | Adapt | Requires event/version/privacy context |

## What must not be inferred from AXA

The audit found no evidence that AXA defines UT-specific research semantics. Therefore the following must remain UT-owned even if AXA primitives are reused:

- success / fail / give-up / timeout / abandoned / technical-blocked outcome semantics
- usability denominator rules
- Figma prototype version context
- heatmap coordinate validity / unsupported states
- path and detour semantics
- session event evidence
- finding severity and evidence linking
- retest cohort comparison
- privacy-restricted/deleted evidence states

These are product/domain contracts, not visual design-system primitives.

## Accessibility direction

AXA components provide implementation reference, but DS-09 remains a separate UT gate. Every interactive UT component still needs an explicit matrix for the states relevant to it:

- Default
- Hover
- Focus-visible
- Active/pressed
- Selected
- Disabled
- Error/invalid
- Loading/busy

Do not mark accessibility complete merely because an AXA component exists.

## Licensing

The AXA France Design System repository is MIT licensed at the pinned source commit. If source code is copied or substantially incorporated, preserve the required copyright and license notice. The UT Platform may also choose to use AXA only as a design/reference baseline rather than copying implementation code.

## Inputs unlocked by this audit

### DS-02 — Foundation color & semantic tokens

Use the AXA primitive/semantic split as the starting model. Build UT semantic aliases for surface, text, border, action, feedback and analytics meanings.

### DS-03 — Typography

Start from the confirmed Source Sans Pro 400/600/700 evidence and explicitly define UT roles and responsive behavior.

### DS-04 — Spacing/grid/radius/elevation

Use AXA layout/breakpoint evidence as reference, then validate against the 48-screen wireframe inventory.

### DS-05 — Form/action/feedback

Start from confirmed Distributeur exports and map required UT variants/states.

### DS-06 — Navigation/app shell

Use Header/NavBar/Steps/Tabs as references; extend a UT sidebar/app shell where no direct AXA equivalent is confirmed.

### DS-07 — Data display

Use Table/Card/CardData/Tag/Message/Loader primitives and add analytics context requirements.

### DS-08 — Analytics visualization

Treat Timeline as an adaptable primitive. Heatmap, path, funnel, retest delta and research-specific evidence views remain UT extensions.

### DS-09 — Accessibility state matrix

Validate UT states independently; do not inherit compliance claims.

### DS-10 — Screen/state mapping

Map every selected component back to S01–S36 and P01–P12 and verify no ad-hoc visual rule survives into Task 14.

## DS-01 acceptance check

- [x] Package/token/component structure identified
- [x] Collab-Distrib / Distributeur confirmed as the B2B/internal reference
- [x] Foundation, Form, Navigation, Data Display and Feedback patterns summarized
- [x] Missing UT-domain components identified without inventing AXA support
- [x] Adopt / Adapt / Extend draft produced
- [x] Evidence links pinned to a concrete AXA repository commit
- [x] Outputs explicitly routed into DS-02–DS-10

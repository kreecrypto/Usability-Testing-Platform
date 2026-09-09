# 4. Sidebar System

The sidebar keeps the calibrated shell geometry. In design-only output it follows the global Full Data Skeleton Privacy System in Section 5 and exposes no readable navigation or product content.

## Sidebar Geometry

```yaml
sidebar:
  width: 200px
  background: "{colors.canvas}"
  shadow: "{shadows.card}"

sidebar-header:
  height: 64px
  padding: 16px

sidebar-item-slot:
  height: 32px
  paddingRight: 12px
  iconGap: 10px

sidebar-group-stack:
  gap: 24px
```

## Sidebar Skeleton Privacy Mode — Mandatory for Mockups

```yaml
sidebar-content-policy:
  mockupMode: "skeleton-only"
  appliesWhen:
    - "UI is generated from this Design System alone"
    - "navigation data has not been explicitly provided and approved for display"
    - "demo, review, handoff, or prototype output must avoid product-data leakage"

  forbiddenInMockup:
    - "real navigation labels"
    - "real routes or URLs"
    - "menu keys or internal identifiers"
    - "real navigation hierarchy or item counts derived from product data"
    - "semantic navigation icons that reveal menu meaning"
    - "selected route, selected menu label, or active destination"

  allowedInMockup:
    - "neutral skeleton bars"
    - "neutral geometric icon placeholders"
    - "generic placeholder grouping used only to demonstrate spacing"

  runtimeBinding:
    rule: "Real navigation content may be injected only by the explicit runtime/product-data layer. It must not be inferred from this document."
```

## Sidebar Skeleton Anatomy

```yaml
sidebar-skeleton:
  headerPlaceholder:
    height: 20px
    width: 92px
    radius: 8px

  groupPlaceholder:
    title:
      height: 14px
      widthRange: "64px–96px"
      radius: 7px
    gapToItems: 8px

  itemPlaceholder:
    height: 32px
    icon:
      size: 18px
      radius: 4px
    label:
      height: 12px
      widthRange: "84px–124px"
      radius: 6px
    gap: 10px

  grouping:
    placeholderGroups: "2–3 generic groups"
    placeholderRowsPerGroup: "3–4 generic rows"
    rule: "Placeholder counts MUST be generic and MUST NOT mirror the actual navigation hierarchy or route count."

  visual:
    base: "{colors.surface-muted}"
    highlight: "{colors.hairline-soft}"
    animation: shimmer

  interaction:
    selectedState: disabled
    rowLinks: disabled
    semanticIcons: disabled

  accessibility:
    skeletonContent: "aria-hidden=true"
    containerLabel: "Navigation placeholder"
```

## Production Selected Item Style

The production runtime may use this state **only after explicit navigation data is bound**. It MUST NOT appear in skeleton-only mockups.

```yaml
sidebar-selected-production-only:
  background: "{colors.primary}"
  text: "{colors.on-primary}"
  radius: "0 1000px 1000px 0"
```

## Sidebar Constraints

- Desktop sidebar width = 200px.
- Desktop placeholder row slot = 32px.
- Group separation = 24px.
- Skeleton placeholders must never contain readable navigation text.
- Skeleton placeholders must never contain `href`, route strings, menu keys, or business/navigation identifiers.
- Do not infer a selected item in mockup mode.
- Do not use real menu icons in mockup mode; use neutral placeholder blocks.
- Sidebar content may scroll vertically when viewport height is constrained.
- Real navigation content is outside the scope of this Design System and must come from an explicitly supplied runtime data source.

-----

# 5. Full Data Skeleton Privacy System

This Design System defaults to **full data skeleton mode** for every design-only mockup, review artifact, prototype, or generated HTML/React output when explicit display-safe runtime content has not been supplied.

The goal is to preserve visual fidelity while ensuring the artifact and its source code do not reveal readable product, customer, navigation, role, workflow, or business data.

```yaml
full-data-skeleton-policy:
  defaultMode: skeleton-only
  dataSafeByDefault: true
  contentSource: none

  appliesTo:
    - sidebar navigation
    - page title and subtitle
    - breadcrumbs and context chips
    - card and section titles
    - KPI labels and values
    - table toolbar title
    - table tabs
    - table header labels
    - table body values
    - badges and statuses
    - form labels, values, helper text, and validation copy
    - chart legends, labels, values, and annotations
    - button text and action labels
    - search placeholder text
    - pagination labels or counts
    - role names and permission labels
    - customer, product, policy, application, campaign, financial, date, phone, and identifier data

  forbiddenInSkeletonMode:
    - readable business or product copy
    - mock names or realistic personal data
    - real or invented financial values
    - dates, phone numbers, emails, IDs, policy/application numbers
    - navigation labels, routes, hrefs, menu keys, or selected destinations
    - semantic column names or field names
    - semantic status labels or badge text
    - role names, team names, permission labels, or visibility rules
    - hidden content that exposes the above through comments, data attributes, IDs, class names, aria-labels, titles, or script constants
    - semantic icons whose glyph/name reveals protected content when a neutral placeholder can communicate geometry

  allowedInSkeletonMode:
    - neutral skeleton bars and blocks
    - neutral geometric icon placeholders
    - generic width variants such as short/medium/wide
    - geometry-only component names such as column-1, card-a, control-a
    - generic accessibility text such as "Loading interface" or "Placeholder control"

  runtimeBinding:
    rule: "Readable content may be injected only from an explicitly supplied display-safe runtime/product-data source. Never infer content from page geometry or from this document."
```

## 5.1 Skeleton Visual Tokens

```yaml
skeleton:
  base: "{colors.surface-muted}"
  highlight: "{colors.hairline-soft}"
  radiusText: 6px
  radiusTitle: 8px
  radiusIcon: 4px
  shimmerDuration: 1600ms
  animation: shimmer

skeleton-widths:
  xs: 44px
  sm: 72px
  md: 96px
  lg: 124px
  xl: 168px
  fluid: "60%–88% of available slot"
```

## 5.2 Skeleton Anatomy Rules

- Preserve the real component's **height, padding, gap, radius, alignment, and responsive behavior**.
- Replace readable text with neutral bars sized to demonstrate hierarchy only.
- Replace data-bearing icons with neutral square/circle placeholders when their semantic glyph could expose context.
- Table header cells use skeleton bars; never render real column names in design-only output.
- Table body cells use varied skeleton widths that are generic and not derived from actual values.
- Badges render as unlabeled 20px pill skeletons.
- Forms render field shells and neutral label/value skeletons; no real placeholder text.
- Charts render axes/series geometry only; legends and values are skeletonized.
- Buttons may preserve button geometry but text is replaced with a centered skeleton bar; do not infer action wording.
- Topbar controls may preserve geometry but should not reveal search, notification, profile, or workflow meaning through readable copy or semantic icon names in privacy-strict artifacts.

## 5.3 Source-Code Privacy Rules

```yaml
source-privacy:
  html:
    forbidReadableProtectedContent: true
    forbidSemanticDataAttributes: true
    forbidBusinessComments: true
    forbidProtectedHrefValues: true
    preferGenericClassNamesForContentSlots: true
  react:
    forbidHardcodedMockData: true
    skeletonPropsOnlyUntilRuntimeBinding: true
  accessibility:
    skeletonRegions: "aria-hidden=true where appropriate"
    loadingContainer: "aria-busy=true"
    genericLabelsOnly: true
```

- Do not hide protected copy with CSS; remove it from the DOM/source entirely.
- Do not place protected content in `title`, `aria-label`, `alt`, `data-*`, comments, JavaScript arrays, object keys, IDs, or class names.
- Generic structural terms such as `sidebar`, `table`, `card`, `row`, `column-1`, and `placeholder` are allowed.

-----

# 6. Topbar & Search

```yaml
topbar:
  height: 64px
  padding: 16px
  background: transparent
  borderBottom: none

topbar-layout:
  width: "100% of main pane"
  referenceWidth: 1080px
  gap: 24px
  alignItems: center
  titleZone:
    flex: 1
    gap: 16px
  rightZone:
    width: 370px
    component: desktop-search

topbar-context-title:
  enabled: true
  fontSize: 32px
  lineHeight: 42px
  fontWeight: 700
  color: "{colors.primary}"

search-composite:
  width: 370px
  height: 40px
  internalGap: 20px
  inputWidth: 270px
  actionZoneWidth: 80px

search-control:
  height: 40px
  borderColor: "{colors.field-border}"
  radius: "{rounded.circle}"
```

Topbar rules:

- In skeleton-only mockup mode, replace the readable page title, context chip text, search text, and right-side action semantics with neutral skeleton placeholders while preserving the same geometry.
- Do not store protected topbar copy in DOM attributes, comments, IDs, data attributes, or JavaScript constants.

- Topbar is a 64px transparent frame with 16px padding.
- Page title is part of the topbar/header area and uses `32 / 42 / 700` in primary blue.
- At the 1280px baseline the topbar spans the full 1080px main pane.
- Search/action composite occupies 370px and stays right aligned.
- Do not create a separate white header band behind the topbar.
- Do not replace the compact 32px page title with a 48px marketing heading.
- Notification/profile controls live inside the right-side composite when the page uses them.
- Search fields use 40px controls and the approved field border treatment.

-----

# 7. Icon System

```yaml
icon-system:
  style: outline
  strokeWidth: 1.8
  defaultSize: 18px
  color: currentColor
  activeColor: "{colors.on-primary}"

icon-library:
  preferred:
    - lucide
    - heroicons
    - phosphor-light

icon-rendering:
  type: svg
  stroke: currentColor
  fill: none
  strokeLinecap: round
  strokeLinejoin: round

icon-alignment:
  sidebar:
    size: 18px
    gap: 10px

  topbar:
    size: 20px

  table-action:
    size: 18px

sidebar-icon:  { size: 18px, color: currentColor }
table-icon:    { size: 16px, color: currentColor }
action-icon:   { size: 20px, color: currentColor }
```

Rules:

- In full skeleton mode, use neutral non-semantic icon placeholders for content-bearing actions; do not expose protected workflow meaning through icon names or glyphs.
- Use outline SVG icons only for explicitly supplied display-safe runtime UI
- No emoji icons in production UI
- Icons inherit text color via `currentColor
- “Do not render placeholder square icons”
- “All production UI must use real SVG icons”
- “Prefer outline enterprise icon style”
- “Icons must visually match Design System density”
- “Sidebar icons should feel lightweight and operational”

-----

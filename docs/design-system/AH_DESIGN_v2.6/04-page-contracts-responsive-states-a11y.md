# 10. Page Type System

```yaml
page-types:
  operational-dashboard:
    density: compact
    useSummary: true
    useTable: true
    useCharts: optional
    contentModeInMockup: skeleton-only

  operational-listing:
    density: compact
    useFilterBar: true
    useEnterpriseTable: true
    useSummary: optional
    useSidePanel: optional
    contentModeInMockup: skeleton-only

  executive-dashboard:
    density: comfortable
    useCharts: true
    useSummaryCards: true
    useTable: optional
    contentModeInMockup: skeleton-only

  detail-page:
    density: medium
    useSidePanel: optional
    useTable: optional
    contentModeInMockup: skeleton-only
```

All page types inherit Section 5. Page type selection controls **layout only**, never readable mock content.

-----

# 11. Privacy-Safe Layout Contracts

These contracts retain only calibrated geometry. Names, labels, navigation destinations, business semantics, table meanings, and readable values are deliberately excluded.

## 11.1 Listing Layout A

```yaml
listing-layout-a:
  pageType: operational-listing
  contentMode: skeleton-only
  desktopBaseline: "1280 = 200 sidebar + 1080 main pane"

  mustUse:
    - SidebarSkeleton
    - TopbarSkeleton
    - SummaryRowSkeleton
    - EnterpriseDataTableSkeleton
    - TableTabsSkeleton
    - SearchFilterSkeleton

  requiredGeometry:
    topbar: "1080 x 64"
    summaryRow: "1080 wide with 16px side gutters"
    summaryRowInternalWidth: 1048px
    summaryGap: 8px
    card-a: "467px wide, radius 16"
    card-b: "342px wide, radius 16"
    card-c: "223px wide, radius 16"
    tableCard: "1048px wide, radius 16"

  table:
    geometry: listing-geometry-a
    density: compact
    headerHeight: 44px
    rowHeight: 44px
    bodyTypography: "20 / 28 / 400"
    headerContent: skeleton
    bodyContent: skeleton
```

## 11.2 Listing Layout B

```yaml
listing-layout-b:
  pageType: operational-listing
  contentMode: skeleton-only
  desktopBaseline: "1280 = 200 sidebar + 1080 main pane"

  mustUse:
    - SidebarSkeleton
    - TopbarSkeleton
    - SummaryRowSkeleton
    - EnterpriseDataTableSkeleton
    - TableTabsSkeleton
    - SearchFilterSkeleton

  requiredGeometry:
    topbar: "1080 x 64"
    summaryRowInternalWidth: 1048px
    summaryGap: 8px
    card-a: "640px wide, radius 16"
    card-b: "400px wide, radius 16"
    tableCard: "1048px wide, radius 16"

  table:
    geometry: listing-geometry-b
    density: comfortable
    headerHeight: 44px
    rowHeight: 48px
    bodyTypography: "20 / 28 / 400"
    headerContent: skeleton
    bodyContent: skeleton
```

## 11.3 Generic Operational Listing

```yaml
generic-operational-listing:
  pageType: operational-listing
  contentMode: skeleton-only
  mustUse:
    - SidebarSkeleton
    - TopbarSkeleton
    - EnterpriseDataTableSkeleton
  mayUse:
    - SummaryRowSkeleton
    - SearchFilterSkeleton
    - TableTabsSkeleton
    - PaginationSkeleton
    - SidePanelSkeleton
  geometry:
    mainPaneGutter: 16px
    cardRadius: 16px
    tableDensity: compact
```

Rules:

- Layout contracts never authorize readable mock data.
- Preserve calibrated geometry before adding decoration.
- Runtime content must be explicitly supplied and display-safe before replacing skeletons.

-----

# 12. Component Architecture Enforcement

## 12.1 Required Shared Components

```yaml
app-shell:
  includes: [SidebarSkeleton, MainPane]
  rules:
    - "Desktop Sidebar = 200px"
    - "MainPane fills the remaining width"
    - "1280px baseline resolves to 1080px MainPane"

page-header:
  includes: [TitleZone, ContextChip, SearchActionComposite]
  rules:
    - "Lives inside 64px topbar"
    - "Title uses 32 / 42 / 700"
    - "Search/action composite is 370x40 when present"

summary-card:
  rules:
    - "Radius = 16px"
    - "White surface by default"
    - "Internal gap generally 8px"
    - "12px or 16px padding depending on pattern"

accent-card:
  rules:
    - "Radius = 16px"
    - "Only shared card allowed to use primary-to-indigo gradient"
    - "Gradient = #00008f to #4658fc"

operational-listing:
  includes:
    - SearchFilterSkeleton
    - TableTabsSkeleton
    - EnterpriseDataTableSkeleton
  rules:
    - "Table toolbar and filters = 40px control height"
    - "Table header = 44px"
    - "Body row = 44px compact or 48px comfortable"
    - "Body text = 20 / 28 / 400"
```

Component reuse rule:

- Reuse existing component anatomy and variants before inventing a visually similar replacement.
- New components must use the token scale and geometry from Sections 2–9.
- Component-level exceptions must be documented in the component contract, not as arbitrary page CSS.

-----

# 13. Responsive Rules

The calibrated source screens define desktop behavior only. Tablet/mobile behavior below is
an implementation adaptation and MUST preserve the desktop component anatomy and typography hierarchy.

## 13.1 Responsive Sidebar Behavior

```yaml
responsive-sidebar-behavior:
  desktop:
    minWidth: 1280px
    behavior: fixed-full-sidebar
    width: 200px
    skeletonLabels: visible

  tablet:
    minWidth: 768px
    maxWidth: 1279px
    behavior: icon-rail-or-drawer
    preferredWidth: 72px
    skeletonLabels: hidden
    tooltip: forbidden-in-skeleton-mode

  mobile:
    maxWidth: 767px
    behavior: drawer
    defaultState: closed
    overlay: true
    width: 280px
    animation: slide-left
```

## 13.2 Responsive Main Pane

```yaml
responsive-main-pane:
  desktop:
    width: "calc(100vw - 200px)"
    gutter: 16px
  tablet:
    width: "remaining viewport after rail/drawer"
    gutter: 16px
  mobile:
    width: "100vw"
    gutter: 16px
```

## 13.3 Responsive Content

- Summary rows may wrap from multi-column to 2-column and then 1-column.
- Preserve 16px card radius and 8–16px internal spacing.
- Tables use horizontal scrolling before reducing the 20px body typography below the defined scale.
- Search/filter controls may wrap, but remain 40px high.
- Header title remains 32/42 where space permits; on very narrow mobile widths, use the nearest defined heading token rather than arbitrary scaling.

## 13.4 Mobile Interaction Rules

- Drawer overlays content and closes after navigation.
- Touch targets for primary actions should be at least 44px even if the desktop visual button is 40px; add hit-area padding without visually enlarging the control when possible.
- Keep the mobile drawer skeleton-only unless explicit runtime navigation data is supplied.
- Do not force the desktop 1080px main pane onto mobile.
- Horizontal table scroll is preferred over destructive column compression.

-----

# 14. State & Interaction System

## 14.1 Interaction States

```yaml
states-required:
  hover:
    transition: "160ms ease"
    opacity: 0.96
  active:
    transform: "scale(0.99)"
  focus:
    outline: "2px solid {colors.primary}"
    outlineOffset: "2px"
  disabled:
    opacity: 0.5
    cursor: "not-allowed"
    pointerEvents: "none"
```

### Required state coverage

- Buttons: hover, active, focus, disabled
- Filter chips: active, focus
- Sidebar items: hover, active, selected
- Table rows: hover only (no active scale)
- Search input: focus ring without adding border in default state
- Pagination items: active, hover, focus, disabled

## 14.2 Loading / Empty / Error States

```yaml
loading-state:
  skeletonRadius: 8px
  shimmerOpacity: 0.12

empty-state:
  iconSize: 48px
  spacing: 16px
  align: center
  paddingY: 64px
  background: "{colors.canvas}"
  title:       { fontSize: 20px, fontWeight: 700, lineHeight: 28px, color: "{colors.ink-deep}" }
  description: { fontSize: 14px, fontWeight: 400, lineHeight: 20px, color: "{colors.slate}", maxWidth: 420px }

error-state:
  border: "1px solid #ffe0e0"
  background: "#fff7f7"
  radius: 12px
```

Rules:

- Prefer skeleton loading over spinner
- Empty states must stay minimal — no illustration-heavy visuals
- Error cards stay compact
- Avoid modal-only errors
- Every listing page must support empty state

## 14.3 Data States Contract

```yaml
data-states:
  loading: skeleton
  success: visible
  empty: empty-state
  error: compact-error-card
  restricted: permission-card
```

Rules:

- Every table must support loading state
- Every operational listing must support empty state
- Permission denied state uses neutral background

## 14.4 Motion System

```yaml
motion:
  durationFast: 120ms
  durationNormal: 180ms
  durationSlow: 260ms
  easingStandard: ease-out
  easingInOut: ease-in-out
```

### Allowed motion

- fade
- slide-up
- slide-left
- subtle scale (scale-soft)
- opacity hover

### Forbidden motion

- bounce
- elastic
- heavy parallax
- distracting animation

### Interaction motion

- Hover: opacity
- Active: scale 0.99
- Focus: subtle transition

-----

# 15. Chart System

```yaml
chart-system:
  chartHeight: 320px
  chartRadius: 12px
  chartPadding: 16px
  chartLegendGap: 12px

chart-colors:
  primary: "#00008f"
  secondary: "#5b8def"
  success: "#17663a"
  warning: "#f2a918"
  critical: "#e3000a"
  neutral: "#dfe7f5"

chart-grid:
  stroke: "#edf1f7"
  strokeWidth: 1

chart-axis:
  fontSize: 12px
  color: "#606776"

chart-tooltip:
  background: "#ffffff"
  border: "1px solid #eceded"
  radius: 12px
  shadow: "0px 4px 8px rgba(150,167,214,0.15)"
```

Rules:

- Charts use white surface
- Avoid gradients
- Avoid colorful dashboards
- Primary blue is the primary data series color
- Use subtle gridlines
- Use compact legends
- Gauge charts: chart center-aligned in the card; supporting numbers below the chart, not inside separate mini cards unless required

-----

# 16. Form System

```yaml
form-input:
  height: 40px
  radius: "{rounded.circle}"
  border: "1px solid {colors.field-border}"
  padding: "8px 12px"
  background: "{colors.canvas}"
  fontSize: 16px
  lineHeight: 24px

form-label:
  fontSize: 16px
  fontWeight: 400
  lineHeight: 24px
  color: "{colors.slate}"

form-search-input:
  height: 40px
  radius: "{rounded.circle}"

form-textarea:
  minHeight: 120px
  radius: 12px
  padding: 12px

form-section:
  gap: 16px
  marginBottom: 24px

form-helper:
  fontSize: 14px
  lineHeight: 20px
  color: "{colors.slate}"

form-error:
  fontSize: 14px
  lineHeight: 20px
  color: "{colors.critical}"
```

Rules:

- Standard single-line controls are 40px high.
- Search/filter fields use pill geometry where the component pattern calls for it.
- Default field border uses `#cccccc`; focus state uses primary blue.
- Avoid input shadows.
- Labels remain visible and semantically associated with inputs.

-----

# 17. Performance Tracking Pattern

Performance-oriented mockups preserve geometry only; metric names, values, targets, labels, and statuses are runtime data and remain skeletonized.

```yaml
performance-tracking-card:
  background: "#ffffff"
  border: "1px solid #eceded"
  radius: 16px
  padding: 14px

performance-progress:
  height: 10px
  radius: 999px
  background: "#eaf1fb"

performance-skeleton:
  label: skeleton
  metric: skeleton
  comparison: skeleton
  progress: neutral-placeholder
  status: unlabeled-pill
```

Rules:

- Do not render readable metric names or values in design-only mode.
- Do not infer target/status terminology.
- Preserve card, progress, and hierarchy geometry with skeleton blocks only.

-----

# 18. Accessibility

```yaml
a11y:
  minimumContrast: "4.5:1"
  focusVisible: true
  keyboardNavigation: required
  semanticHTML: required

focus-ring:
  color: "{colors.primary}"
  width: 2px
  offset: 2px
```

Rules:

- Buttons must be real `<button>` elements
- Inputs require labels
- Interactive icons need accessible names (aria-label)
- Tables must use semantic table elements
- Focus ring uses primary blue, 2px width, 2px offset
- Heading order must be logical
- All controls keyboard accessible

-----

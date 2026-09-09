# 8. Shared Components

## 8.1 Buttons

```yaml
button-shape:
  radius: "{rounded.full}"
  gap: 4px

button-md:
  height: 40px
  padding: "6px 16px"
  font: "{typography.button-md}"

button-xss-primary:
  height: 28px
  padding: "4px 8px"

button-xs-ghost:
  height: 24px
  padding: "0"

button-xss-ghost:
  height: 20px
  padding: "0"

button-primary:
  background: "{colors.primary}"
  border: "1px solid {colors.primary}"
  color: "{colors.on-primary}"

button-outline:
  background: transparent
  border: "1px solid {colors.primary}"
  color: "{colors.primary}"

button-ghost:
  background: transparent
  border: none
  color: "{colors.primary}"
```

Rules:

- Primary and outline medium buttons use 40px height and `6px 16px` padding.
- Compact primary CTA may use 28px height and `4px 8px` padding.
- Ghost actions may use 24px or 20px compact variants.
- Buttons always use the 100px pill radius.
- All variants require hover, active, focus, and disabled states.

-----

## 8.2 KPI Cards

```yaml
kpi-grid:
  columns: 4
  gap: 16px
  marginBottom: 24px

kpi-layout:
  gap: 6px

kpi-card:
  minHeight: 92px
  height: auto
  background: "{colors.canvas}"
  border: "1px solid {colors.hairline-soft}"
  radius: "{rounded.sm}"
  padding: "24px 32px 28px"
  shadow: none

kpi-title:   { fontSize: 16px, fontWeight: 700, lineHeight: 24px, color: "{colors.ink}" }
kpi-value:   { fontSize: 30px, fontWeight: 700, lineHeight: 34px, color: "{colors.primary}" }
kpi-note:    { fontSize: 14px, fontWeight: 700, lineHeight: 20px, color: "{colors.slate}" }
```

Rules:

- “KPI card must use min-height instead of fixed height when large values are used”
- “KPI card requires sufficient bottom padding”
- “KPI note must never visually touch the bottom edge”
- “Operational KPI cards should feel balanced vertically”
- Operational dashboard KPI cards use white background
- Primary value may use primary blue
- Avoid colorful KPI cards unless explicitly marked as highlight
- “Operational KPI cards should feel compact and information-dense”
- “Avoid oversized presentation-style KPI cards”
- “Reduce empty vertical space inside KPI cards”
- “KPI cards should visually align with enterprise dashboard density”

## 8.3 Dashboard Card

```yaml
card-dashboard:
  background: "{colors.canvas}"
  border: "1px solid {colors.hairline-soft}"
  radius: "{rounded.md}"
  padding: "16px"
```

## 8.4 Filter Bar

```yaml
filter-bar:
  background: transparent
  border: none
  radius: 0
  padding: 0
  shadow: none
  marginBottom: 16px
  alignItems: center
  justifyContent: space-between
  gap: 16px

filter-layout:
  gap: 8px
  alignItems: center
  flexWrap: wrap

filter-chip:
  height: 36px
  paddingX: 16px
  radius: "{rounded.circle}"
  fontSize: 14px
  fontWeight: 700
  background: "{colors.canvas}"
  border: "1px solid {colors.hairline}"
  color: "{colors.ink}"

filter-chip-active:
  background: "{colors.primary}"
  color: "{colors.on-primary}"
  borderColor: "{colors.primary}"

filter-select:
  height: 36px
  radius: "{rounded.sm}"
  border: "1px solid {colors.hairline}"
  paddingX: 12px
  background: "{colors.canvas}"
  color: "{colors.ink-deep}"
```

Rules:

- Operational listing pages include the shared filter/search geometry when the layout requires it
- Active chips use primary blue
- Select inputs use subtle borders
- Filter chips must include active and focus states
- “Listing filter bars should not render an additional white container unless explicitly required”
- “Filter chips may sit directly on app background”
- “Avoid double-layer surface effect”

## 8.5 Enterprise Data Table

```yaml
table-enterprise:
  background: "{colors.canvas}"
  radius: "{rounded.lg}"
  shadow: none
  overflow: hidden
  outerPadding: "12px 16px 16px"
  sectionGap: 12px

# Table toolbar/header above tabs and rows
table-toolbar:
  height: 40px
  title:
    fontSize: 24px
    fontWeight: 700
    lineHeight: 30px
    color: "{colors.ink-deep}"
  layoutGap: 8px

table-search-filter:
  width: 344px
  height: 40px
  gap: 16px
  inputWidth: 230px
  buttonHeight: 40px

table-tabs:
  height: 40px
  gap: 8px

table-tab-chip:
  height: 40px
  padding: "4px 12px"
  gap: 8px
  radius: "{rounded.chip}"

# Data grid density variants
table-density-variant:
  default: compact
  variants:
    compact:
      headerHeight: 44px
      rowHeight: 44px
      rowPadding: "8px 16px"
      columnGap: 16px
      bodyFontSize: 20px
      bodyLineHeight: 28px
      bodyWeight: 400
      headerBackground: "{colors.app-bg}"
      rowBackground: "{colors.canvas}"
      alternateRowBackground: "{colors.surface-muted}"
      alternateRow: optional

    comfortable:
      headerHeight: 44px
      rowHeight: 48px
      rowPadding: "8px 16px"
      columnGap: 16px
      bodyFontSize: 20px
      bodyLineHeight: 28px
      bodyWeight: 400
      headerBackground: "{colors.app-bg}"
      rowBackground: "{colors.canvas}"
      alternateRowBackground: "{colors.surface-muted}"
      alternateRow: optional

# Status/source badges inside table rows
table-badge:
  height: 20px
  paddingX: 8px
  radius: "{rounded.rail}"
  fontSize: 14px
  lineHeight: 20px
  fontWeight: 400

# Header label instance
header-table-label:
  height: 28px
  gap: 4px
  sortIcon: allowed
```

### Privacy-safe listing column geometry

Column geometry is design data; semantic column meaning is runtime/product data and must not appear in skeleton-only artifacts.

```yaml
listing-geometry-a:
  column-1: 140px
  column-2: 130px
  column-3: 130px
  column-4: 130px
  column-5: 80px
  column-6: 100px
  column-7: 112px
  column-8: 100px
  gap: 16px

listing-geometry-b:
  column-1: 124px
  column-2: 140px
  column-3: 140px
  column-4: 140px
  column-5: 140px
  column-6: 100px
  column-7: 100px
  column-8: 110px
  column-9: 94px
  gap: 16px
```

### Table rules

- Table card radius = 16px.
- Table card uses `12px 16px 16px` internal padding and 12px vertical section gap.
- Header row = 44px with 8px vertical / 16px horizontal padding.
- Compact body row = 44px; comfortable body row = 48px.
- Primary body cells use DB `20 / 28 / 400`.
- Primary/linked values may use primary blue; ordinary body text uses deep ink/ink.
- Header background uses app background blue (`#f0f6ff`), not dark primary blue.
- Badges are 20px high with 8px horizontal padding and 1000px radius.
- No generic card shadow on the table container.
- Search/filter composite = 344x40 with a 230px input and 40px outline action.
- Tabs remain 40px high with pill chips.
- Use horizontal scrolling rather than shrinking calibrated columns below readable width.

-----

## 8.6 Side Panel

```yaml
side-panel:
  width: 320px
  gap: 16px

side-panel-card:
  background: "{colors.canvas}"
  border: "1px solid {colors.hairline-soft}"
  radius: "{rounded.md}"
  padding: 16px
  shadow: "{shadows.card}"

side-panel-title:
  fontSize: 20px
  fontWeight: 700
  lineHeight: 28px
  color: "{colors.ink-deep}"

side-panel-item:
  background: "{colors.canvas}"
  border: "1px solid {colors.hairline-soft}"
  radius: "{rounded.md}"
  padding: 14px
```

Rules:

- Desktop operational listing pages may use `1fr + 320px` layout when side panel exists
- On tablet/mobile, side panel moves below content

## 8.7 Pagination

```yaml
pagination:
  height: 40px
  gap: 8px
  alignItems: center
  justifyContent: flex-end

pagination-item:
  size: 32px
  radius: "{rounded.sm}"
  border: "1px solid {colors.hairline}"
  background: "{colors.canvas}"
  color: "{colors.ink}"

pagination-item-active:
  background: "{colors.primary}"
  color: "{colors.on-primary}"
  borderColor: "{colors.primary}"
```

Rules:

- Pagination items must include active, hover, focus, and disabled states

## 8.8 Component Variants Registry

```yaml
sidebar:
  variants: [default, compact, drawer]

kpi-card:
  variants: [default, highlight, compact]

enterprise-table:
  features: [sticky-header, loading-state, empty-state, pagination, sorting, row-hover]

filter-bar:
  variants: [listing, dashboard, compact]

modal:
  sizes: [sm, md, lg, full]

form-input:
  variants: [default, error, disabled]
```

## 8.9 Component Reuse Rules

- Never duplicate sidebar markup with different spacing or typography
- Never create page-specific table styles for shared operational listing pages
- Never create page-specific button radius
- Never use decorative gradients, glow effects, or oversized cards
- If a new page needs a list → use `EnterpriseDataTable` first
- If a new page needs filters → use `FilterBar` first
- If a new page needs page actions → use `button-primary` and `button-secondary` first

-----

# 9. Layout System

## 9.1 Page Header Pattern

The calibrated operational screens use the page title inside the 64px topbar/header,
not a separate oversized marketing header block.

```yaml
page-header:
  placement: "inside topbar"
  height: 64px
  padding: 16px
  background: transparent
  title:
    fontSize: 32px
    fontWeight: 700
    lineHeight: 42px
    color: "{colors.primary}"
  contextualChip:
    optional: true
    height: 40px
    radius: "{rounded.chip}"
  rightComposite:
    width: 370px
    height: 40px
```

Rules:

- Operational/listing pages do not add a second 48px page heading below the topbar.
- Section/card titles below the topbar use `24 / 30 / 700`.
- Context chips may sit beside the page title when required.
- Keep title and search/actions vertically centered within the 64px header.

-----

## 9.2 Layout Density & Rhythm

```yaml
density-rhythm:
  mainPaneGutter: 16px
  majorSectionGap: 16px
  cardGap: 8px
  cardPaddingCompact: 12px
  cardPaddingStandard: 16px
  tableInternalGap: 12px
  toolbarGap: 8px
  navigationGroupGap: 24px
```

Rules:

- Operational pages use dense 8/12/16px rhythm.
- Main content blocks sit 16px from main-pane edges.
- Adjacent summary cards commonly use 8px gaps.
- Avoid arbitrary 32–48px whitespace between operational sections.
- Use 24px mainly for navigation grouping, not as the default card gap.

-----

## 9.3 Strict Layout Grid

```yaml
strict-grid:
  desktopBaseline:
    viewport: 1280px
    sidebar: 200px
    mainPane: 1080px
    equation: "200 + 1080 = 1280"
  mainPane:
    width: "calc(100vw - 200px)"
    horizontalGutter: 16px
  innerContentReference:
    width: 1048px
    equation: "1080 - 16 - 16 = 1048"
  tableInnerReference:
    width: 1016px
    equation: "1048 - 16 - 16 = 1016"
```

### Strict layout constraints

- At 1280px desktop: sidebar = 200px and main pane = 1080px.
- Main pane fills remaining width on larger desktops; it is not capped at 1240px.
- Standard page horizontal gutter = 16px.
- Standard full-width content card at the baseline = 1048px.
- A 1048px table card with 16px left/right inner padding yields a 1016px working table width.
- Use Auto Layout / flex/grid relationships; do not hard-code absolute positions for structural page content.

-----

## 9.4 Allowed Shared Sections

These may appear on ANY page:

- Sidebar, Topbar, Page Header, Search
- KPI Cards, Dashboard Cards, Tables, Charts
- Filter Bars, Side Panels, Summary Blocks
- Empty States, Pagination

## 9.5 Forbidden Global Sections

These belong ONLY to Home page. Must NEVER auto-inherit into other pages:

- Hero Banner
- Shortcut Menu
- Qualification Section
- Product-specific side panel
- Floating Live Chat
- Home Announcement Card
- Marketing Cards
- Gradient Summary Blocks

-----

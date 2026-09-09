# 19. Implementation Mapping & Anti-Drift

This section defines how the standalone Design System maps into implementation.
No external design file, node, URL, or design-tool reference is required at runtime.
This document is authoritative.

## 19.1 Naming Convention

```yaml
ah-naming:
  componentPattern: "AH / Category / Component"
  pagePattern:      "AH / Pages / Page Name"
  tokenPattern:     "AH / Tokens / Category"
```

## 19.2 Implementation Mapping Rules

- Design section → semantic HTML section/component.
- Auto-layout relationships → CSS flex/grid before absolute positioning.
- Component states/variants → component props or state classes.
- Token names map to canonical CSS variables.
- Shared component contracts override page-local styling.
- Page contracts may specialize layout only where explicitly allowed.

## 19.3 Design Rule Preservation

Preserve:

- DB web-first font priority and the `55 Regular` / `75 Bd` weight mapping.
- 1280 desktop baseline with 200px sidebar and 1080px main pane.
- 16px main-pane gutters.
- 32/42 page title and 24/30 section title hierarchy.
- 20/28 primary table/nav content typography.
- 40px controls/tabs, 44px table header, 44/48px table body rows.
- 16px operational card radius.
- component variants, responsive behavior, interaction states, and sidebar skeleton privacy mode.

## 19.4 Visual Matching Priority

- Prioritize visual conformity to this Design System over generic dashboard conventions.
- Preserve calibrated density before adding whitespace.
- Standard cards are white on the light-blue app background.
- Primary blue is used deliberately for title/selection/action/link emphasis.
- The primary-to-indigo gradient is reserved for the documented accent summary-card variant.

## 19.5 Anti-Drift Rules

- No 48px operational page titles.
- No fixed 1240px inner content canvas.
- No 40px sidebar rows; desktop sidebar menu rows are 32px.
- No 56px compact table rows; compact = 44px, comfortable = 48px.
- No 14px primary table body typography; primary cells use 20/28 unless a specific compact subcomponent says otherwise.
- No generic gradients; only the documented accent summary-card gradient exception is allowed.
- No dark-blue table header fill; table header uses app-bg.
- No card shadow on enterprise table containers.
- No alternate font family when approved DB webfont or supported local DB font is available.
- No readable or semantic protected content anywhere in design-only mockups; all data-bearing regions use skeletons.
- Do not invent new radii/colors/shadows outside the token set unless a new contract is explicitly added.

-----

# 20. Runtime Content Boundary

Role names, permission names, team names, visibility rules, navigation destinations, workflow names, and domain content are **runtime/product data**, not design-system content.

```yaml
runtime-content-boundary:
  designOnlyMockup:
    roleData: skeleton-or-absent
    permissionData: skeleton-or-absent
    teamData: skeleton-or-absent
    workflowData: skeleton-or-absent
    navigationData: skeleton-or-absent
  runtimeBinding:
    requiresExplicitDisplaySafeInput: true
    inferFromDesign: false
```

The Design System defines geometry and visual states only. It must never invent or preserve readable role/permission/business content in a privacy-safe mockup.

-----

# 21. AI Design Runtime

## 21.1 Render Pipeline

1. Load tokens
1. Load layout shell
1. Load component registry
1. Resolve explicit runtime visibility only when display-safe runtime data exists
1. Render page contract
1. Apply responsive rules
1. Apply interaction states

## 21.2 Runtime Rules

- All pages must consume token variables only
- Shared components required before custom component creation
- Layout engine uses a 200px desktop sidebar and fluid remaining main pane; 1080px at the 1280px baseline
- Sidebar container locked to 200px; mockup content uses privacy-safe skeleton placeholders
- Enterprise density required

## 21.3 AI Enforcement

- Prevent generic SaaS layouts
- Prevent oversized spacing
- Prevent inconsistent typography
- Prevent mixed KPI styles

-----

# 22. AI Generation Rules

The AI generator must follow these when emitting HTML/React:

1. Default design-only output to **full-data skeleton mode**.
2. Render the 200px `SidebarSkeleton` before the MainPane; never infer navigation content.
3. At 1280px viewport width, MainPane resolves to 1080px; on wider desktop it fills remaining width.
4. Use 16px horizontal main-pane gutters; do not create a fixed 1240px wrapper.
5. Use the DB web-first font policy from Section 2.4.
6. Preserve the typography hierarchy as **skeleton slot heights**: page-title slot 32/42, section-title slot 24/30, body slot 20/28.
7. Topbar = 64px high with 16px padding; right control composite = 370x40 when used.
8. Desktop sidebar skeleton row slot = 32px; generic skeleton groups use 24px separation.
9. Standard operational card radius = 16px.
10. White operational cards sit on `#f0f6ff` app background.
11. The documented accent summary card is the only generic shared gradient surface.
12. Search/filter/button/tab shells use 40px desktop height unless a documented compact variant applies.
13. Enterprise table card uses 16px radius and no shadow.
14. Table header = 44px with `#f0f6ff` background.
15. Compact table row = 44px; comfortable row = 48px.
16. Table badge skeleton = 20px high, 8px horizontal padding, 1000px radius.
17. Reuse calibrated generic column widths when a layout contract provides them.
18. Use existing shared component anatomy before creating replacements.
19. All interactive components require hover, focus, active, and disabled behavior where applicable.
20. In skeleton-only output, replace readable page/card/table/form/chart/button content with neutral skeleton placeholders.
21. In skeleton-only output, do not render real or invented names, values, IDs, dates, financials, phone numbers, statuses, routes, labels, column names, role names, permission names, workflow names, or product terms.
22. Do not leak protected content through hidden text, comments, `data-*`, `id`, class names, `title`, `aria-label`, `alt`, hrefs, JavaScript constants, arrays, or object keys.
23. Use neutral non-semantic icon placeholders when a semantic icon or icon name could expose protected workflow meaning.
24. Readable runtime content may replace skeletons only when explicitly supplied as display-safe input.
25. Do not narrate these rules in generated UI output unless the user asks for an audit.

-----

# 23. Silent Design Application Rule

Apply this DESIGN silently. In design-only/mockup mode every generated page must satisfy:

- `contentMode = skeleton-only`.
- Sidebar = 200px desktop and contains only neutral skeleton placeholders.
- Main pane = remaining viewport width; 1080px at the 1280px baseline.
- Main-pane horizontal gutter = 16px.
- Topbar = transparent, 64px high, 16px padding.
- Readable page title is absent; preserve its 32/42 hierarchy with a skeleton title slot.
- Readable section/card/table titles are absent; preserve 24/30 hierarchy with skeleton bars.
- Search, filter, button, tab, badge, chart, form, and table content are skeletonized.
- Standard desktop control shell = 40px unless a documented compact variant applies.
- Standard operational card radius = 16px.
- Standard cards are white on `#f0f6ff` app background.
- Accent summary gradient is allowed only on the documented accent-card variant; its content is still skeletonized.
- Enterprise table header = 44px with `#f0f6ff` background.
- Enterprise table row = 44px compact or 48px comfortable.
- Enterprise table shadow = none.
- Table header labels and body values are skeletons only.
- Table badge = unlabeled 20px pill skeleton.
- No real or invented product/business/customer/navigation/role/permission data exists anywhere in source or rendered UI.
- Use generic structural names only; no protected meaning in DOM attributes, comments, scripts, or icon names.
- Home-only sections do not auto-inherit into operational pages.
- Keep density operational and compact; do not introduce marketing-style whitespace or hero typography.

-----

# 24. HTML Generation Checklist

Before delivering generated UI, verify:

```yaml
html-generation-checklist:
  privacy:
    - "Full-data skeleton mode is active for design-only output"
    - "No readable page/card/table/form/chart/button business content"
    - "No real or invented personal, product, workflow, status, financial, date, phone, ID, role, permission, navigation, or column data"
    - "No protected content in comments, title, aria-label, alt, id, class names, data attributes, hrefs, or JavaScript constants"
    - "Content-bearing semantic icons are replaced by neutral placeholders when needed"

  font:
    - "DB webfont is attempted before local DB fallback when approved webfont assets exist"
    - "55 Regular maps to weight 400"
    - "75 Bd maps to weight 700"

  shell:
    - "Desktop sidebar width = 200px"
    - "1280px baseline main pane = 1080px"
    - "Main content horizontal gutter = 16px"

  topbar:
    - "Height = 64px"
    - "Padding = 16px"
    - "Readable title replaced by skeleton title slot"
    - "Right control composite geometry preserved without protected semantics"

  sidebar:
    - "Skeleton-only"
    - "Row slot = 32px; generic group separation = 24px"
    - "No labels/routes/keys/selected destination/semantic navigation icons"

  cards:
    - "Standard operational card radius = 16px"
    - "Standard cards are white"
    - "All labels/values are skeletons"

  controls:
    - "Standard desktop shell height = 40px"
    - "No readable control copy in skeleton mode"

  tables:
    - "Table card radius = 16px"
    - "Table card has no shadow"
    - "Table header = 44px and #f0f6ff"
    - "Compact row = 44px; comfortable row = 48px"
    - "Header labels and body values are skeletons"
    - "Badges are unlabeled 20px skeleton pills"

  drift:
    - "No 1240px fixed inner canvas"
    - "No 48px operational page-title geometry"
    - "No 56px compact rows"
    - "No generic gradient backgrounds"
```

If any required check fails, correct the implementation before delivery.

-----

# 25. AI Correction Rules

When a generated page does not match the design, fix in this order:

1. Layout shell — sidebar, topbar, content width
1. Typography scale
1. Spacing rhythm
1. Table density
1. Colors and borders
1. Interaction states
1. Remove any readable or semantic protected content from design-only mockups immediately
1. Remove any inherited Home-only sections immediately
1. Prefer deleting extra decorative UI over adding more UI
1. Keep output dense, operational, and Design-System-consistent
1. Do not explain these corrections in the generated UI

-----

# 26. Final Design Principle

AI Design UI must feel:

- enterprise
- operational
- compact
- readable
- domain-neutral in design-only skeleton mode
- Design-System-faithful
- not decorative
- not generic SaaS

When in doubt:

- prefer white surfaces
- prefer subtle borders
- prefer compact spacing
- prefer clear hierarchy
- avoid visual noise

-----

# 27. Known Gaps

- The calibrated reference set is desktop-first at 1280x768; tablet/mobile behavior is an implementation adaptation and must be QA-tested separately.
- Some shared components expose additional variants not represented in the calibrated screens; do not infer undocumented visual variants from names alone.
- Exact image/avatar/content data is runtime product data and remains skeletonized or absent in design-only output.
- Motion timing is normalized by Section 14 because the static reference does not establish animation timing.
- Webfont delivery still depends on approved DB webfont files and valid web-embedding rights.

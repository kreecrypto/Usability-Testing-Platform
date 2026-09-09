# 2. Design Tokens

## 2.1 Token Usage Contract

```yaml
token-contract:
  rule: "Every generated UI value must map to a token unless explicitly marked as page-specific"
  cssVariablePrefix: "--ah"
  allowRawValues: false
  allowedRawValues:
    - "#fafbfc"  # enterprise table header only
    - "#fafcff"  # enterprise table hover only
  fallbackBehavior: "If an exact value is not defined, choose the nearest existing token; do not invent new colors, radii, or shadows."
```

## 2.2 CSS Variable Map (canonical)

The layout baseline uses a 1280px desktop viewport with a 200px sidebar and a
1080px main pane. The main pane is fluid above/below the baseline; do not create
a second fixed-width wrapper inside it unless a page contract explicitly requires one.

```css
:root {
  /* Colors */
  --ah-primary: #00008f;
  --ah-primary-deep: #00006f;
  --ah-primary-dark: #000056;
  --ah-primary-soft: #e2efff;
  --ah-primary-gradient-end: #4658fc;

  --ah-canvas: #ffffff;
  --ah-app-bg: #f0f6ff;
  --ah-surface-muted: #f7f7f8;

  --ah-ink-deep: #1a1d21;
  --ah-ink: #434956;
  --ah-slate: #606776;
  --ah-placeholder: #b2b2b2;
  --ah-disabled: #bfc3c9;

  --ah-hairline: #e5e5e5;
  --ah-hairline-soft: #eceded;
  --ah-field-border: #cccccc;
  --ah-neutral-border: #8c93a1;

  --ah-success: #17663a;
  --ah-warning: #f2a918;
  --ah-critical: #e3000a;
  --ah-on-primary: #ffffff;

  /* Badge palette observed in production patterns */
  --ah-badge-coral: #ffb4ce;
  --ah-badge-blue: #74bde8;
  --ah-badge-sunshine: #ffff00;
  --ah-badge-teal: #0f717f;
  --ah-badge-success-bg: #dff8ea;
  --ah-badge-success-ink: #0f4527;
  --ah-badge-cyan-bg: #dbf7fb;

  /* Layout dimensions */
  --ah-reference-desktop-width: 1280px;
  --ah-sidebar-width: 200px;
  --ah-main-pane-reference-width: 1080px;
  --ah-main-pane-width: calc(100vw - var(--ah-sidebar-width));
  --ah-content-gutter: 16px;
  --ah-topbar-height: 64px;
  --ah-search-width: 370px;
  --ah-search-height: 40px;
  --ah-sidebar-item-height: 32px;
  --ah-table-header-height: 44px;
  --ah-table-row-height: 44px;
  --ah-table-row-height-comfortable: 48px;
  --ah-tab-height: 40px;
  --ah-button-md-height: 40px;
  --ah-badge-height: 20px;
  --ah-side-panel-width: 320px;

  /* Radius */
  --ah-radius-xs: 4px;
  --ah-radius-sm: 8px;
  --ah-radius-md: 12px;
  --ah-radius-lg: 16px;
  --ah-radius-full: 100px;
  --ah-radius-pill: 100px;   /* alias */
  --ah-radius-chip: 999px;
  --ah-radius-rail: 1000px;
  --ah-radius-circle: 9999px;

  /* Numeric spacing scale */
  --ah-space-4: 4px;
  --ah-space-8: 8px;
  --ah-space-10: 10px;
  --ah-space-12: 12px;
  --ah-space-16: 16px;
  --ah-space-20: 20px;
  --ah-space-24: 24px;
  --ah-space-32: 32px;

  /* Legacy semantic aliases */
  --ah-space-xs: var(--ah-space-8);
  --ah-space-sm: var(--ah-space-12);
  --ah-space-md: var(--ah-space-16);
  --ah-space-lg: var(--ah-space-24);
  --ah-space-xl: var(--ah-space-32);

  /* Shadows */
  --ah-shadow-card: 0px 4px 8px rgba(150,167,214,0.15);
  --ah-shadow-none: none;
}
```

### Alias policy

Legacy aliases may remain for backward compatibility, but new components should use
the numeric spacing tokens and the explicit component-height tokens above. Alias values
must never diverge from their canonical token.

-----

## 2.3 Colors (semantic mapping)

```yaml
colors:
  primary: "#00008f"
  primary-deep: "#00006f"
  primary-dark: "#000056"
  primary-soft: "#e2efff"
  primary-gradient-end: "#4658fc"
  canvas: "#ffffff"
  app-bg: "#f0f6ff"
  surface-muted: "#f7f7f8"
  ink-deep: "#1a1d21"
  ink: "#434956"
  slate: "#606776"
  placeholder: "#b2b2b2"
  disabled: "#bfc3c9"
  hairline: "#e5e5e5"
  hairline-soft: "#eceded"
  field-border: "#cccccc"
  neutral-border: "#8c93a1"
  success: "#17663a"
  warning: "#f2a918"
  critical: "#e3000a"
  on-primary: "#ffffff"

special-surfaces:
  intelligence-gradient:
    allowed: true
    from: "#00008f"
    to: "#4658fc"
    radius: 16px
    textColor: "#ffffff"
    usage: "accent insight/recommendation card only; no readable label in skeleton mode"
```

Rules:

- Primary blue may be used for page titles, selected states, links, primary actions, and selected/important table values.
- Standard operational cards remain white.
- The intelligence gradient is a controlled exception; do not use it on generic KPI, table, form, or navigation surfaces.
- Table header rows use `app-bg` (`#f0f6ff`) in the calibrated listing pattern.

-----

## 2.4 Typography

### 2.4.1 Font Family — DB Web-First (mandatory)

```yaml
font-family:
  policy: "web-first-with-local-fallback"
  requiredPriority: "self-hosted DB webfont first; local DB font second; fallback fonts last"
  primary: "DB Helvethaica X"
  preferred:
    - "DB Helvethaica X"
    - "DB Helvethaica"
    - "DB Heavent"
  webfont:
    requiredWhenAssetsAvailable: true
    preferredFormat: "woff2"
    fontDisplay: "swap"
    canonicalDirectory: "/assets/fonts/"
    allowedHosting:
      - "same-origin self-hosted assets"
      - "approved first-party CDN or object storage"
    externalThirdPartyFontService: "forbidden unless explicitly approved"
  localFallback:
    enabled: true
    priority: "after self-hosted webfont"
  thaiFallback:
    - "Noto Sans Thai"
    - "Leelawadee UI"
    - "Tahoma"
  systemFallback:
    - "Arial"
    - "sans-serif"
  scope: "all UI text, form controls, tables, buttons, charts, navigation, overlays"
```

Mandatory rules:

- The implementation must **not depend on DB Font being installed on the user's device** when approved webfont assets are available.
- Load the approved **self-hosted DB webfont first**, preferably as `.woff2`.
- If the webfont cannot be loaded, try the supported DB font installed locally.
- Only after both webfont and local DB font are unavailable may the browser use the Thai/system fallback stack.
- Do not silently replace an available DB font with Inter, Roboto, Arial, or another generic UI font.
- Do not fetch DB Font from an unapproved third-party font service. Same-origin assets, approved first-party CDN, or approved object storage are allowed.
- Do not embed or redistribute DB Font files unless the font license permits webfont embedding/distribution.
- Font loading must not change typography tokens, component dimensions, or layout contracts.
- Apply the same font stack to `html`, `body`, `button`, `input`, `select`, `textarea`, table content, SVG text, and UI overlays where supported.

Canonical webfont asset names:

```text
/assets/fonts/DBHelvethaicaX-Regular.woff2
/assets/fonts/DBHelvethaicaX-Medium.woff2
/assets/fonts/DBHelvethaicaX-Bold.woff2
```

Canonical CSS:

```css
@font-face {
  font-family: "DB Helvethaica X";
  src:
    url("/assets/fonts/DBHelvethaicaX-Regular.woff2") format("woff2"),
    local("DB Helvethaica X"),
    local("DB Helvethaica");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "DB Helvethaica X";
  src:
    url("/assets/fonts/DBHelvethaicaX-Medium.woff2") format("woff2"),
    local("DB Helvethaica X Medium"),
    local("DB Helvethaica Medium");
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: "DB Helvethaica X";
  src:
    url("/assets/fonts/DBHelvethaicaX-Bold.woff2") format("woff2"),
    local("DB Helvethaica X Bold"),
    local("DB Helvethaica Bold");
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

:root {
  --ah-font-primary: "DB Helvethaica X", "DB Helvethaica", "DB Heavent",
                     "Noto Sans Thai", "Leelawadee UI", Tahoma, Arial, sans-serif;
}

html,
body,
button,
input,
select,
textarea {
  font-family: var(--ah-font-primary);
}
```

Implementation behavior:

1. Web deployment with approved `.woff2` assets → use the self-hosted DB webfont.
2. Missing/blocked webfont asset → fall back to locally installed DB Font.
3. DB Font unavailable → fall back to the defined Thai/system stack.
4. Never change the typography scale to compensate for a missing font.

### 2.4.2 Typography Scale

The canonical DB styles map as follows:

```yaml
font-style-map:
  "55 Regular": 400
  "75 Bd": 700
```

Use only the following primary scale unless a component contract explicitly defines an exception:

```yaml
typography:
  metric-xl:     { size: 40px, weight: 700, lineHeight: 46px }
  display-xl:    { size: 32px, weight: 700, lineHeight: 42px }  # page title
  heading-lg:    { size: 24px, weight: 700, lineHeight: 30px }  # card/section title
  heading-md:    { size: 20px, weight: 700, lineHeight: 28px }
  body-lg:       { size: 20px, weight: 400, lineHeight: 28px }  # primary table/nav/content text
  body-md:       { size: 16px, weight: 400, lineHeight: 24px }
  body-sm:       { size: 14px, weight: 400, lineHeight: 20px }
  body-xs:       { size: 12px, weight: 400, lineHeight: 18px }
  button-md:     { size: 16px, weight: 700, lineHeight: 24px }
```

Rules:

- Page titles use `32 / 42 / 700` and primary blue.
- Card and table-section titles use `24 / 30 / 700` and deep ink.
- Primary table cells and sidebar menu labels use `20 / 28 / 400`.
- Small badges use `14 / 20 / 400` unless the badge component variant specifies otherwise.
- Do not restore presentation-scale 48px headings for operational screens.

### Typography utility classes

```yaml
typography-classes:
  .ah-metric-xl:  "40px / 46px / 700"
  .ah-display-xl: "32px / 42px / 700"
  .ah-heading-lg: "24px / 30px / 700"
  .ah-heading-md: "20px / 28px / 700"
  .ah-body-lg:    "20px / 28px / 400"
  .ah-body-md:    "16px / 24px / 400"
  .ah-body-sm:    "14px / 20px / 400"
  .ah-body-xs:    "12px / 18px / 400"
  .ah-button-md:  "16px / 24px / 700"
```

## 2.5 Radius / Spacing / Shadows / Breakpoints

```yaml
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  full: 100px
  chip: 999px
  rail: 1000px
  circle: 9999px

spacing:
  "4": 4px
  "8": 8px
  "10": 10px
  "12": 12px
  "16": 16px
  "20": 20px
  "24": 24px
  "32": 32px

shadows:
  card: "0px 4px 8px rgba(150,167,214,0.15)"
  none: "none"

breakpoints:
  wide: 1440px
  desktop: 1280px
  tablet: 1024px
  mobile: 768px
```

Spacing rules:

- Component internals primarily use 4 / 8 / 12 / 16.
- Navigation grouping uses 24.
- 10px is allowed for icon/menu/component gaps where specified.
- 20px is allowed for search composition and other explicitly calibrated gaps.
- 32px is reserved for larger container padding or page-level separation.

-----

# 3. App Shell

```yaml
app-shell:
  referenceViewportWidth: 1280px
  sidebarWidth: 200px
  mainPaneReferenceWidth: 1080px
  mainPaneWidth: "calc(100vw - 200px)"
  contentGutter: 16px
  minHeight: 100vh
  background: "{colors.canvas}"
  mainContentBackground: "{colors.app-bg}"

  rules:
    - "At the 1280px desktop baseline: 200px sidebar + 1080px main pane"
    - "Main pane fills all remaining viewport width; do not add a 1240px fixed inner wrapper"
    - "Primary content sections use 16px horizontal gutters inside the main pane"
    - "Sidebar remains a white surface"
    - "Topbar is transparent over the main pane"
```

## Rules

- Sidebar width MUST remain 200px on desktop.
- At 1280px viewport width, the main pane MUST resolve to 1080px.
- Main pane width is fluid at wider desktop sizes.
- Main content background uses `#f0f6ff` for the calibrated operational/listing pages.
- Primary white cards sit directly on the app background with 16px page gutters.
- Do not create an extra centered desktop canvas that shrinks the main pane.

-----

# AI Design System — Master

```yaml
version: 2.6
name: AI Design System
purpose: Single source of truth for AI-generated AI Design HTML/React UI
scope: Design rules + privacy-safe skeleton rendering rules
authority:
  primary: "This document"
  externalDesignReferenceRequired: false
  mode: "standalone"
exclude:
  - mock data
  - business logic
  - JavaScript runtime logic
  - role permission logic
  - backend data schema
  - readable mock data or production data
  - navigation labels, routes, menu keys, and real hierarchy
  - page titles, card titles, table labels, column names, field labels, button copy, status text, role names, permission names, customer/product identifiers, financial values, dates, phone numbers, and other business content in design-only mockups
```

This file is the **single source of truth** for AI-generated
AI Design UI. It consolidates the previous multi-layer design package
(v0.1 Core, v0.2 Improved, v0.3 Addon, Combined, and the OS modules)
into one clean, non-redundant document. Every rule appears exactly once.

## How to use this file

- Read it once before generating any UI
- Apply the rules silently — do not narrate them in chat output
- Use existing tokens before inventing new styles
- All sections are in one place; jump via the Table of Contents below

## Table of Contents

```
1.  Core Principles
2.  Design Tokens (contract, CSS vars, colors, typography, radius, spacing)
3.  App Shell
4.  Sidebar System
5.  Full Data Skeleton Privacy System
6.  Topbar & Search
7.  Icon System
8.  Shared Components (buttons, KPI, table, filter bar, side panel, pagination)
9.  Layout System (page header, density, strict grid, allowed/forbidden sections)
10. Page Type System
11. Privacy-Safe Layout Contracts
12. Component Architecture Enforcement
13. Responsive Rules (sidebar, grid, breakpoints, mobile)
14. State & Interaction System (hover/focus/active, loading/empty/error, motion)
15. Chart System
16. Form System
17. Performance Tracking Pattern
18. Accessibility
19. Implementation Mapping & Anti-Drift
20. Runtime Content Boundary
21. AI Design Runtime
22. AI Generation Rules
23. Silent Design Application Rule
24. HTML Generation Checklist
25. AI Correction Rules
26. Final Design Principle
27. Known Gaps
Appendix A — Migration Notes from v0.x
```

-----

# Important Rule

The AI must keep these separated and never blindly merge them:

- **Design rules** = visual system (this file)
- **Product logic** = page behavior
- **Mock data** = demo data only
- **Runtime** = implementation flow

-----

# 0. Usage Rule

AI must:

- Read this file before generating any UI
- Apply the rules silently — do not explain or summarize them in chat unless asked
- Use existing tokens before inventing new styles
- Preserve the AI Design enterprise dashboard look
- Never import Home-only sections into other pages
- Treat this file as the complete visual authority; no external design reference is required
- Do not request or depend on external design-tool links to generate compliant UI

-----

# 1. Core Principles

- Desktop-first enterprise dashboard calibrated to a 1280px reference viewport
- KPI-first hierarchy
- Shared layout shell across all pages
- Sidebar-driven navigation
- Primary deep blue used only for interaction emphasis
- Home-only sections MUST NOT appear on other pages

## Visual Fidelity Rules

- Prefer this Design System over generic dashboard styling
- Use compact enterprise spacing
- Avoid oversized typography
- Avoid excessive shadows
- Use white surfaces for operational dashboards
- Maintain dense information hierarchy
- Use subtle borders instead of strong backgrounds
- Avoid generic SaaS dashboard appearance
- Operational pages must feel dense but readable

-----

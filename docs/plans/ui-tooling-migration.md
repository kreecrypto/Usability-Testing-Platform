# UI-01 — incremental UI tooling migration

Source: user-approved plan / Implement 2026-10-07; live Sheet Feature Tasks UI-01 + UI-01.01–07 (rows186–193). Manual track, not a scheduler queue expansion. Existing gates/tasks retain their status. MAJOR04 lease coordinates the analytics/Heatmap pilot; no auto deployment.

Dependency base: PR143 codex/trial-behavior b765b8442efa3cc4cbe07fc36fc7a903fb1c9ab8. This has @playwright/test1.63 and Next16.3.8. Do not replace with main's older package. Do not include unrelated pending research PRs.

Order: QA baseline → Tailwind4/owned shadcn-style Radix/AH/Lucide foundation → Trial/Heatmap → Home/Demo → existing Projects/Builder → existing Results/Findings/Reports/Retest → participant. Separate commits/PRs follow dependencies.

Tokens remain src/styles/tokens.css --ah-*; Tailwind uses prefix tw and semantic aliases, no Preflight. Existing CSS is retained while consumers migrate. Owned components preserve native semantics, refs, form types, names and styles; legacy appearance retains existing page CSS. New variants consume AH tokens. No backend, auth, data/schema, version/event contract or target geometry changes.

Trial native select filters remain. Expanded map uses Radix Dialog, with labeled title, Escape, focus trap/return and consistent scroll frame. Marker geometry/styles remain original; shared Button is not used for markers. Lucide is decorative unless an accessible label is supplied by its control. Native disclosure/anchors preserve URL behavior.

QA: existing browser recovery/results suite + before/after screenshots on desktop/320/390, axe common routes and expanded states, Chromium full flow and Firefox/WebKit smoke. Fixture data is synthetic, not research gate evidence. Test consent/network/localstorage recovery and exact selected event→Finding→Report, no global horizontal overflow, every zoom, overlapping points, No Data/keyboard-only/mismatch/load failure. Recheck legacy pages before removing any CSS. No lint script. Independent reviewer on exact commits before PR; Preview evidence before COMPLETE. Researcher UI fixtures cannot substitute real account smoke.

Public API, schema, public links and evidence IDs remain unchanged. Scheduler remains PAUSED, Agentic config read_only. User owns merge/Production deploy. Runtime failures classify accurately and block only affected scope.

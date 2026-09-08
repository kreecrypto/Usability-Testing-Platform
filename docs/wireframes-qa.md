# Task 12 verification — 2026-09-08

## Scope

Low-fidelity review artifact, not the production app. Tested locally in the Codex browser. All data is synthetic.

## Checks performed

- Screen catalog matches all 48 IDs in `docs/screen-inventory.md` with no duplicates or additions.
- Rendered all 170 selectable states on desktop and at 390px browser width. Each produced content or an explicit loading skeleton. No document-level horizontal overflow was found; data tables use an intentional internal scroll container.
- Checked all rendered `data-go` destinations against the screen selector inventory.
- Inspected screenshots of Home, Test Builder, Heatmap, and mobile Consent.
- Clicked consent decline: no forward primary action remains.
- Clicked consent accept → task intro → runner → give-up confirmation → feedback.
- Submitted feedback without SEQ: validation displayed and Continue disabled. Selecting a score re-enabled the action and advanced to the next task, whose intro displayed Task 2 and its distinct scenario.
- Checked changed-version publish: Publish disabled, no new version represented; action directs back to prototype checks.
- Checked unsupported heatmap transform: no clusters rendered.
- Checked no-eligible cohort: `2 started − 2 blocked = 0 eligible`; completion/time show unavailable values.
- Checked generated JavaScript syntax, grayscale CSS, external-resource absence, no networking APIs, keyboard focus styles and fixture completion/delta arithmetic with `scripts/check-wireframes.mjs`.

## Review findings resolved

- Validation initially could not recover after correcting an answer. The review now re-enables the primary action after input.
- Prototype instructions now preserve the second-task context.
- The changed-version and failed-preflight states initially retained a passed checklist. They now show pending/failed checks and a disabled publish action.
- Preview-only context persists when previewing participant feedback and has an exit action.
- Analytics unavailable/restricted states retain published-version context.

## Remaining scope outside this task

- Production build/typecheck and dependency pinning: GWD-11.
- Real Figma embed/provider, event collection, transforms, tokens, queues, database authorization and deletion: their existing engineering tasks.
- High-fidelity design and full accessibility testing: subsequent design/QA tasks.
- Human design review can proceed using the Notion embed and GitHub draft PR.

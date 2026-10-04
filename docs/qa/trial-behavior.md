# TRIAL-02 — behavior Trial QA

2026-10-04. Preview-only extension of TRIAL-01 / PR #142. This is a browser-local product trial with a UTP-controlled synthetic target, not a production research release or evidence from Banrao users.

## Repository gates

- `npm run qa`: build (Next.js 16.3.8), typecheck and 303/303 tests passed.
- `npm run check:design-system` and `npm run check:high-fi`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities. Next.js was patched from 16.3.4 to 16.3.8; no framework migration.
- No lint script exists; no lint claim.
- Read-only independent review: lifecycle, bridge, privacy, pending-event recovery, evidence snapshots and geometry checked; no outstanding code blockers.

## Actual local browser evidence

Used the built application on localhost:3022 through native browser interaction. Created a synthetic Project/Test; selected UTP simulation; saved/published v1; consented and completed three tasks. No events were collected before consent. Refresh retained task progress and persisted event IDs. Enter and Space produced actions without pointer coordinates. Browser Back produced a repeated screen visit.

v1: `ad9d1d57-ed41-4b6b-a40c-a296fbc878b7`; submitted session `299b69b9-ee13-44d7-b802-4c660e2357a5`. Results displayed 4 genuine clicks and 2 keyboard actions, separate from reported task outcomes. At 390/320px the parent document did not overflow horizontally.

Scroll geometry verified directly against rendered DOM: mobile houses group viewport 304×598 / document 304×1386; event `7bf3058a-cdcf-41c0-a8a7-13a177aae6bb` at document (82,1036) lies inside the actual house12 button rectangle (33,1014,97.6875,44). The same immutable target render served as Heatmap background.

Created a clearly labelled QA Finding and Report with that exact Heatmap event subset; the Report evidence link reconstructed the selected subset, correct geometry and focused event. Created v2 `06074353-3dbd-49fe-995a-8c31e5404f49`, completed the same tasks, and verified Retest compares only common geometry. Mobile/desktop mismatches showed a reason rather than a fabricated comparison.

## Failure coverage and limitations

Automated tests cover exact origin/window validation, allowlisted payloads/no typed values, consent/current task/submitted gating, duplicate IDs/sequences, quota rejection, stale storage, recovery after another tab accepts a sequence, canonical retry replay, corrupt/legacy stores, report immutability, cross-version and malformed URL evidence, inert preview target, actual input versus synthetic click, and viewport/document grouping. Cross-tab completion recovery preserves pending data until explicit acknowledgement and offers a local unaccepted-events export; unaccepted events never enter metrics.

Storage quota failure is covered by fault-injected storage tests, not claimed as a browser-level quota exhaustion test. Browser-local data is origin/device specific and constrained by available storage. No cross-device invitation or production analytics is implied.

## Preview gate

Vercel Preview `https://usability-testing-platform-9fylkpsc3.vercel.app/trial`, commit `2bf62a9e02c08a8eef0e885f24fde37dc92a6a42`, READY with the exact locally tested tree. All six pull-request GitHub Actions workflows passed (Build, Design System, High-fi, Schema, Authorization and Local Demo).

Actual Preview flow passed Project → save/publish → consent → three tasks → Results → Finding → Report → Retest. Preview v1 `dc65bd83-d43c-474b-8c5a-724a8043f1e2` / submitted session `0870d7a9-dd54-489d-aeaf-efc65a211d50`: 28 persisted events, 4 pointer clicks, 2 keyboard actions; refresh and Back preserved/repeated actual visits. At parent width 390 and 320, scrollWidth matched clientWidth. Mobile click `f4193278-2a80-4361-9eaf-1ce4826faad6` at (82,1036) matched the same house12 background button rectangle described above.

Report `e4d730ef-96e4-49b5-a6cd-bafb5c29a739` linked to exactly one frozen Heatmap event and a three-event path. Both compact links reconstructed the correct evidence subset and keyboard focus. Preview v2 `80fa0e23-6583-4232-9541-803c29957f1d` / submitted session `1b3ac7ff-f4b8-4112-add4-dfd2ac004435` completed all three tasks; Retest compared only common geometry and explained incompatible mobile/desktop groups. No application-origin console errors observed (the initial Vercel SSO page logged a Google identity NetworkError before the share link was used).

This browser pass found a minor builder issue: author CSS could override a hidden URL label. The follow-up conditionally renders URL only for external targets; all 303 tests/build/typecheck/design gates passed again. Verify this UI fix on the final Preview, and record its deployment/commit in the PR and Sheet before COMPLETE.

No Production merge/deploy; FEAT-13.07 and MAJOR-A/B/C remain unchanged. No Supabase migration, researcher API access, Auth/RLS changes or Cloudflare integration.

## TRIAL-02.P1 audit follow-up

Real Chromium DOM regressions now cover Storage.setItem quota injection (test-context only): iframe pauses/removes, answer and in-app leave are blocked, exact pending event retries once and remains after refresh. Two pages sharing one browser context verify stale-tab blocking/reload/rebased unique sequences. Another tab completing the task verifies unaccepted event exclusion, downloaded JSON `accepted:false`, and explicit acknowledgement before recovery. 3/3 passed against local optimized build; baseline 303 tests/build/typecheck passed. This is controlled failure injection, not physical disk exhaustion. Run `npm run build`, `npx playwright install chromium`, then `npm run test:trial:e2e`; CI installs Chromium and runs against its built app. Final Preview remains a separate gate.

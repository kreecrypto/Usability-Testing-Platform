# TRIAL-01 QA — 2026-10-03

Scope: isolated browser-local workflow from main c1be144. No Auth/RLS/API/schema changes; no research feature dependencies. Local QA fixtures are explicitly labelled, not Banrao research findings.

- 290/290 repository tests pass, including six new trial tests covering immutability, resume/idempotency, incomplete/invalid answers, no-score counts, evidence ownership, report snapshot, storage schema/corruption/quota and stale writes.
- Production build + typecheck + AH design-system/high-fi checks pass. No separate lint script.
- Browser localhost:3107: project → website test → publish v1 → participant → refresh after first answer → remaining answers → submit → Results → Finding with exact answer → Report → Retest draft → publish v2 → second participant → Results → compare v1/v2 passed. Initial No Data and missing scores shown explicitly. No target writes performed.
- Mobile 320 and 390: runner and Retest checked with document width equal scroll width (no overflow). Keyboard Tab to external target shows solid focus outline; heading focus moves on navigation/task changes. No console warnings/errors observed.
- Source isolation assertion verifies no fetch/researcher API/Supabase/service credentials in trial route or model. Existing public Demo/Auth/security tests pass.
- Preview verification pending at commit preparation; do not mark COMPLETE or deploy Production until Preview evidence recorded.

Data limitations: browser/origin only, anonymous self-report, no cross-device invitation, no behavioral capture; browser clearing deletes local data. Print/PDF uses browser print. FEAT-13.07 and MAJOR-A/B/C unchanged.

## Preview validation and correction

Initial Preview acd636c (dpl_Ht3R9TNXsD3iTM6qUngTut14gP4p) is READY. GitHub build/demo/authorization/migration jobs pass. Project → publish v1 → participant with refresh → Results → Finding → Report and 320/390 runner checks passed with labelled local QA fixtures. Evidence deep links preserved exact version/response, but browser did not scroll after hydration; corrected by focusing/scrolling the referenced article after local data loads. Commits now also derive writes from the latest saved in-tab snapshot rather than stale rendered state. Local 290 tests/typecheck/build/design checks re-pass. Corrected Preview and Retest verification still pending at this commit. Legacy Cloudflare/Netlify integrations are not part of this Vercel-only trial gate and have not been used.

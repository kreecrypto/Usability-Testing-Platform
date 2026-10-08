# UI-02 — verification

User-approved plan2026-10-08, verification continues2026-10-09 Asia/Bangkok. Feature Tasks194–196 are the planning source. Stacked on unmerged PR152; no merge or Production deployment.

## P1 — loading, context, participant access

Reviewed local f7a54b16153f1beab59f97d9dcd8c9d933d6537b; [PR153](https://github.com/kreecrypto/Usability-Testing-Platform/pull/153) remote a43eabe07272638b583450b718052bc1135b27bd. Equal tree13e4a82e0f72c1a7e1040f262efa73de84e31b40.

Developer and independent Reviewer:313/313unit,21/21targeted Chromium,build/typecheck/design/highfi PASS. READY exactcommit [Preview](https://usability-testing-platform-c454sqjtd.vercel.app):13/13 new adversarial browser tests PASS;4 triggered CI workflows PASS. Errors/retry/401/403, slow out-of-order Workspace/Project/Test/Tasks reads, child/link clearing and disabled dependent actions exercised. Participant invalid vs network/5xx/malformed response tested; retry resumes prior session, flushes the original pending event with identical ID/sequence once, creates no session and emits no preconsent events.

## P2 — entry, touch targets, user-authored names

Code commit838ddcc94b180e39fed8efcc4e5636b7dd672c53. Home uses one six-step workflow, Trial primary CTA and read-only Demo secondary CTA with synthetic/local-only limits. Key navigation/actions use existing AH44px token; map marker and target geometry unchanged. Researcher name/URL fields start blank; project/test POST keeps the same fields with description:null. Existing records untouched.

Developer verification:313/313unit,51/51 full Chromium suite,2/2Firefox/WebKit smoke,build/typecheck/design/highfi PASS. The three new P2 browser tests at1280/320/390 prove destination/labels, keyboard focus,44px targets, no global overflow and exact user-authored POST bodies. Home screenshots at320/1280 visually inspected. Independent P2 Reviewer built code838ddcc and passed23/23 targeted browser tests (P1/P2/accessibility). Final Preview evidence is recorded in the dependent PR and live Sheet before UI-scope completion.

## Limits

No separate lint script. axe covers exercised states and is not complete WCAG certification. Researcher and participant tests intercept APIs with synthetic fixtures; they do not prove real accounts, Supabase persistence, RLS or research release gates. Actual researcher/published-study smoke remains BLOCKED_EXTERNAL. Keep parent UI-02 in QA with that limitation; UI-only subtasks can close only after independent review and exactcommit Preview. FEAT-13.07,MAJOR-A/B/C and Agentic PAUSED/read_only remain unchanged. Protected Preview access URLs/cookies stay private and Preview traces are disabled.

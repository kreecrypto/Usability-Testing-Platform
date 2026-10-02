# IA-01..03 — task-based information architecture

Status: QA; production release gates remain open. IA-04 is backlog only.

User-approved scope: shared Thai navigation on supported routes, concise home/onboarding, builder orientation, version-specific evidence navigation and participant instructions. No API, schema, auth policy, metric formula or public URL changes.

## Implementation

- Home exposes only Home/Projects navigation and a truthful Projects CTA. Recent work stays explicitly limited to five records; items lead to their project's test list because its API has no method/version metadata. Signup/login are visible when signed out.
- Builder context resolves names through existing authorized test/project APIs. Target steps and method activities stay separate. Review and methods expose the same lifecycle labels; draft-only unavailable destinations are explained rather than linked.
- Both result families share version-specific Results/Findings/Report/Retest links and resolved study context. Failed context loads remain explicit. No new global indexes or settings screens are simulated.
- Participant routes keep their independent shell. Method activities explain what to do next; the website runner no longer shows implementation jargon such as approved bridge/outcome.

## Verification

- Local automated suite: 312/312 tests; typecheck/build/design-system/high-fi checks pass after updating two copy-dependent checks to the approved IA.
- Local browser, isolated HTTPS fixture: signed-out home shows login/signup, primary CTA leads to Projects; 390px and 320px have no horizontal overflow; Tab reaches the main menu. Screenshot: UTP-IA-home-mobile.png (local review artifact).
- Local method-builder fixture at 320px resolves the project/test names, shows Thai activity names, and does not expose a website-setup step. Draft results/report/invite steps explain that publishing is required. Duplicate builder navigation discovered in browser review was removed.
- These fixtures are navigation/UI evidence only. They do not establish live researcher access, published/closed lifecycle E2E, production research evidence, screen-reader usability or release readiness. Real-account Preview QA is still required.

## Follow-up gates

Verify all three PRs on their exact heads in CI, then use the final Preview with a real researcher account for draft/published/closed, forbidden, offline/retry, method and legacy versions, findings/report evidence continuity, participant mobile/desktop and keyboard traversal. Record failures separately from No Data. Deploy only after the existing methods migration/release gates pass.

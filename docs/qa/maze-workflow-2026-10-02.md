# IA-05 / IA-06 / IA-07 integration QA — 2 October 2026

Status: implementation in review; not COMPLETE. No Production deployment or migration was performed.

Implemented: server-scoped project/test pagination, literal name search and status filters; exact totals; project edit/archive; a version-aware test overview and metadata edit/archive; separate method selection and method draft initialization with retry retaining the created test ID; shared navigation back to the test; Auth protection for the new /tests route. Existing methods and IA are integrated with researcher Auth #139.

Local evidence:
- `npm test`: 321 passed, 0 failed. Includes new paging, literal-search escaping, exact-count failure, paged version history and sensitive-count persona boundaries.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.3.8.
- `npm run check:design-system` and `npm run check:high-fi`: passed. These are repository checks, not authenticated visual/E2E evidence.
- `npm audit`: zero reported vulnerabilities after upgrading Next.js 16.3.4 to 16.3.8. Advisory: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j. No exploitability claim is made for this app.
- Local browser observed the protected Projects/Test routes refusing to show workspace content when session validation/refresh could not finish without local Auth configuration. This is error-state evidence only; it does not prove a successful signed-in journey.
- Repository has no separate lint script; lint is not claimed.

Outstanding gates:
- BLOCKED_EXTERNAL: real researcher Preview session (Login, Projects, Workspace, Logout, Refresh, Recovery), then FP-01–09 on Production after Auth release.
- BLOCKED_EXTERNAL: development database/billing readiness. Supabase currently exposes only main, status MIGRATIONS_FAILED.
- BLOCKED_SELF_FIXABLE: migration statement reconciliation. Read-only stored hash/name audit is in migration-history-2026-10-02.md; names and differing bytes do not prove semantic equivalence.
- TODO_DEPENDENCY_BLOCKED: FEAT-13.07 / MAJOR-A/B/C / full Production research release. Mixed usability+method Runner remains unsupported and is explicitly shown as unavailable.
- Pending: authenticated Preview desktop/320/390, keyboard/focus, permission/session/network cases, live method journeys, RLS, deletion, immutability, legacy sessions, exact-version evidence/report/retest and production rollback/runtime checks.

Demo remains synthetic and read-only and is not release-gate evidence.

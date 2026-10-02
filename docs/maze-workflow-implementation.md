# IA-05..07 — Project-to-evidence workflow

Source: user-approved plan, 2 October 2026; Sheet Feature Tasks rows 176–178.
Status: IN_PROGRESS. Integration branch only; no production research release.

| Destination | Purpose | Access | Readiness |
|---|---|---|---|
| /projects | Workspace-scoped paginated project index | Researcher JWT + RLS | IA-05 |
| /projects/[projectId] | Project overview and paginated tests | Researcher JWT + RLS | IA-05 |
| /tests/[testId] | Version-specific study entry and next action | Researcher JWT + RLS | IA-06 |
| Existing Builder routes | Draft configuration and review | Authorized writer | FEAT-13 + IA-02 |
| Existing Results/Finding/Report routes | Exact-version evidence | Authorized reader/writer | FEAT-13 + IA-03 |
| /t/[versionId], /m/[versionId] | Participant workflow | Public consent/session contract | Existing links preserved |

Integrate researcher Auth #139 with the existing method/IA stack. Lists use server-side search, status filters, exact authorized counts and pagination rather than a five-item substitute. Test overview lists published versions and drafts, with explicit method-specific destinations. Missing metrics stay unavailable.

QA: API paging/search/filter/count and RLS boundary; version links and legacy data; mobile 320/390, keyboard and session recovery. Run tests/typecheck/build/design checks. Live account and Supabase development-branch QA remain required; MAJOR-A/B/C and FEAT-13.07 block production. No schema change is introduced for IA. Mixed usability/method execution must not be advertised until the existing contract supports a full tested journey.

# Local Demo QA — No Vercel Deployment

This workflow exists to exercise the UTP demo and engineering QA without consuming Vercel deployment quota.

## Authority boundary

- Google Sheet Task List / Task Detail remains planning and acceptance authority.
- GitHub remains implementation and test authority.
- Supabase remains the canonical persistence/auth platform where a test explicitly uses it.
- Vercel Production remains the release/runtime evidence source.
- Local Demo QA MUST NOT be presented as Vercel release evidence and MUST NOT move a release-gated task to COMPLETE by itself.

## Local demo workflow

1. Install pinned dependencies:

   ```bash
   npm install
   ```

2. Run the focused provider-neutral demo QA harness:

   ```bash
   npm run qa:demo
   ```

   The command performs a local Next.js production build, TypeScript typecheck, and the existing non-Figma release QA harness.

3. Start the application locally for interaction review:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

4. For the full repository QA gate, run:

   ```bash
   npm run qa
   ```

## Existing deterministic demo data

The repository already contains `tests/release-qa-fixture.ts`. It creates a provider-neutral synthetic QA fixture with at least 20 sessions and 500 accepted events and covers:

- success_direct
- success_indirect
- failed
- give_up
- timeout
- abandoned
- technical_blocked
- detour/backtrack evidence
- misclick and rage-click evidence
- retry/duplicate delivery
- SEQ and open feedback

`tests/task54-58-nonfigma-release-qa.test.ts` verifies that the fixture exercises metric recomputation and duplicate-delivery safety.

This fixture is engineering/demo test data only. It is deliberately not inserted into Production and is not a substitute for the three source-authorized seed prototypes required by Task 53, real public published-version/session evidence required by Task 22/33, cross-browser/device evidence required by Task 56, human UAT required by Task 59, or Vercel Production evidence required by Task 60.

## What can be verified without Vercel

Local/GitHub QA can verify build, type safety, deterministic event contracts, analytics aggregation, duplicate suppression, retry/idempotency behavior, non-Figma result calculations, local UI flows, and Supabase-backed development/test behavior when explicitly configured.

## What stays blocked until release QA

Do not claim the following from Local Demo QA alone:

- Vercel Production exact-main readiness
- production public-link/session E2E
- production event collector persistence E2E
- live Figma Embed API client-id/origin proof
- physical cross-browser/cross-device matrix
- human usability/UAT Critical=0
- Production Release Gate

## Recommended execution split

Use this sequence during normal implementation:

`Sheet → dependency preflight → GitHub implementation → npm run qa:demo / npm run qa → local interaction review → Supabase QA when required → merge → Vercel only at an explicit release/runtime gate`

This keeps routine development independent from Vercel build quota while preserving the Sheet's release evidence rules.

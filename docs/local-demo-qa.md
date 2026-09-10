# Local Demo QA — No Vercel Deployment

This workflow exists to exercise the UTP demo and engineering QA without requiring Vercel deployment evidence.

## Authority boundary

- Google Sheet Task List / Task Detail remains planning and acceptance authority.
- GitHub remains implementation and test authority.
- Supabase remains the canonical persistence/auth platform where a test explicitly uses it.
- Vercel Production remains the release/runtime evidence source.
- Local Demo QA MUST NOT be presented as Vercel release evidence and MUST NOT move a release-gated task to COMPLETE by itself.

## Evidence labels

Use these labels consistently:

- `DEMO_QA_PASS` — local/GitHub engineering demo checks passed. This is not production evidence.
- `RELEASE_QA_PASS` — reserved for a task whose full Sheet acceptance/release evidence has passed, including required runtime/provider/human evidence.

Never promote `DEMO_QA_PASS` to `RELEASE_QA_PASS` automatically.

## Production safety guard

Every demo QA command runs `npm run check:demo-env` first. The guard fails closed when the environment points at the canonical UTP Production app origin or the canonical UTP Production Supabase project.

The deterministic QA fixture stays in-process test data. Demo QA MUST NOT insert that fixture into Production Supabase.

## Local demo workflow

1. Install pinned dependencies:

   ```bash
   npm ci
   ```

2. Run the focused provider-neutral demo QA harness:

   ```bash
   npm run qa:demo
   ```

   This performs the production-target guard, local Next.js build, TypeScript typecheck, and the existing provider-neutral Task 54/55/58 QA harness.

3. Run the complete GitHub/local engineering gate when preparing a larger change:

   ```bash
   npm run qa:demo:full
   ```

   This performs the production-target guard, AH Design System v2.6 QA, High-fi QA, build, typecheck, and the full repository test suite.

4. Start the application locally for interaction review:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

## GitHub-only workflow

`.github/workflows/local-demo-qa.yml` runs on pull requests and manual dispatch. It uses GitHub-hosted runners only and does not call the Vercel CLI or Vercel APIs.

Important: a connected Vercel Git Integration may independently create a preview deployment when a PR/branch is pushed. This workflow does not control that external integration. If the project owner wants zero Vercel preview consumption, Preview Deployment behavior must be disabled/ignored in the Vercel project integration separately; this repository workflow alone cannot guarantee that.

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

Local/GitHub QA can verify build, type safety, Design System consistency, High-fi static QA, deterministic event contracts, analytics aggregation, duplicate suppression, retry/idempotency behavior, non-Figma result calculations, local UI flows, and explicitly isolated Supabase development/test behavior.

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

`Sheet → dependency preflight → GitHub implementation → npm run qa:demo / npm run qa:demo:full → local interaction review → isolated Supabase QA when required → merge → Vercel only at an explicit release/runtime gate`

This keeps routine development independent from Vercel runtime evidence while preserving the Sheet's release evidence rules.

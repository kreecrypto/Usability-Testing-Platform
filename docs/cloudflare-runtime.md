# Cloudflare Workers Runtime — Historical / Fallback

## Current status

Cloudflare Workers is **not** the active UTP production runtime.

The current Source Governance decision (2026-09-10) is:

```text
GitHub → Vercel Production → Supabase
```

Canonical production origin:

`https://usability-testing-platform.vercel.app/`

This document is retained only for migration history, compatibility QA and rollback/fallback reference. It must not override the Google Sheet Source Governance or `docs/vercel-runtime.md`.

## Historical migration work

A prior 2026-09-09 architecture decision evaluated Cloudflare Workers as the production target for the existing Next.js 16 application using vinext. The repository therefore still contains Cloudflare compatibility artifacts and a Cloudflare migration QA workflow.

Those artifacts may remain useful to prove that the application can build for an alternate runtime, but a successful Cloudflare compatibility build is **not** a current production release requirement unless Source Governance explicitly reactivates Cloudflare.

Historical command sequence:

```bash
npx vinext check
npx vinext init --platform=cloudflare
npm run build:vinext
npx @vinext/cloudflare deploy
```

Historical references:

- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/

## Fallback boundary

If Cloudflare is evaluated again later:

- keep the provider-neutral `/v1/events` collector contract unchanged
- keep Supabase PostgreSQL/Auth as the canonical data boundary unless planning explicitly changes it
- do not expose server-only credentials to participant clients
- require a new preview/runtime/release QA cycle on the exact candidate commit
- do not change the active production origin until Source Governance is updated and the candidate runtime is verified

## Secrets

Cloudflare-specific credentials such as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are optional fallback configuration only. They are not required by the active Vercel production path.

## Supabase boundary

The canonical persistence model remains provider-neutral:

```text
Participant
  → UTP route handler
  → validate / authorize / dedupe / retry
  → Supabase
```

Cloudflare R2 remains optional object storage only when a current task explicitly introduces an object-storage requirement. It is not the canonical relational event store.

## Active runtime reference

See [`vercel-runtime.md`](vercel-runtime.md) for the current production deployment and release contract.

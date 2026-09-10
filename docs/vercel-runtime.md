# Vercel Production Runtime

## Decision

As of 2026-09-10, UTP uses Vercel as the primary production runtime.

```text
GitHub → Vercel Production → Supabase
```

Responsibilities:

- **GitHub**: source code, pull requests, CI and QA evidence.
- **Vercel**: Next.js production runtime, preview deployments and event-collector ingress.
- **Supabase**: PostgreSQL, Auth and canonical persisted application/research data.

Canonical production origin:

`https://usability-testing-platform.vercel.app/`

Production source branch:

`main`

## Git deployment path

Use Git integration as the default release path:

1. Implement changes on a non-production branch.
2. Require repository QA on the exact branch head.
3. Verify the Vercel Preview deployment reaches `READY`.
4. Smoke-test changed routes and required APIs on that preview.
5. Merge the verified PR to `main`.
6. Confirm a production deployment exists for the exact merged-main SHA and reaches `READY`.
7. Verify the canonical production origin, `/api/health`, and any changed runtime/API route.
8. Review Vercel runtime errors/logs for the production deployment.
9. Record exact SHA, deployment ID and QA evidence in the relevant task/release record.

Do not call a release complete from a source merge alone.

## Event collector

The collector remains a hosting-provider-neutral Next.js route handler:

`POST /v1/events`

It must:

- validate single and batched event payloads
- reject malformed or unauthorized requests
- use session-bound ingestion credentials
- preserve stable `eventId` / idempotency behavior
- bound persistence retry
- preserve DLQ/dedupe behavior in Supabase
- never expose server-only Supabase credentials to participant clients

## Environment and secrets

Production values belong in Vercel Environment Variables and must not be committed.

Server-only examples include:

- `SUPABASE_SECRET_KEY` or the supported server-only service-role fallback
- `EVENT_INGESTION_TOKEN_SECRET`
- `EVENT_INGESTION_RATE_LIMIT_PER_MINUTE`

Browser-visible Supabase values remain limited to the existing `NEXT_PUBLIC_*` contract.

`FIGMA_EMBED_CLIENT_ID` is a public client identifier for the simplified live Embed API path after the Vercel production origin is registered in the Figma app's allowed origins. No Figma client secret/token exchange is required for the simplified V1 public-embed path.

## Release verification

Minimum runtime evidence for a production-affecting change:

- exact merged-main SHA identified
- Vercel production deployment `READY`
- canonical domain resolves to that deployment
- changed page/API route returns the expected response
- `/api/health` reports healthy required dependencies when the route is in scope
- no new release-blocking production runtime error cluster
- privacy/auth/data gates remain unchanged or are explicitly re-tested when touched

HTTP smoke is supportive evidence only. It does not replace the required browser/device matrix, human UAT or provider-specific live evidence where the Task Sheet explicitly requires those gates.

## Rollback

Keep the previous verified Vercel production deployment identifiable as the rollback candidate for every production release. If a production regression is found, use the last verified deployment/commit according to the Vercel release procedure and re-run the affected runtime gates.

## Alternate runtimes

Cloudflare Workers compatibility artifacts remain historical/fallback evidence only. See [`cloudflare-runtime.md`](cloudflare-runtime.md). They are not an active production gate unless Source Governance is changed again explicitly.

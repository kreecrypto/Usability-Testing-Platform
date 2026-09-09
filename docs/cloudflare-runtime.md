# Cloudflare Workers Runtime

## Decision

UTP active architecture is:

```text
GitHub → Cloudflare Workers → Supabase
```

Responsibilities:

- **GitHub**: source code, review, CI and QA evidence.
- **Cloudflare Workers**: Next.js application runtime and event-collector ingress.
- **Supabase**: PostgreSQL, Auth and canonical persisted application/research data.

Vercel and Netlify are legacy runtime evidence only after this migration decision. Do not add new Vercel/Netlify runtime dependencies.

## Next.js deployment path

UTP currently targets Next.js 16. Cloudflare's current documented default for existing Next.js 16 applications is **vinext on Cloudflare Workers**.

Required sequence:

```bash
npx vinext check
npx vinext init --platform=cloudflare
npm run build:vinext
npx @vinext/cloudflare deploy
```

Official reference:

- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/

`vinext` is still beta. Compatibility results and runtime QA are therefore release evidence, not optional migration notes.

## Migration safety rule

The old production runtime must remain available until the Cloudflare deployment passes the cutover gate. A migration branch or successful source build alone is **not** production cutover evidence.

### Cutover gate

All must pass:

1. Existing repository QA (`npm run qa`).
2. `vinext check` has no unresolved release-blocking compatibility finding.
3. Workers build succeeds.
4. Cloudflare deployment succeeds.
5. Researcher shell/core routes return expected responses.
6. Participant public-link flow is reachable on desktop and supported mobile viewport.
7. `/v1/events` accepts a valid event and rejects malformed/unauthorized payloads as specified by the event contract.
8. Accepted events persist to Supabase without silent loss or duplicate counting.
9. Supabase Auth/database access-control regression checks pass.
10. Figma Embed allowed-origin configuration is updated to the verified Cloudflare production origin when required.
11. Google Sheet Runtime Source is updated to the verified Cloudflare production URL.
12. Vercel/Netlify are removed from active runtime governance only after rollback-safe verification.

## Secrets

Never commit credentials.

Required deployment values are stored in GitHub Actions / Cloudflare secret stores:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- Supabase server-only credentials required by the application
- `EVENT_INGESTION_TOKEN_SECRET`

Browser-exposed Supabase values remain limited to the existing `NEXT_PUBLIC_*` contract.

## Supabase boundary

The hosting migration does not move canonical application data out of Supabase. Participant clients still must not write raw events directly to Supabase.

```text
Participant
  → Cloudflare-hosted UTP route handler
  → validate / authorize / dedupe / retry
  → Supabase
```

Cloudflare R2 is optional object storage only when a current task explicitly introduces an object-storage requirement. It is not a replacement for the canonical Supabase relational event store by default.

## Rollback

Until the Cloudflare production gate passes, the previous verified runtime can be used as rollback evidence. Once cutover is verified, all new runtime QA must use the Cloudflare production origin and old provider URLs must be marked historical rather than active.

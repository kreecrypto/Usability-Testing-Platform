# Netlify Production Runbook

## Hosting authority

- Production host: Netlify.
- Source branch: `main` only.
- Source repository: `kreecrypto/Usability-Testing-Platform`.
- Supabase remains the application database/storage backend.
- AH Design System v2.6 remains the canonical UI authority and its GitHub QA gates must pass before merge to `main`.
- Keep the current Vercel deployment only as a temporary rollback/fallback until Netlify production verification is complete. Do not promote an older Vercel preview as the current release.

## Build contract

Netlify configuration lives in `/netlify.toml`.

- Build command: `npm run build`
- Publish directory: `.next`
- Node: `24.20.0`, matching `.nvmrc`
- Next.js skew protection: enabled
- Next.js runtime: Netlify OpenNext adapter / native Next.js support

## Free-plan guardrails

To conserve Netlify Free-plan usage:

1. Use `main` as the only Production branch.
2. Keep Deploy Previews disabled unless a specific QA task requires one.
3. Avoid branch deploys for worker/task branches.
4. Do not trigger rebuilds solely for documentation-only changes unless runtime verification is required.
5. Keep secrets in Netlify environment-variable settings; never commit them to `netlify.toml` or source control.

## Production environment variables

Configure values from the existing `.env.example` in Netlify's environment-variable settings. Values are intentionally not documented here.

### Core application / Supabase

- `NEXT_PUBLIC_APP_URL` — set to the final Netlify Production URL/domain.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — legacy fallback only while still required.
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

### Figma simplified V1

- `FIGMA_EMBED_CLIENT_ID` — required only for the Live Embed API/event preflight path. Basic public embed does not require a credential.

Deferred/legacy OAuth proof variables should remain unset unless that path is deliberately enabled:

- `FIGMA_CLIENT_ID`
- `FIGMA_CLIENT_SECRET`
- `FIGMA_REDIRECT_URI`
- `FIGMA_POC_FILE_KEY`
- `FIGMA_POC_VERSION_ID`
- `FIGMA_POC_START_NODE_ID`

### Event ingestion

- `NEXT_PUBLIC_EVENT_COLLECTOR_URL=/v1/events`
- `EVENT_INGESTION_TOKEN_SECRET`
- `EVENT_INGESTION_RATE_LIMIT_PER_MINUTE`

### Cloudflare R2

Do not configure the legacy Cloudflare R2 variables for the current UTP production architecture unless a current task/source explicitly reintroduces that provider.

## Release gate

Before treating a Netlify deployment as Production-ready:

1. Confirm deployment source is the current `main` HEAD.
2. Confirm GitHub Build QA passes for the release source.
3. Confirm AH Design System v2.6 QA passes.
4. Confirm High-fi QA passes.
5. Confirm schema/security gates required by the current release are green.
6. Confirm Netlify build reaches a ready/published state.
7. Request `/api/health` from the Netlify Production URL and require HTTP 200.
8. Require `supabaseDatabase = ok` and `supabaseStorage = ok` in the health payload.
9. Smoke-test the public participant route and server API behavior used by the current release.
10. Do not delete or disconnect Vercel until the Netlify production route is verified and rollback evidence exists.

## Rollback

If Netlify production verification fails:

- Do not change Supabase schema/data to compensate for a hosting failure.
- Roll back to the last known-good Netlify deployment when one exists.
- Until the first Netlify release is verified, keep the existing healthy Vercel production deployment available as the temporary fallback.
- Preserve stable IDs, session/event contracts, and RLS/security behavior during any hosting rollback.

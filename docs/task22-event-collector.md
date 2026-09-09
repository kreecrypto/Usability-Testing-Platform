# Task 22 — Vercel Event Collector with Supabase Persistence

## Status

The source-supported HTTP boundary is wired to a Next.js/Vercel route and a server-only Supabase persistence adapter. Runtime completion now proceeds against a fresh Vercel deployment after environment configuration was added by the project owner on 2026-09-09.

## Canonical sources

- Planning acceptance: Task 22 in the Google Sheet — collector accepts validated events, rejects malformed input, and does not expose database credentials.
- `docs/architecture.md` — participant clients do not write raw events directly to the main database; the collector validates payloads and protects database credentials.
- `docs/event-contract.md` — canonical raw event envelope is schema v2; `receivedAt` is collector-assigned and must not be trusted from participant input.
- `docs/database-schema.md` and Task 20 migrations — `public.events` is the canonical event persistence surface and tenant identity is represented by `workspace_id` plus session/test context.
- Supabase official security guidance — secret/service-role credentials are server-only and must never be exposed to browsers.
- Vercel/Next.js runtime — App Router route handlers are the production HTTP deployment target for this repository.

## Implemented boundary

`src/lib/collector/event-collector.ts` provides the deterministic request/validation boundary:

- `POST /v1/events` only.
- `application/json` only.
- validates the canonical v2 raw event envelope.
- rejects derived events at the raw collector boundary.
- rejects client-supplied `receivedAt`.
- assigns `receivedAt` server-side only after validation.
- maps persistence failures to generic `503 ingestion_unavailable` without returning raw error text or credentials.

`src/app/v1/events/route.ts` exposes that handler as the Vercel/Next.js route and reads only server-side environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Neither variable is prefixed with `NEXT_PUBLIC_` and neither is returned to the participant client.

## Supabase persistence boundary

`src/lib/collector/supabase-event-persistence.ts` deliberately does **not** accept `workspaceId` from the event payload.

For each accepted event it:

1. resolves the canonical session from `public.sessions` using the server credential;
2. obtains trusted `workspace_id`, `participant_id`, `test_id`, and `test_version_id` from that session;
3. rejects the write if participant/test/version in the event do not match the stored session context;
4. maps the accepted event through `toEventStorageRow(...)`;
5. inserts the row into `public.events` using the server-only credential.

This prevents a participant payload from spoofing a different workspace while preserving the canonical Event Contract, which intentionally does not contain a client-controlled workspace ID.

## Responsibility boundary with later tasks

Task 22 covers validated single-event ingestion and secure persistence. It does not invent batching, client/network retry policy, DLQ behavior, or duplicate retry orchestration; those remain Task 23 / GWD-07 scope. Existing database uniqueness constraints remain the persistence safety baseline but are not used to claim Task 23 COMPLETE.

## QA evidence required before COMPLETE

Repository QA:

- valid canonical raw event is persisted before `202 accepted`;
- malformed/derived/spoofed `receivedAt` input is rejected;
- invalid JSON/content-type/method/route cases are explicit;
- database/provider failures return generic `503` with no secret/error leakage;
- Supabase adapter resolves workspace from the trusted session;
- participant/test/version mismatch is rejected before event insertion;
- build, typecheck, and tests pass on the same PR head.

Hosted/runtime QA:

- dedicated Supabase UTP project `qryvrcwbsehrzpersuoc` contains the Task 20 schema and Task 21 RLS/grants;
- Vercel project `usability-testing-platform` is linked to this GitHub repository;
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured as server-only Vercel environment variables;
- deployed `/v1/events` rejects malformed input;
- a valid fixture tied to an existing session persists exactly one row into `public.events` and returns `202`;
- failure responses and logs do not expose the Supabase secret or raw database error.

Until the hosted valid-persistence test is proven on the fresh deployment, Task 22 must remain `IN_PROGRESS`/`QA`, not `COMPLETE`.

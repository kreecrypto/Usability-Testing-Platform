# Task 26 — Storage, Logging & Observability

## Source boundary

Planning requires `R2/logging/error trace/health check` so the session pipeline can be debugged. The active implementation architecture is Vercel + Supabase. No current canonical source defines an R2 account, bucket, binding, retention policy, object contract, or even whether R2 remains the intended storage provider. Therefore this change does **not** invent or provision storage. That part remains a SOURCE GAP.

## Implemented

- `GET /api/health` performs a bounded server-side Supabase connectivity check against the existing `sessions` table.
- Health responses expose only coarse dependency state (`ok`, `misconfigured`, `unreachable`) plus a request correlation ID; credentials and provider error bodies are never returned.
- Health responses are non-cacheable and return HTTP 503 when the event-persistence dependency is not healthy.
- `writePipelineLog` emits one-line structured JSON suitable for Vercel runtime logs with request/session/test-version/event correlation fields.
- Structured logs deliberately exclude request bodies, bearer tokens, Supabase keys, stack traces and provider error bodies.

## Debug workflow

1. Start with `/api/health` and capture `requestId`.
2. Correlate the request ID in Vercel runtime logs.
3. When a session/event identifier is known, use the structured logger context fields rather than logging event payloads.
4. Use Supabase data as the persistence source of truth; do not copy raw participant payloads into logs.

## Remaining source gap

Storage/R2 is not implemented until planning identifies the current provider and defines the artifact/object contract, retention and access boundary. This gap must not be closed by assumption.

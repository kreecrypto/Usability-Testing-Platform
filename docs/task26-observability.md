# Task 26 — Storage, Logging & Observability

## Source boundary

Planning now requires `Supabase Storage readiness/logging/error trace/health check` so the session pipeline can be debugged. The active implementation architecture is Vercel + Supabase.

Structured session, event, and answer data remains in Supabase Postgres. Supabase Storage is treated as the file/blob storage provider, but the current V1 source does not define any file/blob artifact that requires a bucket yet. Therefore Task 26 verifies Storage service readiness without inventing a bucket, object path, MIME contract, or retention rule.

## Implemented

- `GET /api/health` performs bounded server-side checks for both Supabase Postgres and Supabase Storage.
- The database check verifies the existing `sessions` persistence dependency.
- The Storage check calls the Supabase Storage bucket-list endpoint using server-only credentials. An empty bucket list is valid readiness; no bucket is created solely for health checking.
- Health responses expose only coarse dependency state (`ok`, `misconfigured`, `unreachable`) plus a request correlation ID; credentials and provider error bodies are never returned.
- Health responses are non-cacheable and return HTTP 503 when either required Supabase dependency is not healthy.
- `writePipelineLog` emits one-line structured JSON suitable for Vercel runtime logs with request/session/test-version/event correlation fields.
- Structured logs deliberately exclude request bodies, bearer tokens, Supabase keys, stack traces and provider error bodies.

## Debug workflow

1. Start with `/api/health` and capture `requestId`.
2. Verify both `supabaseDatabase` and `supabaseStorage` are `ok`.
3. Correlate the request ID in Vercel runtime logs.
4. When a session/event identifier is known, use the structured logger context fields rather than logging event payloads.
5. Use Supabase Postgres as the persistence source of truth for structured session data; do not copy raw participant payloads into logs or Storage.

## Storage boundary

No Storage bucket is provisioned until a V1 task introduces a real file/blob artifact requirement. When that happens, the owning task must define bucket visibility, object naming, MIME/size constraints, retention, and access policy before implementation.

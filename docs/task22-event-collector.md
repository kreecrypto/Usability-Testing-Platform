# Task 22 — Cloudflare Event Collector

## Status

Implementation is intentionally limited to the source-supported HTTP/validation boundary.

## Canonical sources

- Planning acceptance: Task 22 in the Google Sheet — collector accepts validated events, rejects malformed input, and does not expose database credentials.
- `docs/architecture.md` — participant clients do not write raw events directly to the main database; the collector validates payloads and protects database credentials.
- `docs/event-contract.md` — canonical raw event envelope is schema v2; `receivedAt` is collector-assigned and must not be trusted from participant input.
- Cloudflare Workers documentation — Workers use the Fetch `Request`/`Response` handler model; sensitive values belong in encrypted secrets/bindings rather than plaintext configuration.

## Implemented boundary

`src/lib/collector/event-collector.ts` provides a Cloudflare-Worker-compatible Fetch API handler core:

- `POST /v1/events` only.
- `application/json` only.
- validates the canonical v2 raw event envelope.
- rejects derived events at the raw collector boundary.
- rejects client-supplied `receivedAt`.
- assigns `receivedAt` server-side only after validation.
- calls an injected server-side persistence adapter before returning `202 accepted`.
- maps persistence failures to a generic `503 ingestion_unavailable` response without returning raw error text or credentials.
- does not place database URLs, passwords, service-role keys, or provider tokens in client-visible code or responses.

## Explicit SOURCE GAP

The current planning source, architecture, and repository do **not** define the concrete production persistence binding for Task 22 (for example Cloudflare Queue, Service Binding, Hyperdrive/direct PostgreSQL, or a Supabase server-side REST adapter). Choosing one here would be a new architecture decision and would overlap later Task 23 / GWD-07 responsibilities around batching, retry, idempotency, queue semantics and DLQ.

Therefore this task does **not** invent or commit a Wrangler production binding, database credential, queue name, or deployment target. The injected `PersistAcceptedEvent` boundary keeps validation deterministic while allowing the later source-authorized persistence/queue design to be attached without changing the event contract.

## QA evidence required before COMPLETE

- contract/unit tests for valid, malformed, derived, spoofed `receivedAt`, invalid JSON/content-type/method/route and persistence error cases;
- repository build/typecheck/test green on the same head;
- concrete production persistence binding selected from an authoritative source;
- Cloudflare deployment/runtime evidence showing the Worker accepts valid input and rejects invalid input without leaking secrets.

Until the concrete binding/deployment evidence exists, Task 22 must remain `IN_PROGRESS` rather than `COMPLETE`.

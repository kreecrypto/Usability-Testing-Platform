# Event Persistence Mapping

## Status

Canonical companion to `docs/event-contract.md` for Event Contract v2 persistence.

The application envelope uses camelCase TypeScript fields. PostgreSQL storage uses snake_case columns. The mapping below is explicit and round-trip tested; no required event identity field may be silently discarded into an opaque payload.

## Canonical mapping

| Event Contract v2 | PostgreSQL `public.events` | Rule |
| --- | --- | --- |
| `schemaVersion` | `schema_version` | Numeric integer. V2 is `2` end-to-end. |
| `eventId` | `event_id` | Primary event identity. |
| `idempotencyKey` | `idempotency_key` | Unique per session. |
| `eventType` | `event_name` | Canonical raw/derived event name. |
| `eventLayer` | `event_layer` | `raw` or `derived`. |
| `source` | `source` | Collector-validated source enum. |
| `occurredAt` | `occurred_at` | Source lifecycle/interaction time. |
| collector `receivedAt` | `received_at` | Server acceptance time; never trusted from participant input. |
| `sequence` | `sequence` | Required for raw events; null for derived events. |
| workspace context | `workspace_id` | Server-resolved tenant context; not trusted from participant input. |
| `sessionId` | `session_id` | Bound to workspace/test/version/participant context by FK. |
| `participantId` | `participant_id` | Explicit column; must match session context. |
| `testId` | `test_id` | Explicit column; must match session context. |
| `testVersionId` | `test_version_id` | Explicit column; must match session context. |
| `taskId` | `task_id` | Optional; when present must belong to the same workspace/test version. |
| `screenId` | `screen_id` | Optional canonical internal screen ID. |
| `metadata` | `payload` | Provider-neutral or adapter metadata only; required identity fields stay in columns. |
| `derivedFromEventIds` | `derived_from_event_ids` | Required non-empty provenance for derived events. |
| `ruleVersion` | `rule_version` | Required for derived events. |

## Integrity rules

1. `schemaVersion` is numeric in application and storage. Do not persist `"v2"` strings.
2. A persisted event is bound to exactly one workspace, session, participant, test and test version.
3. When `task_id` is present, the task must belong to the same workspace and test version as the event.
4. Raw events require a non-negative sequence and have no derived provenance.
5. Derived events require provenance IDs and a rule version; sequence is null.
6. `metadata` is not a fallback for missing identity/context fields.
7. The TypeScript adapter in `src/lib/tracking/persistence.ts` is the canonical serializer/deserializer and is covered by round-trip tests.

## No Data / analytics boundary

Persistence does not convert absence into zero. Analytics helpers return `null` for percentage metrics without an eligible denominator, allowing UI layers to render `N/A`, `No eligible data`, or another explicit no-data state instead of `0%`.

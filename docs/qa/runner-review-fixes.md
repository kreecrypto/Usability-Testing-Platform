# Runner review fixes

Scope: the four review findings authorized by the user, on codex/project-handoff.

- Bootstrap no longer depends on a callback whose identity changes with the fetched snapshot. An Effect Event performs recovery using the loaded snapshot without restarting bootstrap after every response.
- Outbox read/modify/write operations are serialized, including acknowledgement removal. Network upload remains outside the mutation queue so new events can be persisted while offline or while an upload is pending.
- Recovery checks both test ID and immutable version ID before configuring a runtime. A cookie for another test leads to consent instead of silently resuming that session.
- Timeout uses the original task-start timestamp, restored from session state or pending task-start evidence. Opening/dismissing give-up confirmation and reloading no longer grant a fresh timeout interval.

Validation: npm run qa passed (production build, typecheck, 199 tests, zero failures). Five new regressions cover concurrent enqueue (100 events), enqueue during upload, storage-failure recovery, cross-test/version rejection, and deadline preservation/expiry. Bootstrap dependency wiring was inspected in the diff; no browser E2E pass is claimed. The repository has no lint script.

Remaining release evidence: real published-test E2E and production public-test API 502 investigation remain open. These fixes do not claim Task33 or V1 release COMPLETE. Outbox serialization is scoped to one runtime; multi-tab coordination is not established by these tests.

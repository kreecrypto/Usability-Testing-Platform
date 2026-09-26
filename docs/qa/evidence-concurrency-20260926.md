# Evidence delivery concurrency — 2026-09-26

Status: QA; MT-09 is not COMPLETE.

Requirement: accepted events must not be silently lost or duplicate counted; Figma evidence must preserve behavior ordering and timestamps. Baseline main: 878ab848.

The outbox now serializes storage read-modify-write operations. Acknowledging a batch reads the latest queue under the same serialization so concurrent enqueue cannot be overwritten. Failed storage mutations leave retries usable. Figma message handling serializes async sinks while capturing arrival time before waiting.

Validation: npm run qa passed: production build, typecheck, 269/269 tests. Added coverage for 100 concurrent enqueue calls, enqueue during upload acknowledgement, storage failure recovery, overlapping Figma messages, and arrival timestamps. The uploaded Git tree must match the tested local tree.

Limits: serialization is per outbox instance, not a cross-tab lock. Real provider/browser QA and remaining MT-09 authoritative target provenance work are still pending. No production evidence or release completion is claimed.

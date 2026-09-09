# Tasks 33–43 — Participant Runner & Tracking Implementation Notes

## Source boundary

This implementation follows the current UTP Google Sheet for task requirements and dependencies, the repository contracts for event/privacy/analytics behavior, and official Figma/Supabase capability boundaries already captured by GWD tasks.

Production/runtime behavior is evidence only and is not used to invent requirements.

## Task 33 — Public link and anonymous session

- Public participant route: `/t/:testVersionId`.
- Public snapshot resolves only an immutable `published` internal test version.
- No participant login is required.
- Consent acceptance creates an opaque participant UUID and session through a server-only atomic RPC.
- The browser receives a short-lived session/version-bound event-ingestion token. The signing secret and Supabase server secret never enter participant code.
- A signed HttpOnly runner proof supports recovery/token refresh without a global shared client secret.

## Task 34 — Consent and access/device gate

- No behavioral event is emitted before affirmative consent.
- Consent decline creates no session and no eligible usability attempt.
- The V1 disclosure covers task interactions, navigation/path, pointer evidence, time, task outcome, SEQ, and optional feedback, matching `docs/privacy-baseline.md`.
- Runtime capability checks are limited to APIs actually required by the implementation; there is no guessed user-agent/device blacklist.
- Figma login/password/unconfigured live Embed API states are classified as `technical_blocked`, never product usability failure.

### External dependency

GWD-02/GWD-10 configuration evidence is still required for a release-gate pass of the live Figma Embed API path. The runner fails closed when that capability is unavailable.

## Tasks 35–37 — Participant flow

The production runner implements the canonical P01–P12 inventory:

- P01 Access Check
- P02 Consent
- P03 Task Intro
- P04 Prototype Runner
- P05 Give Up Confirmation
- P06 Post-task Feedback
- P07 Next Task Transition
- P08 Complete / Thank You
- P09 Invalid / Closed Link
- P10 Technical Blocked
- P11 Timeout
- P12 Recovery / Resume

Participant payloads deliberately exclude `expected_path`, `success_rule`, and `failure_rule`. Those remain database-side inputs to deterministic outcome derivation.

Post-task SEQ/Open Feedback is idempotent by `(session_id, task_id, question_key)`. `task_sessions.feedback_submitted_at` records that P06 was submitted even when optional fields are left blank, avoiding repeated feedback/completion after reload.

## Task 38 — Lifecycle

Browser collection is raw-only. Canonical raw events include session/task start and terminal signals. Sequence is strictly increasing within one session and recovery continues above both the last accepted server sequence and any durable pending-outbox sequence.

`task_success` and `task_failed` are derived server-side from the immutable published task rules and accepted raw evidence. The database projection uses first-terminal-wins semantics so one task receives only one canonical terminal outcome.

## Task 39 — Pointer coordinates

`src/lib/tracking/pointer-normalization.ts` integrates the versioned GWD-05 `figma-heatmap-v1` transform and preserves raw target/scroller/offset provider evidence while adding normalized `0..1` coordinates.

### SOURCE / CAPABILITY GAP

GWD-05 explicitly requires an immutable caller-supplied Figma geometry snapshot bound to the published version and explicitly forbids manufacturing coordinates when geometry is unavailable. The simplified V1 publish path currently does not provide that geometry snapshot.

Therefore the participant runner does **not** substitute browser CSS pixels and does **not** claim production heatmap coordinates. Task 39 remains release-blocked until a source-supported immutable geometry snapshot is available.

## Task 40 — Screen/navigation

Figma `PRESENTED_NODE_CHANGED` is normalized to `screen_view` with current/previous screen IDs and provider navigation metadata. No universal raw browser/Figma back/forward event is fabricated. Backtrack remains a derived path signal.

## Task 41 — Friction detection

The database derives separate `misclick`, `rage_click`, and `backtrack` rows from accepted raw evidence.

### SOURCE GAP — thresholds

Current planning sources require deterministic, testable, versioned detection but do not specify canonical thresholds. The implemented candidate rules are therefore explicitly **PROPOSED**, not requirements:

- `figma-handled-misclick-v1`: Figma pointer evidence has `handled=false`.
- `immediate-aba-backtrack-v1`: immediate screen path `A → B → A`.
- `rage-click-v1`: at least 3 canonical pointer interactions within 1000 ms and normalized radius 0.04.

These values must not be promoted to canonical product behavior without Source-of-Truth approval.

## Task 42 — Time and scroll

`lifecycle-time-v1` derives:

- time on task from `task_started.occurredAt` to first terminal evidence;
- time on screen from one `screen_view.occurredAt` to the next screen or relevant terminal event.

No idle-adjusted value is claimed without a separately versioned idle rule. Figma V1 does not synthesize continuous `scroll` events from pointer offset evidence.

## Task 43 — Offline retry and de-duplication

The browser local outbox persists original events with stable `eventId` and `idempotencyKey`, refreshes a short-lived session-bound credential for delivery, and removes an event only after accepted delivery.

Backend persistence retains:

- primary `event_id` identity;
- unique `(session_id, idempotency_key)`;
- unique raw `(session_id, sequence)`;
- bounded reliable persistence retry;
- dead-letter recording after retry exhaustion.

This implements at-least-once delivery safety without allowing retries to add duplicate raw rows or metrics.

## QA evidence

PR #40 exact-head QA must pass all three repository gates before merge:

1. GWD-11 Build QA — build, typecheck, tests, deterministic lockfile.
2. Task 20 Schema QA — migration/schema contract.
3. Task 21 Authorization QA — PostgreSQL migration application plus RLS/grants/role matrix.

Release-gated tasks still require their external/runtime evidence and unresolved Source/Capability gaps to be closed before `COMPLETE`.

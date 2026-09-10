# V1 Architecture

## Active platform boundaries

```text
GitHub
  ├─ source code
  └─ CI / QA

Vercel Production
  ├─ Next.js runtime
  └─ Event Collector

Supabase
  ├─ PostgreSQL
  └─ Auth
```

The active production origin is `https://usability-testing-platform.vercel.app/` and production must be built from the repository `main` branch. Cloudflare Workers and Netlify are historical/fallback runtime evidence only unless the Google Sheet Source Governance explicitly reactivates them.

## Product loop

```text
Researcher
  ↓
Test Builder
  ↓
Published Test Version
  ↓
Participant Runner
  ↓
Event Collector
  ↓
Raw Events
  ↓
Aggregation
  ↓
Analytics
  ↓
UX Findings
  ↓
Retest Comparison
```

## System boundaries

### 1. Researcher application

Next.js application running on Vercel Production and used by UX designers and researchers to:

- manage projects and tests
- import Figma prototypes
- define tasks and scenarios
- configure success/failure rules
- preview and publish immutable test versions
- inspect results, sessions, heatmaps, paths and findings

### 2. Participant runner

A minimal test runtime that:

- opens from a public test link
- collects consent before behavioral tracking
- creates an anonymous participant/session identifier
- presents task instructions
- embeds the prototype
- emits normalized behavioral events
- records terminal task states: success, failed, give-up, timeout, abandoned
- collects post-task SEQ and open feedback

### 3. Event collector

Vercel-hosted Next.js route-handler boundary responsible for:

- validating single-event and batch event payloads
- rejecting malformed or unauthorized payloads
- assigning server-owned receipt metadata
- retrying transient persistence failures with a bounded policy
- suppressing duplicate same-batch idempotency keys before a second write
- passing accepted events to Supabase persistence
- protecting database credentials from participant clients

Participant clients must not write raw events directly to the main database.

The application-facing collector contract remains provider-neutral (`/v1/events`). Hosting changes must not leak provider-specific identifiers into analytics contracts.

### 4. Main database

Supabase PostgreSQL stores application state and canonical research data. Supabase remains the database/Auth boundary independently of the hosting provider.

Baseline entities:

```text
users
workspaces
workspace_members
projects
tests
test_versions
test_blocks
tasks
task_success_rules
prototypes
prototype_frames
participants
sessions
task_sessions
events
answers
findings
retest_comparisons
```

Derived analytics may be materialized separately from raw events.

### 5. Analytics pipeline

Analytics must remain reproducible from raw events.

Derived output includes:

- completion rate
- median / P75 / P90 time on task
- misclick rate
- give-up rate
- drop-off rate
- path / detour analysis
- backtracking
- heatmap points
- session timelines
- SEQ score
- retest delta

### 6. Figma integration

The integration layer owns:

- public prototype embedding for simplified V1
- optional OAuth / REST metadata integration only when explicitly enabled
- URL parsing
- start-point configuration
- frame metadata mapping
- supported interaction/navigation bridge
- explicit fallback behavior for unsupported prototype events

Figma-specific identifiers should not leak into analytics contracts when an internal screen/frame identifier can be used instead.

## Data flow

```text
Participant Runner (Vercel)
    │
    ├─ local event buffer
    │
    ▼
Vercel Event Collector (/v1/events)
    │
    ├─ validate
    ├─ authorize / rate-limit
    ├─ assign receivedAt
    ├─ dedupe / retry
    └─ persist to Supabase
    │
    ▼
Supabase Raw Event Store
    │
    ▼
Aggregation Pipeline
    │
    ├─ task metrics
    ├─ session metrics
    ├─ path graph
    └─ heatmap dataset
    │
    ▼
Researcher Results UI (Vercel)
```

## Vercel production deployment

UTP is a Next.js 16 application connected to Vercel through Git integration.

Production sequence:

1. Work on a non-production branch and obtain the Vercel Preview deployment.
2. Run the existing repository QA gates on the exact branch head.
3. Verify preview routes and UX/runtime behavior required by the change.
4. Merge the verified branch into `main`.
5. Confirm the exact merged-main deployment reaches Vercel `READY` with target `production`.
6. Smoke-test the canonical production origin and required API/health routes.
7. Check production runtime errors/logs for regressions.
8. Record release evidence without treating HTTP smoke as a substitute for browser/device-matrix or UAT gates.

See [`vercel-runtime.md`](vercel-runtime.md) for the operational contract. [`cloudflare-runtime.md`](cloudflare-runtime.md) is retained for historical/fallback compatibility only.

## Versioning rule

Published tests are immutable.

Editing a published test creates a new draft/version. Historical sessions always resolve against the exact test version used when the session started.

## Privacy baseline

- consent before behavioral tracking
- anonymous participant identity by default
- no unnecessary PII
- configurable retention
- delete participant/session data
- separate explicit consent if screen, microphone, camera or voice recording is added later

## Release invariants

V1 cannot ship unless:

1. Event ingestion does not silently lose or duplicate accepted events; retries use stable `eventId`/`idempotencyKey` and the database uniqueness gate.
2. Task terminal-state classification is deterministic.
3. Dashboard metrics can be recomputed from raw events.
4. Participant Runner works on the supported mobile/desktop matrix.
5. Workspace isolation and public-link access are security-tested.
6. Critical UX issues in the platform itself are zero at release gate.
7. The exact-main Vercel production deployment is `READY` and required route, event-ingestion, responsive and regression QA evidence has passed.

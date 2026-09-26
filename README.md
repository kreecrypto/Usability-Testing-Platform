# Usability Testing Platform

Usability Testing & UX QA Platform for multi-target usability studies.

## Product goal

Create a focused workflow for UX teams:

`Test Target → Test → Behavior → Evidence → Friction → UX Finding → Fix → Retest`

A Test Target may be a Figma prototype, an owned UAT/Production website, or a supported external website. Provider capability must be preflighted; unsupported evidence must fail closed rather than being fabricated.

## V1 scope

- Project and test management
- Provider-neutral Test Target import and preflight
- Figma prototype import / embed
- Owned UAT / Production website targets
- Supported external website targets with explicit capability boundaries
- Immutable published Test Version + Target Snapshot
- Task/scenario builder
- Provider-capability-aware success/failure/give-up/timeout rules
- Participant test link without mandatory account creation
- Consent and anonymous participant sessions
- Provider-adapter Participant Runner
- Event tracking and duplicate-safe ingestion
- Completion rate and time on task
- Click / misclick analysis where supported
- Path / detour analysis where supported
- Heatmaps where supported
- Funnel / drop-off analysis
- Session detail
- Post-task SEQ + open feedback
- UX findings with severity and evidence
- First-class Usability Report with evidence drill-down
- Retest comparison

## Out of scope for V1

- Participant recruitment marketplace
- Moderated interviews
- Research repository
- Full survey builder
- Card sorting
- Tree testing
- Enterprise SSO
- AI moderator

## Architecture direction

UTP uses four active source/runtime boundaries:

- **Planning / execution:** Google Sheet — Usability Testing Platform — Task List
- **Source / CI:** GitHub
- **Frontend + runtime:** Vercel Production
- **Main database / auth:** Supabase PostgreSQL

Runtime components:

- Event collector: Vercel-hosted Next.js route handler (`/v1/events`)
- Event aggregation: Supabase/PostgreSQL-derived analytics pipeline
- Storage: Supabase-backed application data stores unless a current task explicitly requires another store
- Target integration: provider adapters such as Figma Embed / first-party instrumentation / supported external web boundary

Canonical production origin:

`https://usability-testing-platform.vercel.app/`

Production source branch:

`main`

Vercel is the active production host; Supabase is the data and auth provider. Historical deployment experiments do not override current Sheet governance.

See:
- [architecture](docs/architecture.md)
- [Test Target contract](docs/test-target-contract.md)
- [research evidence/report contract](docs/research-evidence-report-contract.md)
- [Proof Gate execution](docs/proof-gate-execution.md)
- [MAJOR-only AUTO execution](docs/major-auto-execution.md)
- [Vercel runtime contract](docs/vercel-runtime.md)

## Core modules

1. **Study Setup** — configure Target, tasks, rules and publish immutable test versions.
2. **Participant Experience** — execute studies with minimal UI interference and explicit technical-block handling.
3. **Behavior & Evidence** — capture trustworthy provider-aware canonical evidence.
4. **Analytics** — derive reproducible, capability-aware metrics.
5. **Findings & Report** — turn evidence into researcher-authored UX findings and a traceable report.
6. **Fix & Retest** — compare compatible before/after evidence.

## Release proof model

V1 launch is governed by three proof gates:

`Flow Proven → Evidence Proven → Adversarial Proven → Task 60 Launch`

- **Flow Proven:** one real Production study can run end-to-end.
- **Evidence Proven:** reportable claims are reproducible and traceable to accepted evidence.
- **Adversarial Proven:** refresh/retry/abandon/provider/auth/device/load failures recover safely or fail closed without corrupting evidence.

Task 60 depends directly on all three proof gates. Fixture-only or mock-only evidence cannot close the gates.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For deterministic local engineering QA without deployment:

```bash
npm run qa:demo
```

This is development/test evidence only. It does not replace Production proof, real participant evidence, provider/browser/device QA, or human UAT required by the Sheet.

## Environment

Copy `.env.example` to `.env.local` and add development credentials when integrations are enabled. Production secrets belong in Vercel Environment Variables and must never be committed. Supabase server credentials remain server-only; browser-visible values use only the approved `NEXT_PUBLIC_*` contract.

## Source of truth

- **Planning / priority / dependency / acceptance / release gates:** Google Sheet **Usability Testing Platform — Task List**
- **Implementation / technical docs / migrations / tests:** GitHub
- **Canonical persisted application and research data / Auth:** Supabase
- **Runtime evidence:** Vercel Production

Planning requirements must not be guessed from code. Runtime behavior must not be used as requirement authority.

## Low-fidelity wireframes

Open `public/wireframes/index.html` directly in a browser, or `/wireframes/` with the app running. See [wireframe guide](docs/wireframes.md) and [verification notes](docs/wireframes-qa.md).

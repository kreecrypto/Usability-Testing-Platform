# Usability Testing Platform

Usability Testing & UX QA Platform for prototype-based usability studies.

## Product goal

Create a focused workflow for UX teams:

`Prototype → Test → Behavior → Friction → UX Finding → Fix → Retest`

## V1 scope

- Project and test management
- Figma prototype import
- Task/scenario builder
- Start, success, failure and give-up rules
- Participant test link without mandatory account creation
- Consent and anonymous participant sessions
- Event tracking
- Completion rate and time on task
- Click / misclick analysis
- Path / detour analysis
- Heatmaps
- Funnel / drop-off analysis
- Session detail
- Post-task SEQ + open feedback
- UX findings with severity and evidence
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

UTP uses three active platform boundaries:

- Source / CI: GitHub
- Frontend + runtime: Cloudflare Workers
- Main database / auth: Supabase PostgreSQL
- Event collector: Cloudflare-hosted Next.js route handler
- Event aggregation: Supabase/PostgreSQL-derived analytics pipeline
- Storage: Supabase-backed application data stores; Cloudflare R2 is optional only when a current task explicitly requires object storage
- Prototype integration: Figma Embed / OAuth

Vercel and Netlify are no longer active architecture targets. Existing Vercel URLs may remain in historical QA evidence until Cloudflare production cutover is verified.

Cloudflare's current recommended migration path for an existing Next.js 16 application is vinext on Workers. The migration must pass compatibility, build and runtime QA before the old production runtime is retired.

See [`docs/architecture.md`](docs/architecture.md) for the system model and [`docs/cloudflare-runtime.md`](docs/cloudflare-runtime.md) for migration/cutover rules.

## Core modules

1. **Test Builder** — configure prototype, tasks and success rules.
2. **Participant Runner** — execute tests with minimal UI interference.
3. **Tracking Engine** — capture deterministic behavioral events.
4. **Analytics** — derive task, path, heatmap and funnel metrics.
5. **Findings & Retest** — turn evidence into actionable UX issues and compare iterations.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and add development credentials when integrations are enabled. Production secrets must be stored in Cloudflare Workers / GitHub secret stores and must never be committed.

## Source of truth

Product planning and execution order are maintained in the Google Sheet **Usability Testing Platform — Task List**. GitHub is the source of truth for implementation and technical documentation. Cloudflare production is runtime evidence only; Supabase remains the authority for canonical persisted application data.

## Low-fidelity wireframes (Task 12)

Open `public/wireframes/index.html` directly in a browser, or `/wireframes/` with the app running. The standalone review artifact includes 48 screens and 170 selectable states with desktop/mobile layouts. See [wireframe guide](docs/wireframes.md) and [verification notes](docs/wireframes-qa.md).

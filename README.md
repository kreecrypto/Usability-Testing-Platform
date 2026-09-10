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
- Frontend + runtime: Vercel Production
- Main database / auth: Supabase PostgreSQL
- Event collector: Vercel-hosted Next.js route handler (`/v1/events`)
- Event aggregation: Supabase/PostgreSQL-derived analytics pipeline
- Storage: Supabase-backed application data stores; external object storage is optional only when a current task explicitly requires it
- Prototype integration: Figma public prototype embed / Embed API

Production is deployed from `main` through the connected Vercel project. The canonical production origin is:

`https://usability-testing-platform.vercel.app/`

Cloudflare Workers and Netlify are not active production targets. Existing Cloudflare/Netlify artifacts may remain as historical or fallback compatibility evidence, but they must not override the current Sheet runtime governance.

See [`docs/architecture.md`](docs/architecture.md) for the system model, [`docs/vercel-runtime.md`](docs/vercel-runtime.md) for the active deployment/release contract, and [`docs/cloudflare-runtime.md`](docs/cloudflare-runtime.md) for historical/fallback notes.

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

For a focused local demo/engineering QA cycle that does **not** deploy to Vercel:

```bash
npm run qa:demo
```

This uses the existing deterministic provider-neutral QA fixture. It is development/test evidence only and does not replace release-gate evidence from Vercel Production, real Figma access, cross-device QA, or human UAT. See [`docs/local-demo-qa.md`](docs/local-demo-qa.md).

## Environment

Copy `.env.example` to `.env.local` and add development credentials when integrations are enabled. Production secrets must be configured in Vercel Environment Variables and must never be committed. Supabase server credentials remain server-only; browser-visible values must use only the existing `NEXT_PUBLIC_*` contract.

## Source of truth

Product planning and execution order are maintained in the Google Sheet **Usability Testing Platform — Task List**. GitHub is the source of truth for implementation and technical documentation. Vercel Production is the active runtime evidence source; Supabase remains the authority for canonical persisted application data and Auth.

## Low-fidelity wireframes (Task 12)

Open `public/wireframes/index.html` directly in a browser, or `/wireframes/` with the app running. The standalone review artifact includes 48 screens and 170 selectable states with desktop/mobile layouts. See [wireframe guide](docs/wireframes.md) and [verification notes](docs/wireframes-qa.md).

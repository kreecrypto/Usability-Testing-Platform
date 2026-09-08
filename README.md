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

- Frontend: Next.js + React + TypeScript
- Main database / auth: Supabase PostgreSQL
- Event collector: Cloudflare Worker
- Event aggregation: worker-based pipeline
- Storage: Cloudflare R2
- Hosting: Vercel
- Prototype integration: Figma Embed / OAuth

See [`docs/architecture.md`](docs/architecture.md) for the system model.

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

Copy `.env.example` to `.env.local` and add development credentials when integrations are enabled.

## Source of truth

Product planning and execution order are maintained in the Notion **Usability Testing Platform — Master Plan**. GitHub is the source of truth for implementation and technical documentation.

## Low-fidelity wireframes (Task 12)

Open `public/wireframes/index.html` directly in a browser, or `/wireframes/` with the app running. The standalone review artifact includes 48 screens and 170 selectable states with desktop/mobile layouts. See [wireframe guide](docs/wireframes.md) and [verification notes](docs/wireframes-qa.md).

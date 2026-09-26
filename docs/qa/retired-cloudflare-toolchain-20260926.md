# Retired Cloudflare toolchain — 2026-09-26

Status: QA.

Source: user instruction to remove Cloudflare; current AGENTS.md and UTP Sheet Source Governance set Vercel + Supabase as the active architecture. Main before this change used no Cloudflare runtime imports, storage calls, or deploy pipeline. The remaining artifacts were fallback package scripts and dependencies, Wrangler/Vite config, manual QA workflow, example credentials, and fallback documentation.

Removed those active-capable artifacts and regenerated package-lock.json. Production scripts remain Next.js for Vercel. Supabase remains the database, auth, and storage provider. Historical migrations, Git history, and unrelated negative regression assertions remain intact.

Validation: npm ci, npm run qa, design-system and high-fi checks. No repository lint script exists. Production verification requires merge and exact Vercel main deployment.

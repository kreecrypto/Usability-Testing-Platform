# Auth dependency patch — 2 October 2026

PR #139 remains a preparatory Auth release. Next.js is pinned to 16.3.8; Auth, RLS and the synthetic Demo boundaries are unchanged.

Local evidence: build, typecheck and 297 tests pass. AH design-system and high-fi checks pass. npm audit --omit=dev reports zero vulnerabilities. No separate lint script exists.

BLOCKED_EXTERNAL: the user has no researcher account yet. Signup confirmation, Login → Projects → workspace creation, refresh, logout and recovery need a real account on the exact patched Preview. This evidence does not authorize Production release or satisfy FP-01–09.

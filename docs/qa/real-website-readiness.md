# FEAT-02.07.AUDIT — Real website Heatmap readiness

2026-10-04 (Asia/Bangkok). User approved the next-work recommendation with “ทำเลย”. This audit follows TRIAL-02.P3. Source inspected: current Sheet Feature Tasks, GitHub PR142/143, UTP tree `6c1fffd94b4aefd76db50ea44663481868b2820a` / remote head `b765b8442efa3cc4cbe07fc36fc7a903fb1c9ab8`, the previously supplied public target and its entry bundle, and connected Vercel projects. The audit does not release research features or certify a real website integration.

## Target evidence

The supplied target is https://banrao-uat.pages.dev/. A certificate-verified curl HEAD request returned HTTP200, `content-type: text/html`, and `server: cloudflare`. Neither `x-frame-options`, `content-security-policy` nor `x-utp-first-party-bridge` was returned. Missing frame headers alone do not prove that embedding or tracking works.

GET returned page title “บ้านเรา” and `/assets/index-CbZr0BNH.js`. Neither the HTML nor that entry bundle contained `utp:first-party-web` or `first-party-web-v1`. No GitHub source link was found in the HTML. This is an inspected-response observation, not proof that every dynamically loaded script was examined or a live handshake was attempted.

A scoped GitHub search `user:kreecrypto banrao` returned no repositories. The connected Vercel team returned no Banrao-named project; its project list also did not identify a target source. These searches do not prove that the target is absent from another account, a differently named private repository, or another team. The user has been asked for the current Vercel URL and exact source repository. Do not install or deploy tracking to the deprecated hosting target.

## Capability matrix

| Area | Existing support | Readiness for this real target |
| --- | --- | --- |
| Public access | Target homepage HTTP200 | Reachable; behavior collection unverified |
| Hosting/source | Old pages.dev URL only; source not identified | BLOCKED_EXTERNAL: current Vercel URL and writable source required |
| Consent and event transport | UTP first-party adapter, origin/window guard and durable outbox | Reusable foundation; no installed target handshake demonstrated |
| Publish preflight | Only exact same-origin `/internal-validation-target` can be approved | Generic owned target remains blocked |
| Participant bridge | Listener attached for approved `first_party_web`; credentials stay in UTP | Generic cross-origin transport/window binding requires implementation |
| Document geometry | First-party pointer has normalized viewport coordinates | Document coordinates, layout revision and exact viewport/document geometry are missing |
| Researcher click map | Canonical transform accepts Figma points | First-party events correctly remain unsupported; cannot reuse Trial simulation geometry |
| Historical background | Trial pins a synthetic layout | Real target must supply immutable background assets matching its revision and geometry |

Code evidence: [first-party bridge](../../src/lib/web/first-party-message-bridge.ts), [owned preflight](../../src/lib/builder/test-target-import.ts), [participant bridge](../../src/app/t/%5BtestVersionId%5D/participant-runner-client.tsx), [instrumentation](../../src/lib/web/first-party-instrumentation.ts), [canonical Heatmap](../../src/lib/analytics/heatmap.ts). Trial's screen/layout allowlist is intentionally simulation-only.

## Implementation handoff

1. Identify the current owned target URL and repository; inspect its framework, navigation, embed restrictions, and release process. Source access and a Vercel target are BLOCKED_EXTERNAL until supplied. Do not infer ownership from a submitted URL.
2. Add an installed target adapter with configured allowed UTP origins, stable allowlisted screen/element identifiers, revision identity, and explicit consent/start/stop lifecycle. Keep ingestion credentials and durable acceptance in UTP. Do not send arbitrary URLs, query strings, input values, visible text or hrefs as telemetry.
3. Version the first-party geometry contract additively: document click position including scroll, viewport dimensions, document dimensions and layout/background revision. Update preflight, runner source binding, evidence derivation and Results as a compatible change. The current canonical pipeline gaps are BLOCKED_SELF_FIXABLE; do not mark capabilities Available until an actual handshake and accepted evidence are demonstrated.
4. Supply immutable, non-sensitive background assets per revision/geometry. Do not render today's mutable target DOM underneath historical click coordinates. Distinguish missing background from missing click data.
5. Verify consent → task → target → accepted events → Results → Finding → Report → Retest on Preview, exact version/session/event IDs, idempotent retry, rejected origins, task stop, keyboard-only actions, scroll geometry, 320/390px, and layout-change exclusion. The full researcher release still requires its existing Auth/database/release gates.

## QA and status

Root verification: 23/23 targeted tests PASS using:

```sh
node --test tests/first-party-message-bridge.test.ts tests/mt05-first-party-instrumentation.test.ts tests/mt05-first-party-session-instrumentation.test.ts tests/mt06-external-target-boundary.test.ts tests/runner-target-adapter.test.ts tests/major-a-first-party-live-preflight.test.ts
```

Independent read-only contract review also passed its 20-test subset. This is a documentation-only audit; no application source, API, schema, Auth/RLS, target data or deployment was changed. No new lint/build/Production pass is claimed. Existing PR142/143 are draft/open and unchanged by this audit; their Trial evidence is separate.

Audit status: COMPLETE for readiness inspection and handoff only. Integration status: BLOCKED_EXTERNAL for target source/current hosting, with the software gaps above classified separately. FEAT-02.07 itself and FEAT-13.07/MAJOR gates are not marked complete by this audit.

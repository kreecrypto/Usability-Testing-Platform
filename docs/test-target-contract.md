# Test Target Contract — V1

Status: REQUIRED contract for MT-01. This document generalizes the existing Figma-first product without weakening the canonical event, privacy, outcome, or evidence rules.

## Product invariant

A **Test Target** is the immutable thing a published test version asks a participant to interact with. V1 supports these provider classes:

- `figma_prototype` — public Figma prototype using the existing Figma embed/event adapter.
- `first_party_web` — a team-controlled web target in `uat` or `production` environment, eligible for approved UTP instrumentation after consent.
- `external_web` — a third-party website. Capabilities are determined by preflight and may be partial or unsupported.

The product loop remains **Target → Tasks → Rules → Participant → Behavior/Evidence → Usability Report/Finding → Fix → Retest**. UTP accepted events, deterministic outcomes, and source-traceable analytics remain canonical. A provider must never invent evidence to satisfy a metric.

## Immutable published snapshot

Every published test version must resolve a provider-neutral target snapshot containing, at minimum:

- `provider`: `figma_prototype | first_party_web | external_web`
- `sourceUrl`: normalized HTTPS target URL
- `environment`: `uat | production | external | null` as applicable
- `launchMode`: `embed | new_tab | same_tab | unsupported`
- `capabilities`: the preflight result used by the runner/results layer
- `providerConfig`: provider-specific, non-secret configuration needed to reproduce the run
- `snapshotVersion`: version of the target-snapshot contract

Provider secrets, service-role keys, or privileged credentials must never be stored in participant-visible configuration. Published snapshots are immutable; editing creates a new draft/version. Existing Figma history must remain readable through its adapter during MT-03 migration.

## Capability vocabulary

Each capability has one of four states:

- `available` — trustworthy evidence can be collected for the published snapshot.
- `partial` — some trustworthy evidence is available, but not enough for the full metric/interaction model.
- `unsupported` — browser/provider/security boundaries prevent trustworthy evidence.
- `no_data` — capability is supported but no accepted evidence exists for the selected cohort/filter.

`unsupported` and `no_data` are not zero. Unsupported capabilities must fail closed and must not create synthetic raw events, derived events, paths, heatmaps, or completion evidence.

## Capability matrix

| Capability | Figma prototype | First-party web (UAT/Production) | External web |
| --- | --- | --- | --- |
| URL normalization | Available: validated public Figma prototype URL | Available: validated HTTPS URL | Available: validated HTTPS URL |
| Launch | Embed when Figma public embed preflight passes | Embed/same-tab/new-tab according to owned target integration | Preflight only; embed may be blocked by CSP/X-Frame-Options |
| Access preflight | Public/embed access; login/password/restricted → technical block | Owned environment reachability + approved instrumentation readiness | Reachability + framing/security capability only; no access-control bypass |
| Version snapshot | Existing immutable Figma URL/start/config snapshot | Immutable normalized URL + environment + approved adapter/config version | Immutable normalized URL + preflight/capability snapshot |
| `screen_view` | Available from trusted Figma provider navigation evidence | Available only when approved first-party adapter emits stable screen/route IDs | Unsupported unless target exposes an approved trustworthy integration; otherwise no path claims |
| Pointer/click | Available only through existing trusted Figma event adapter | Available only after consent through approved first-party adapter | Unsupported by default across origins; parent DOM inspection is not assumed |
| Scroll | Unsupported for Figma V1 unless provider emits canonical evidence | Available only when approved adapter emits canonical scroll evidence | Unsupported by default without approved integration |
| Canonical coordinates | Available through versioned Figma geometry transform | Available only through a versioned first-party coordinate transform | Unsupported by default without approved integration |
| Path/backtrack | Derived only from ordered accepted `screen_view` evidence | Derived only from ordered accepted stable screen/route evidence | Unsupported when trustworthy screen evidence is unavailable |
| Heatmap | Available only from accepted canonical coordinates | Available only from accepted canonical coordinates + transform version | Unsupported when canonical coordinates cannot be proven |
| Time | Derived from accepted lifecycle `occurredAt`; provider-independent | Same canonical lifecycle rule | Same canonical lifecycle rule when session/task lifecycle is observable; target-internal time is not invented |
| Deterministic outcome | Existing Figma rules gated by provider capability | Provider-neutral rules gated by available route/screen/explicit signals | Only rule primitives supported by proven capability; otherwise publish is blocked or outcome is technical_blocked |

## Provider contracts

### Figma prototype

Reuse the existing Figma URL parser, embed bridge, capability matrix, canonical geometry transform, and explicit unsupported states. Live Embed API configuration remains a separate external gate. Do not add OAuth token exchange/private-file REST as an implicit V1 requirement.

### First-party web

Owned UAT/Production targets may use an approved UTP instrumentation adapter **after UTP consent**. The adapter sends canonical evidence through `/v1/events` using the existing session-bound credential, stable event identity, retry/idempotency, and database dedupe path. Browser clients never write raw research events directly to Supabase.

Stable screen/route identifiers and coordinate transforms must be versioned. If an owned target has not installed/approved the adapter, its evidence capability is partial/unsupported rather than inferred from browser pixels or navigation guesses.

### External web

Preflight must treat browser security boundaries as product capabilities, not errors to bypass. Cross-origin DOM reads are not assumed. `frame-ancestors`/X-Frame-Options may prevent embedding. If the target does not expose an approved integration, UTP may still launch the target where safe, but click/path/scroll/heatmap capabilities remain `unsupported` unless trustworthy evidence is available.

UTP must never bypass login, CSP, frame restrictions, same-origin policy, bot protection, or other access controls.

## Metric availability rules

- Completion/give-up/timeout/abandon/technical-block metrics derive from canonical UTP lifecycle/outcome evidence, not from guessed target state.
- `technical_blocked` is excluded from usability-failure denominators under the existing metric contract.
- Path/backtrack requires accepted ordered `screen_view` evidence.
- Misclick/rage-click requires trustworthy pointer evidence plus the applicable deterministic rule version.
- Heatmap requires accepted canonical coordinates and coordinate-transform version.
- Scroll metrics require provider-emitted canonical scroll evidence.
- `No Data` must remain distinct from numeric zero.
- Results must retain provider + target snapshot + capability context so every displayed claim can be traced back to accepted evidence.

## Preflight result

Before publish, target preflight returns a provider classification and capability snapshot. Any acceptance rule that depends on an `unsupported` capability blocks publish with a clear explanation. Runtime access/provider failures become `technical_blocked`, not usability failure.

## Downstream implementation contract

MT-02 may rename the researcher mental model from Prototype to Target. MT-03 must persist the immutable provider-neutral snapshot while preserving existing Figma history. MT-04/05/06 implement URL preflight and provider boundaries. MT-07/08/09 consume this contract in runner/rules/tracking. MT-10/11 use the capability state to render evidence-backed report/results. MT-13/14 verify the cross-provider release matrix.

## Source basis

- Google Sheet Task List / Task Detail / Source Governance — planning authority.
- `docs/event-contract.md`, `docs/task-outcome-rules.md`, `docs/analytics.md`, `docs/privacy-baseline.md`, `docs/architecture.md` — existing canonical implementation contracts.
- MDN Same-origin policy — cross-origin script/DOM access is restricted; cross-document communication must use explicit mechanisms such as `postMessage`.
- MDN CSP `frame-ancestors` — a target can restrict which parents may embed it.
- Official Figma Embed API docs — authority for Figma-emitted evidence and unsupported Figma capabilities.

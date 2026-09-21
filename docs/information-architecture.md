# V1 Information Architecture

## Global navigation

1. **Home** — recent projects/tests, drafts needing action, latest results/findings
2. **Projects** — project containers
3. **Tests** — cross-project index of draft/published/closed tests
4. **Results** — cross-test results index; detailed analytics stays inside a selected test version
5. **Participants** — permission-filtered participant/session operations, not recruitment CRM
6. **Settings** — workspace, members/roles, target integrations, privacy/retention, profile

## Object hierarchy

`Workspace -> Project -> Test -> Published Version -> Target Snapshot -> Session / Result`

A **Test Target** is the participant-facing system under test. Figma is one target provider, not the product-level mental model. The provider-neutral contract and capability vocabulary are defined in `docs/test-target-contract.md`.

## Project navigation

- Overview
- Tests
- Findings

## Test workspace navigation

- Build
- Preview
- Share
- Results

### Build flow navigation

The canonical build sequence is:

1. Welcome / Consent
2. **Target** — choose Figma Prototype, owned UAT/Production website, or supported external website; run provider/capability preflight before publish
3. **Tasks** — participant instructions and task ordering
4. **Rules** — success/failure/give-up/timeout rules gated by target capability
5. Post-task Question
6. Preview
7. Publish
8. Thank You / completion copy

Researcher-facing labels use **Target / เป้าหมายทดสอบ** at the product level. Provider names such as Figma appear only when selecting/configuring that provider or explaining a provider-specific capability.

### Target states

The Target step must expose, without implying success evidence:

- Ready / Available
- Partial capability
- Unsupported capability
- Restricted / access blocked
- Invalid URL
- Loading / checking capability

An unsupported target capability blocks only rules/metrics that require that capability. The UI must not convert Unsupported or No Data to `0`.

### Results navigation

- Overview
- Tasks
- Paths
- Heatmaps
- Sessions
- Findings
- Retest

Results always retain target provider + immutable target snapshot/version context. Paths/heatmaps and other capability-dependent sections must show `Available`, `Partial`, `Unsupported`, or `No Data` according to accepted evidence.

## Participants

- All Participants / Sessions
- Session Detail (authorized roles only)
- Data Request / Delete

## Settings

- Workspace
- Members & Roles
- **Target Integrations** — provider configuration/capability information; Figma is one provider
- Privacy & Retention
- Profile

## Public participant runner

Route boundary: `/t/{publicToken}`

Flow:
1. access/availability + target capability check
2. consent
3. task intro
4. target runner/launch according to the immutable target snapshot
5. post-task SEQ / feedback
6. next task or complete
7. closed/invalid/technical-blocked states as needed

The participant runner never inherits the researcher app shell or workspace navigation. It must not expose success criteria, failure rules, expected paths, or other hints that bias participant behavior.

## Ownership rules

- Top-level **Tests** is a cross-project index; editing happens inside the Test Workspace.
- Top-level **Results** is a cross-test index; detailed analytics is scoped to an exact published test version.
- Result pages always display test/version/target context.
- Build/Preview/Share/Results remain stable test-level tabs.
- Preview data is separated from production participant sessions.
- Analytics sections live under Results rather than becoming duplicate primary modules.
- Privacy-restricted participant/session data is reachable only through authorized routes.
- Provider-specific capability belongs under Target configuration/integrations; product-level IA remains provider-neutral.
- Unsupported capability fails closed and never produces synthetic click/path/scroll/heatmap evidence.

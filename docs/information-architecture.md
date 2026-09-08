# V1 Information Architecture

## Global navigation

1. **Home** — recent projects/tests, drafts needing action, latest results/findings
2. **Projects** — project containers
3. **Tests** — cross-project index of draft/published/closed tests
4. **Results** — cross-test results index; detailed analytics stays inside a selected test version
5. **Participants** — permission-filtered participant/session operations, not recruitment CRM
6. **Settings** — workspace, members/roles, integrations, privacy/retention, profile

## Object hierarchy

`Workspace -> Project -> Test -> Published Version -> Session / Result`

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

- Welcome / Consent
- Prototype
- Tasks
- Success / Failure Rules
- Post-task Question
- Thank You

### Results navigation

- Overview
- Tasks
- Paths
- Heatmaps
- Sessions
- Findings
- Retest

## Participants

- All Participants / Sessions
- Session Detail (authorized roles only)
- Data Request / Delete

## Settings

- Workspace
- Members & Roles
- Integrations
- Privacy & Retention
- Profile

## Public participant runner

Route boundary: `/t/{publicToken}`

Flow:
1. access/availability check
2. consent
3. task intro
4. prototype runner
5. post-task SEQ / feedback
6. next task or complete
7. closed/invalid/technical-blocked states as needed

The participant runner never inherits the researcher app shell or workspace navigation.

## Ownership rules

- Top-level **Tests** is a cross-project index; editing happens inside the Test Workspace.
- Top-level **Results** is a cross-test index; detailed analytics is scoped to an exact published test version.
- Result pages always display test/version context.
- Build/Preview/Share/Results remain stable test-level tabs.
- Preview data is separated from production participant sessions.
- Analytics sections live under Results rather than becoming duplicate primary modules.
- Privacy-restricted participant/session data is reachable only through authorized routes.

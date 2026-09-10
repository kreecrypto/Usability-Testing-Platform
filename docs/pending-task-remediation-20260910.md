# Pending Task Remediation — 2026-09-10

This document tracks source-backed remediation of remaining non-COMPLETE tasks.

## Rules
- Google Sheet Task List / Task Detail / Source Governance remains planning authority.
- GitHub main remains implementation authority after merge; this PR is implementation evidence while under QA.
- Do not fabricate production fixtures, credentials, Figma access evidence, physical-device/browser evidence, performance thresholds, or human UAT evidence.
- A task may move to COMPLETE only when its acceptance and release-gate evidence are actually satisfied.

## External/source evidence gates
- Task 22 / Task 33: real source-backed published test/session/token production E2E.
- GWD-02 / GWD-10: Figma app client ID + allowed origin + live public/restricted access-state/event evidence.
- Task 39 / Task 47 release evidence: after code QA, use a real published test carrying source-backed geometry and live Figma pointer evidence to prove persisted canonical points and the Results heatmap. Geometry source acquisition itself is no longer a gap.
- Task 53: source-authorized Mobile Checkout, Desktop CRM Case Creation, and Mobile Banking artifacts with expected paths. Desktop CRM source exists but its canonical expected path is still a Source Gap.
- Task 56: actual cross-browser/device matrix.
- Task 58: source-approved numeric dashboard performance budget plus release load evidence.
- Task 59: human UX Designer UAT.

## Remediation completed in this branch
- Tasks 34/35/36/38/40/41/43 were reclassified from false implementation blockers to QA/release-dependency state in planning.
- Task 48 was corrected to COMPLETE because its Release Gate is NO and its implementation/migration/QA evidence already passes.
- Task 39 now has a versioned geometry contract bound to the immutable UTP `testVersionId`, collector-side canonical normalization, client canonical-point stripping, and fail-closed raw-only behavior when geometry is unavailable.
- Task 47 now has canonical-only heatmap aggregation, Available/No Data/Unsupported states, exact test-version/task/screen/device/outcome filters, and a responsive Results heatmap UI.
- No browser/CSS coordinate fallback was introduced.

## Next gate order
1. Pass GitHub Build / Test / Schema / Authorization / Local Demo QA for Task39/47 changes.
2. Keep Task39/47 at QA until real published geometry + pointer evidence exists.
3. Resolve Task22/33 and GWD-02/GWD-10 external gates when their real source/config becomes available.
4. Resolve Task53 source gaps, then re-run 54/55/58.
5. Run Task56 and human Task59 evidence.
6. Run Task60 launch gate.
7. Only after Task60 COMPLETE, begin optional Clarity Tasks 61–70 unless planning explicitly changes.

# MT-11 explicit No Data capability gate — 2026-09-26

Status: QA. Follow-up to PR #120 on exact main 018510a8.

An explicit `No Data` capability in a persisted target snapshot was previously treated as Available by Results presentation and Report metric/heatmap availability. The gate now propagates No Data across both surfaces. A regression fixture includes accepted pointer evidence with a computable zero: the value stays hidden because the target capability is No Data. The same fixture verifies that the Report heatmap is No Data.

Validation: npm ci, production build, typecheck, 281/281 tests, design-system and high-fi checks passed. Real published-study browser and Researcher UAT remain pending; this is not MT-11 COMPLETE evidence.

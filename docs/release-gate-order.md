# Release Gate Execution Order

Use this order to avoid circular blocker churn:

1. Pass GitHub-only QA for the Task39/47 implementation: build/type/tests/schema/authorization/local demo.
2. Resolve Task 22/33 with a real published-test/session production E2E when source-backed data exists.
3. Resolve GWD-02/GWD-10 with real Figma Embed API client-id/origin and live provider access/event evidence.
4. Re-run Participant Runner release gates 34–36 and tracking gates 38–43. Task39 specifically needs a real published geometry snapshot + pointer event to close its Release Gate.
5. Re-run Task47 Screen Heatmap release QA from those persisted canonical points. Task48 is already COMPLETE and does not need to be reopened.
6. Complete Task53 seed-prototype source/expected-path evidence, then release dataset/metric gates 54–55.
7. Run actual browser/device matrix (56), source-approved performance budget/load QA (58), and human UAT (59).
8. Run Task60 launch gate.
9. Only after Task60 COMPLETE, begin optional Clarity phase 61–70.

Downstream code may already be implemented and GitHub-QA-passing while its release evidence remains open. Keep implementation QA separate from external/human/live-provider evidence, and never fabricate the latter to close a gate.

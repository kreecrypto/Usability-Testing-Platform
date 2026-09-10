# Pending Task Remediation — 2026-09-10

This document tracks source-backed remediation of remaining non-COMPLETE tasks.

## Rules
- Google Sheet Task List / Task Detail / Source Governance remains planning authority.
- GitHub main remains implementation authority.
- Do not fabricate production fixtures, credentials, Figma access evidence, physical-device/browser evidence, or human UAT evidence.
- A task may move to COMPLETE only when its acceptance and release-gate evidence are actually satisfied.

## External evidence gates
- Task 22 / Task 33: real source-backed published test/session/token production E2E.
- GWD-02 / GWD-10: Figma app client ID + allowed origin + live public/restricted access-state/event evidence.
- Task 53: source-authorized seed prototype specifications and expected paths.
- Task 56: actual cross-browser/device matrix.
- Task 59: human UX Designer UAT.

## Self-fixable remediation order
1. Re-audit Task 34–43 implementation and dependency-only blockers.
2. Re-audit Task 47–48 implementation and dependency-only blockers.
3. Re-audit Task 54–58 code/QA portions and isolate only external/source gaps.
4. Keep Task 60 blocked until release gates actually pass.
5. Keep Clarity Tasks 61–70 dependency-blocked behind Task 60 unless planning explicitly changes.

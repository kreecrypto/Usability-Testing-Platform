# TRIAL-02.P4 — Heatmap density

User-approved 2026-10-10; Sheet Feature Tasks row197, following TRIAL-02.P3 and PR154 (remote682b17d / local1d610f4, identical treea9f239d6). Manual Trial-only scope; scheduler stays paused. No Production release or research-gate change.

Three views: density (default), points, both. Direct #event links select points. Existing page/task/session/exact geometry filters and zoom/dialog remain. Show click/session counts, relative within-selection low–high legend and no-success/no-cross-cohort comparison caveat. Color is read-only; Finding still requires an actual submitted-session event and explicit form save.

Pure deterministic source-coordinate linear kernel radius32px; unique valid pointer event IDs each weight1, separate version/layout/screen/viewport/document groups; keyboard/scroll excluded. Canvas raster <=1,000,000 pixels, aspect preserved; zoom affects display only. Validate background geometry before rendering. Cancel stale renders; Canvas failure returns to points. Frozen Finding/Report IDs cannot broaden; invalid evidence links fail closed.

Preserve raw event IDs/storage/schema, API/Auth/RLS, synthetic/local-only notices and accepted-event invariants. Test single/overlap/edges/scrolled/duplicate/mixed geometry, fixed results and resource cap; 3 modes/all zooms desktop320/390 keyboard/dialog/Escape; no-data/error/mismatch/incomplete/frozen links; actual simulated click→Results→Finding→Report Preview. Run full unit/browser regression, typecheck/build/design; no lint script. Separate dependent draft PR on codex/ui-audit-p2; record exactcommit CI/Preview before COMPLETE.

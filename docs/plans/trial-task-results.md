# TRIAL-02.P5 — Task Results

Approved 2026-10-11; Feature Tasks198. Base PR155 / local abe3e003, exact content tree e1e431aa. Trial-only; no Production release, APIs, migrations, Auth/RLS or research gate changes.

Results retain per-version self-reported done/not_done/skipped and add technical-blocked with required reason. Submitted answers only: eligible=done+not_done+skipped; reported completion=done/eligible, technical excluded, incomplete never failure. Show started/answered/submitted/pending separately, task/session source references, score distribution and feedback. No Data is not0; legacy starts unknown if no start metadata/answer/events.

Explicit startTask persists first start only and is idempotent on refresh. Successful answerSession freezes end once. Elapsed includes feedback, scoring and all wall-clock gaps/off-tab time; explicitly named elapsed from task start to answer save, not website task-only duration. Median uses valid timed submitted done/not_done, excludes skipped/technical and invalid/missing timestamps. Legacy metadata optional, no invented starts; invalid timestamps remain readable but cannot yield a duration. No raw ID mutation.

Check formulas/odd-even median/old data/version isolation/incomplete/technical/invalid times; real UI start→answer→submit→Results→Finding→Report and Heatmap; refresh/storage failure/other-tab conflicts, desktop320/390 keyboard/focus/axe. Run unit, browser, build/typecheck/design/high-fi; no lint script. Separate dependent draft PR; exact head CI/Preview and source readback before COMPLETE.

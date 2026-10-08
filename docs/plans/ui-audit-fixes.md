# UI-02 — App audit fixes

Approved 2026-10-08. Sheet Feature Tasks UI-02, UI-02.01, UI-02.02 (rows194–196), manual track on reviewed PR152 remote9a107885 / local49e8657, equal tree d3fb9c68dff93af58464fbaab9aa9e0f029a4281. Private MAJOR04 lease coordinates this continuation; scheduler remains PAUSED/read_only.

P1 first: Projects bootstrap loading/ready/error/restricted + retry;401 only redirects; context changes synchronously clear children and published links, abort/ignore stale reads, disable dependent actions while loading. Participant snapshot invalid ID/not-found vs network/5xx/malformed response; retry reads snapshot and original session, no new session or premature event emission, pending event identity retained.

P2 after independent P1 QA: Home primary Trial, secondary read-only Demo with local-only notice and one workflow explanation;44px key navigation/actions on320/390; AH tokens retained, marker coordinates/styles untouched. Researcher name/URL fields start blank, Thai placeholders, QA-specific new descriptions removed with compatible payloads; old persisted data unchanged.

Two draft PRs follow dependency order. Each gets tests/typecheck/build/design checks, independent exactcommit review and exactcommit Preview. No separate lint script. Adversarial tests cover bootstrap/network/403/401, slow/out-of-order Workspace/Project/Test/Tasks reads, failed fetch preserving correct scope, malformed snapshot, retry/resume pending original events and zero preconsent events. Responsive/keyboard/axe at1280/320/390 plus existing Trial/evidence regressions. No backend/schema/public API/Auth/RLS change, no expected success hints.

Fixture/Trial/Demo evidence proves UI scope only; actual researcher/published-study smoke stays BLOCKED_EXTERNAL until supplied. No research release-gate status, merge or Production deployment changes.

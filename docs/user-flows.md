# V1 End-to-End User Flows

## Researcher flow

1. **Create Project** — Home/Projects -> Create Project -> Project Overview.
2. **Create Test** — Project -> New Test -> Prototype Test -> Draft.
3. **Connect Prototype** — connect Figma, validate access, select start point, resolve version/provider metadata.
4. **Build** — configure consent, prototype, tasks, success/failure rules, timeout/give-up, post-task feedback, thank-you.
5. **Preview** — run draft without production research data; fix validation/errors.
6. **Publish** — require draft validation, provider preflight, pinned prototype version, consent version, and frozen rule configuration. Produce immutable Published Test Version + participant link.
7. **Results** — inspect overview, tasks, paths, heatmaps, sessions, and feedback with exact version/sample context.
8. **Finding** — create severity, evidence, affected task/screen, and proposed solution.
9. **Retest** — map a new draft to a baseline test/version, pin the new prototype version, preview, publish.
10. **Compare** — compare completion/time/misclick/path/SEQ plus sample sizes and technical-blocked counts.

Researcher exception states include invalid Figma access, incomplete draft, preview/provider error, publish preflight failure, results empty state, high technical-blocked rate, and deleted evidence.

## Participant flow

1. **Open public link** — validate token, published version, availability, and provider state.
2. **Consent** — disclose research/data collection; accept activates anonymous session, decline exits without eligible usability tracking.
3. **Task Intro** — show scenario/instruction without revealing expected path or success target.
4. **Runner** — start task, open pinned prototype, collect supported canonical evidence, keep test chrome minimal.
5. **Terminal outcome** — first canonical terminal wins: success direct/indirect, failed, give-up, timeout, abandoned, or technical-blocked.
6. **Post-task feedback** — SEQ and optional open feedback where appropriate.
7. **Next task** — repeat intro/runner for additional tasks.
8. **Complete** — thank-you and session completion.

Participant exception states include invalid/closed/expired link, Figma login/password/permission block, temporary disconnect/retry, reload/resume, give-up confirmation, timeout, and abandon after the recovery window.

## Runner principles

- no researcher global navigation
- never expose expected path/success rules to participants
- task instructions remain concise and contextual
- test chrome uses less visual space than the prototype
- mobile and desktop share task semantics
- consent/access/technical states remain distinct from usability outcomes

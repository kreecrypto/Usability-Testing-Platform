# Task 12 — Low-fidelity wireframes

The review artifact covers S01–S36 and P01–P12 from the finalized screen inventory, with 170 selectable states and the associated flow IDs, primary actions, and state notes.

## Open the artifact

- With the app running, open `/wireframes/`.
- Without installing the app, open `public/wireframes/index.html` directly in a browser. It has no external dependencies or network calls.
- The same standalone HTML is attached to Notion Task 12 as a sandboxed HTML embed.
- Choose **Screen**, then **State**. Use **Viewport → Mobile** to inspect a 390px specimen, or resize the browser to test the responsive review shell.
- Use the app buttons to follow flows. Use **Review: simulate task end** outside the participant canvas to stand in for a real Figma terminal event. It is not a proposed participant action.
- **Print screen** prints the selected screen with its ID, flow and state. There is no public deployment or live participant link.

## Coverage

| Batch | Scope | Screen IDs | Count |
| --- | --- | --- | --- |
| A | Entry and core researcher shell | S01–S09 | 9 |
| B | Test builder | S10–S16 | 7 |
| C | Preview and publish | S17–S20 | 4 |
| D | Analytics | S21–S27 | 7 |
| E | Findings and retest | S28–S30 | 3 |
| F | Participant runner and exceptions | P01–P12 | 12 |
| G | Privacy and settings | S31–S36 | 6 |

S01, S02, S05 and S08 were already in Task 11 but omitted from Task 12's original batch breakdown. They are included in Batch A so the entry/create flows are covered. No screen IDs were added beyond the authoritative inventory. Machine-readable screen/state coverage is in `public/wireframes/coverage.json`.

## Flow walkthroughs

1. Researcher: S03 → S05 → S06 → S08 → S09 → S10 → S11 → S12 → S13 → S14 → S15 → S16 → S17 → S18. Exit preview to Build, then use the catalog to review S19 → S20 → S22. Low-fi state selection explicitly simulates validation results; it does not calculate backend eligibility.
2. Participant: P01 → P02 accept → P03 → P04 → P05 confirm → P06 select SEQ → P07 → second task → P08. Decline ends on P02. Timeout, access failure and recovery are P09–P12.
3. Evidence: S22 → S23 → S24 → S25 → S26 → S27 → S29 → S28. S29 links to S30 for retest; S30 creates a new draft at S09.
4. Privacy: S31 → S32 scope review → acknowledgment → Processing. Select Complete/Error in the review state selector to inspect the final states. No data is deleted.

## Contract-sensitive representations

- Technical blocks are separate from usability failures; completion uses started minus technical blocked.
- Time headline is median of successful tasks, with P75/P90 secondary values.
- No-data / no-eligible states show unavailable values rather than 0% success.
- Heatmaps suppress clusters when provider/coordinate mapping is unsupported.
- Path and misclick labels refer to versioned derived evidence, not invented raw browser-back events.
- Published versions bind Figma, consent, and rules. A changed prototype disables publish and requires revalidation.
- Consent precedes the task; declining gives an end state. Participants do not see expected paths or success targets.
- Give-up cancellation returns to the same task; recovery represents the original session/version context.
- Restricted participant content and deleted evidence are explicitly represented. Deletion propagates to derived/cache data in the proposed workflow.
- Retest deltas are descriptive, use percentage points where appropriate, and show both cohorts and technical blocks.

## Fixtures and limitations

All names, identifiers, prototype frames, links and metrics are synthetic. Baseline fixture: 24 started, 2 technical blocked, 22 eligible, 17 successful (13 direct, 4 indirect), 1 failed, 2 give-up, 1 timeout and 1 abandoned. Retest fixture: 27 started, 2 blocked, 25 eligible, 21 successful. Time/SEQ values illustrate layout rather than a generated event dataset.

This completes a low-fidelity design artifact. It does not implement authentication, OAuth, Figma rendering, tracking, backend permissions, persistent form edits, publishing, invitations, clipboard copying, deletion, or production analytics. Some controls illustrate settings; screen/state selectors and primary navigation provide the review interactions. High-fidelity design, runtime version pinning, and production integration remain their existing tasks. No Next.js dependency changes or production build claim are part of Task 12.

## Rebuild and verification

```bash
node scripts/build-wireframes.mjs
node scripts/check-wireframes.mjs
git diff --check
```

The generator is the source; commit its generated HTML and coverage JSON together. See `docs/wireframes-qa.md` for the actual browser checks performed.

## Planning source

[Notion Task 12](https://www.notion.so/3d579f0e916c81d4985ecd49d851d24a), Task 11 screen inventory, Tasks 09/10 user flows, Task 04 metric dictionary, and Task 07 privacy baseline.

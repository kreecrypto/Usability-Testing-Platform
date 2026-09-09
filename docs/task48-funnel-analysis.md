# Task 48 — Funnel & Drop-off Analysis

## Source boundary

Task 48 follows the current Sheet Acceptance Criteria plus the canonical metric definitions in `docs/analytics.md` and `docs/metric-dictionary.md`:

- a funnel is **defined**, not inferred from observed participant paths;
- the definition belongs to the published internal test version;
- transition A → B drop-off is `(entered A - reached B) / entered A * 100`;
- technical-blocked sessions are reported separately from usability behavior;
- No Data is distinct from zero.

No provider-specific or Figma-only behavior is introduced by this task.

## Versioned definition

V1 stores a nullable `test_versions.funnel_config`:

```json
{
  "version": "screen-funnel-v1",
  "screenIds": ["screen-A", "screen-B", "screen-C"]
}
```

The Review/Publish surface lets an authenticated Researcher save the ordered canonical screen IDs on the current draft. `save_draft_funnel_config` is `SECURITY INVOKER`, so existing workspace RLS remains authoritative. Task 32 published-version immutability freezes the configuration after publish, and edit-after-publish clones the exact definition into the new draft.

The JSON shape is an implementation mechanism. Product behavior remains the Sheet-defined requirement that the funnel is versioned and deterministic.

## Ordered progression

For each non-technical-blocked session, raw canonical `screen_view` events are ordered by `sequence`, then `occurredAt`, then `eventId`.

A session reaches a funnel step only after reaching every preceding configured step in order. Seeing B before A does not make that session an entrant to the A → B or B → C progression after A.

For each adjacent configured transition:

- `entered` = sessions that reached the current step in ordered funnel progression;
- `reached` = those entrants that subsequently reached the next configured step;
- `dropped = entered - reached`;
- `conversionRate = reached / entered * 100`;
- `dropOffRate = dropped / entered * 100`.

When `entered = 0`, conversion and drop-off are `null` and the UI renders **No Data**, never `0%`.

## Largest drop

The Results view identifies the transition with the highest defined drop-off percentage. Ties are deterministic: larger dropped count first, then earlier configured transition.

This tie-break is a technical determinism rule; it does not add a new product metric.

## Results and capability handling

Results adds a dedicated Funnel tab with:

- eligible session count;
- technical-blocked count;
- largest drop;
- per-transition entered / reached / dropped counts;
- conversion and drop-off percentages;
- explicit No Data when the published version has no funnel definition or no entrants.

Heatmap remains independently capability-gated. Completing Task 48 does not bypass Task 39/47 coordinate requirements.

## QA

`tests/task48-funnel.test.ts` covers:

- schema version / invalid / duplicate definition rejection;
- ordered progression;
- technical-block exclusion;
- exact conversion/drop-off formula;
- largest-drop selection;
- No Data semantics;
- Results model support only when a versioned definition is present.

Repository Build, Schema, and Authorization gates must pass before merge. The hosted Supabase migration must then be applied and verified before Task 48 is marked COMPLETE.

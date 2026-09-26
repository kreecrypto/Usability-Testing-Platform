-- Stage 12 / MT-10: preserve researcher interpretation and recommendation
-- on Findings so the Usability Report can synthesize evidence without inventing
-- causal conclusions or recommendations.

alter table public.findings
  add column if not exists researcher_interpretation text,
  add column if not exists recommendation text;

update public.findings
set researcher_interpretation = coalesce(
      nullif(trim(researcher_interpretation), ''),
      nullif(trim(description), '')
    )
where researcher_interpretation is null;

alter table public.findings
  drop constraint if exists findings_researcher_interpretation_nonempty,
  drop constraint if exists findings_recommendation_nonempty,
  add constraint findings_researcher_interpretation_nonempty
    check (researcher_interpretation is null or length(trim(researcher_interpretation)) > 0),
  add constraint findings_recommendation_nonempty
    check (recommendation is null or length(trim(recommendation)) > 0);

comment on column public.findings.researcher_interpretation is
  'Researcher-authored interpretation. Never auto-generated from a metric anomaly.';
comment on column public.findings.recommendation is
  'Researcher-authored recommended fix/action associated with evidence-backed Finding.';

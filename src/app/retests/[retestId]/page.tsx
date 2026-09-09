"use client";

import { useEffect, useState } from "react";
import type { RetestMetricComparison } from "../../../lib/findings/model.ts";
import styles from "./retest.module.css";

type Payload = { retest: { retestId: string; status: string; comparison: RetestMetricComparison } };

function value(input: number | null): string {
  return input === null ? "No Data" : String(Math.round(input * 100) / 100);
}

function delta(input: number | null, suffix = ""): string {
  if (input === null) return "Not applicable";
  const rounded = Math.round(input * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}

export default function RetestPage({ params }: { params: Promise<{ retestId: string }> }) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: Payload["retest"] | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ retestId }) => {
      try {
        const response = await fetch(`/api/retests/${encodeURIComponent(retestId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in is required." : "Retest comparison could not be loaded.");
        const payload = await response.json() as Payload;
        if (!cancelled) setState({ loading: false, error: "", data: payload.retest });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "Retest comparison could not be loaded.", data: null });
      }
    });
    return () => { cancelled = true; };
  }, [params]);

  return <main className={styles.page}>
    <header className={styles.header}><div><span>Retest · S30</span><h1>Baseline vs Retest</h1><p>Comparison keeps both version IDs, sample sizes and technical-block context visible. No statistical significance is claimed because no statistical method is defined in V1.</p></div></header>
    {state.loading ? <div className={styles.state}>Loading retest comparison…</div> : null}
    {state.error ? <div className={styles.error} role="alert">{state.error}</div> : null}
    {state.data ? <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span>Metric</span><h2>{state.data.comparison.metricKey}</h2></div><strong>{state.data.status}</strong></div>
      <div className={styles.compareGrid}>
        <article><span>Baseline</span><strong>{value(state.data.comparison.baseline.value)}</strong><small>n={state.data.comparison.baseline.sampleSize} · blocked={state.data.comparison.baseline.technicalBlockedCount}</small><code>{state.data.comparison.baseline.testVersionId}</code></article>
        <article><span>Retest</span><strong>{value(state.data.comparison.retest.value)}</strong><small>n={state.data.comparison.retest.sampleSize} · blocked={state.data.comparison.retest.technicalBlockedCount}</small><code>{state.data.comparison.retest.testVersionId}</code></article>
      </div>
      <div className={styles.deltaGrid}><div><span>Absolute delta</span><strong>{delta(state.data.comparison.absoluteDelta)}</strong></div><div><span>Relative delta</span><strong>{delta(state.data.comparison.relativeDeltaPercent, "%")}</strong></div><div><span>Significance</span><strong>Not claimed</strong></div></div>
      <p className={styles.note}>Relative delta is shown only when both values exist and baseline is non-zero. Direction is not labeled “better” or “worse” because metric desirability is not inferred.</p>
    </section> : null}
  </main>;
}

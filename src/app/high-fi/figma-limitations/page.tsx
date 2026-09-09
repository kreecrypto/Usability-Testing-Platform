import {
  getFigmaV1ResultsCapabilityModel,
  getFigmaV1SurfaceNotices,
  type FigmaLimitationSurface,
} from "../../../lib/figma/limitations.ts";

const surfaceLabels: Readonly<Record<FigmaLimitationSurface, string>> = Object.freeze({
  builder: "Builder",
  runner: "Participant Runner",
  results: "Results",
});

function SurfacePanel({ surface }: { surface: FigmaLimitationSurface }) {
  const notices = getFigmaV1SurfaceNotices(surface, {
    embedApiConfigured: false,
    canonicalHeatmapCoordinates: true,
  });

  return (
    <section style={{ border: "1px solid #d8dce3", borderRadius: 12, padding: 20, background: "white" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
        {surfaceLabels[surface]}
      </p>
      <h2 style={{ marginTop: 8 }}>Figma V1 limitations & fallback</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {notices.map((notice) => (
          <article key={notice.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <strong>{notice.title}</strong>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {notice.blocking ? "BLOCK / UNSUPPORTED" : "EVIDENCE RULE"}
              </span>
            </div>
            <p>{notice.detail}</p>
            <p style={{ marginBottom: 0 }}><strong>Fallback:</strong> {notice.fallback}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function FigmaLimitationsReview() {
  const results = getFigmaV1ResultsCapabilityModel({ canonicalHeatmapCoordinates: true });

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 64px", fontFamily: "Arial, sans-serif", color: "#191f2b" }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Task 19 · Figma V1 provider boundary</p>
        <h1>Known limitations and fallback behavior</h1>
        <p>
          Review artifact for Builder, Participant Runner, and Results. It consumes the executable GWD-04 capability matrix instead of inventing provider behavior.
        </p>
      </header>

      <div style={{ display: "grid", gap: 20 }}>
        <SurfacePanel surface="builder" />
        <SurfacePanel surface="runner" />
        <SurfacePanel surface="results" />
      </div>

      <section style={{ marginTop: 24, border: "1px solid #d8dce3", borderRadius: 12, padding: 20, background: "white" }}>
        <h2>Results capability gate</h2>
        <p><strong>Displayable:</strong> {results.displayableMetrics.join(", ")}</p>
        <ul>
          {results.hiddenMetrics.map(({ metric, reason }) => (
            <li key={metric}><strong>{metric}</strong>: hidden — {reason}</li>
          ))}
        </ul>
        <p style={{ marginBottom: 0 }}>
          No Data is not zero. Unsupported provider evidence is shown as unsupported/no-data context and is not converted into a synthetic raw event or metric.
        </p>
      </section>
    </main>
  );
}

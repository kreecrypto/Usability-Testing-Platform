import { cookies } from "next/headers";

import {
  buildFigmaPocEmbedUrl,
  getFigmaTask15Readiness,
  readFigmaPocEmbedConfig,
} from "@/lib/figma/oauth";

type PageProps = {
  searchParams: Promise<{ oauth?: string }>;
};

const statusCopy: Record<string, string> = {
  verified: "OAuth proof passed. The access token was verified with Figma and discarded.",
  denied: "Figma authorization was cancelled or denied.",
  state_invalid: "OAuth state validation failed. Start the connection again.",
  exchange_failed: "Figma returned an OAuth exchange or identity verification error.",
  config_missing: "Figma OAuth environment variables are not configured on this deployment.",
};

export default async function FigmaPocPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const readiness = getFigmaTask15Readiness();
  const cookieStore = await cookies();
  const oauthVerified = cookieStore.get("figma_oauth_verified")?.value === "1";

  let embedUrl: string | null = null;
  if (readiness.embedConfigured) {
    try {
      embedUrl = buildFigmaPocEmbedUrl(readFigmaPocEmbedConfig());
    } catch {
      embedUrl = null;
    }
  }

  const status = params.oauth ? statusCopy[params.oauth] : null;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 72px" }}>
      <p className="eyebrow">Task 15 · Figma Integration Proof</p>
      <h1 style={{ marginBottom: 12 }}>Figma OAuth + Prototype Embed</h1>
      <p style={{ maxWidth: 760, marginBottom: 28 }}>
        Development proof only. OAuth tokens are used server-side to verify the grant and are
        immediately discarded. Published-test version pinning remains the GWD-01 contract.
      </p>

      {status ? (
        <div
          role="status"
          style={{
            border: "1px solid #b8b8b8",
            borderRadius: 10,
            padding: 16,
            marginBottom: 24,
            background: "#f6f6f6",
          }}
        >
          {status}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <article className="moduleCard">
          <span className="moduleIndex">01</span>
          <h2 style={{ fontSize: 22 }}>OAuth authorization</h2>
          <p>
            Configuration: <strong>{readiness.oauthConfigured ? "Ready" : "Missing"}</strong>
          </p>
          <p>
            Live proof: <strong>{oauthVerified ? "Verified" : "Not verified"}</strong>
          </p>
          {readiness.oauthConfigured ? (
            <a
              className="primaryButton"
              href="/api/integrations/figma/authorize"
              style={{ display: "inline-flex", textDecoration: "none", marginTop: 10 }}
            >
              Connect Figma
            </a>
          ) : (
            <p style={{ marginTop: 10 }}>
              Set FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET and FIGMA_REDIRECT_URI first.
            </p>
          )}
        </article>

        <article className="moduleCard">
          <span className="moduleIndex">02</span>
          <h2 style={{ fontSize: 22 }}>Pinned start point</h2>
          <p>
            Configuration: <strong>{readiness.embedConfigured ? "Ready" : "Missing"}</strong>
          </p>
          <p>
            The iframe is generated from file key + immutable version ID + start node ID; the
            client ID is included for Embed API messaging.
          </p>
        </article>
      </section>

      <section className="heroCard" style={{ display: "block" }}>
        <div style={{ marginBottom: 18 }}>
          <span className="status">Prototype proof</span>
          <h2 style={{ marginTop: 12 }}>Development embed</h2>
        </div>

        {embedUrl ? (
          <iframe
            title="Figma prototype Task 15 proof"
            src={embedUrl}
            width="100%"
            height="720"
            allowFullScreen
            style={{ border: "1px solid #d0d0d0", borderRadius: 12, background: "#fff" }}
          />
        ) : (
          <div
            style={{
              minHeight: 260,
              display: "grid",
              placeItems: "center",
              border: "1px dashed #b8b8b8",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div>
              <strong>Embed configuration is incomplete.</strong>
              <p style={{ marginTop: 8 }}>
                Set FIGMA_POC_FILE_KEY, FIGMA_POC_VERSION_ID and FIGMA_POC_START_NODE_ID.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

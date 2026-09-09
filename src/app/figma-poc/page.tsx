import { PublicFigmaEmbedProof } from "./PublicFigmaEmbedProof";

type PageProps = Readonly<{
  searchParams: Promise<{ url?: string }>;
}>;

export default async function FigmaPocPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialUrl = typeof params.url === "string" ? params.url : "";
  const embedApiClientId = process.env.FIGMA_EMBED_CLIENT_ID?.trim() || undefined;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 72px" }}>
      <p className="eyebrow">Task 15 · Simplified V1</p>
      <h1 style={{ marginBottom: 12 }}>Public Figma Prototype Embed</h1>
      <p style={{ maxWidth: 760, marginBottom: 28 }}>
        Paste a public Figma prototype URL, validate it, and open the same node/start-point
        configuration inside the UT Platform. Researcher OAuth and Figma REST metadata are
        deferred beyond the simplified V1 path.
      </p>

      <PublicFigmaEmbedProof
        initialUrl={initialUrl}
        embedApiClientId={embedApiClientId}
      />
    </main>
  );
}

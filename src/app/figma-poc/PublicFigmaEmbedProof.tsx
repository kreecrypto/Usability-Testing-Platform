"use client";

import { FormEvent, useMemo, useState } from "react";

import { parsePublicFigmaPrototypeUrl } from "@/lib/figma/public-embed";

type Props = Readonly<{
  initialUrl?: string;
}>;

function resolve(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { embedUrl: null, error: null };
  try {
    return {
      embedUrl: parsePublicFigmaPrototypeUrl(trimmed).embedUrl,
      error: null,
    };
  } catch (error) {
    return {
      embedUrl: null,
      error: error instanceof Error ? error.message : "Invalid Figma prototype URL",
    };
  }
}

export function PublicFigmaEmbedProof({ initialUrl = "" }: Props) {
  const [value, setValue] = useState(initialUrl);
  const [submittedValue, setSubmittedValue] = useState(initialUrl);
  const result = useMemo(() => resolve(submittedValue), [submittedValue]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedValue(value);
  }

  return (
    <>
      <section className="moduleCard" style={{ marginBottom: 24 }}>
        <span className="moduleIndex">01</span>
        <h2 style={{ fontSize: 22 }}>Paste public prototype URL</h2>
        <p style={{ maxWidth: 760, marginBottom: 14 }}>
          V1 supports public Figma prototype links only. No Figma OAuth login, client secret,
          access token, or REST call is required for this proof.
        </p>
        <form onSubmit={onSubmit}>
          <label htmlFor="figma-public-prototype-url" style={{ display: "block", fontWeight: 700 }}>
            Figma prototype URL
          </label>
          <input
            id="figma-public-prototype-url"
            name="prototypeUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.figma.com/proto/..."
            value={value}
            onChange={(event) => setValue(event.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "12px 14px",
              border: "1px solid #b8b8b8",
              borderRadius: 10,
              font: "inherit",
            }}
          />
          <button className="primaryButton" type="submit" style={{ marginTop: 12 }}>
            Validate & Preview
          </button>
        </form>
        {result.error ? (
          <p role="alert" style={{ marginTop: 12 }}>
            <strong>Cannot preview:</strong> {result.error}
          </p>
        ) : null}
      </section>

      <section className="heroCard" style={{ display: "block" }}>
        <div style={{ marginBottom: 18 }}>
          <span className="status">Prototype proof</span>
          <h2 style={{ marginTop: 12 }}>Public Figma embed</h2>
        </div>

        {result.embedUrl ? (
          <iframe
            title="Public Figma prototype Task 15 proof"
            src={result.embedUrl}
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
              <strong>Paste a public Figma prototype URL to start.</strong>
              <p style={{ marginTop: 8 }}>
                Private, organization-only, password, or login-required prototypes are outside
                the simplified V1 path and must be treated as a technical block.
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

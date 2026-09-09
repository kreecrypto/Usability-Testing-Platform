"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./prototype-import.module.css";

type PrototypeConfig = Readonly<{
  schemaVersion: 1;
  provider: "figma";
  sourceUrl: string;
  embedUrl: string;
  fileKey: string;
  nodeId?: string;
  startingPointNodeId?: string;
}>;

type Draft = Readonly<{
  id: string;
  workspaceId: string;
  testId: string;
  versionNo: number;
  prototype: PrototypeConfig;
}>;

type RequestState = "idle" | "validating" | "valid" | "saving" | "saved" | "error";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...(init.headers ?? {}) }
      : init?.headers,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("authentication_required");
  }
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : String(body.error ?? "request_failed"));
  }
  return body as T;
}

export default function PrototypeImportClient({ testId }: { testId: string }) {
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [prototype, setPrototype] = useState<PrototypeConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jsonRequest<{ draft: Draft | null }>(`/api/tests/${encodeURIComponent(testId)}/prototype`)
      .then(({ draft: loaded }) => {
        if (!active || !loaded) return;
        setDraft(loaded);
        setPrototype(loaded.prototype);
        setPrototypeUrl(loaded.prototype.sourceUrl);
        setState("saved");
        setMessage(`Draft v${loaded.versionNo} prototype configuration loaded.`);
      })
      .catch((error) => {
        if (!active || String(error).includes("authentication_required")) return;
        setState("error");
        setMessage("Unable to load the current draft prototype configuration.");
      });
    return () => {
      active = false;
    };
  }, [testId]);

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("validating");
    setMessage(null);
    setPrototype(null);
    try {
      const result = await jsonRequest<{ prototype: PrototypeConfig }>(
        "/api/figma/public-prototype/validate",
        {
          method: "POST",
          body: JSON.stringify({ prototypeUrl }),
        },
      );
      setPrototype(result.prototype);
      setState("valid");
      setMessage("Prototype URL is valid. Review the preview, then save it to this test draft.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Enter a valid public Figma prototype URL.");
    }
  }

  async function save() {
    if (!prototype) return;
    setState("saving");
    setMessage(null);
    try {
      const result = await jsonRequest<{ draft: Draft }>(
        `/api/tests/${encodeURIComponent(testId)}/prototype`,
        {
          method: "PUT",
          body: JSON.stringify({ prototypeUrl: prototype.sourceUrl }),
        },
      );
      setDraft(result.draft);
      setPrototype(result.draft.prototype);
      setPrototypeUrl(result.draft.prototype.sourceUrl);
      setState("saved");
      setMessage(`Saved to draft test version ${result.draft.versionNo}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to save prototype configuration.");
    }
  }

  const busy = state === "validating" || state === "saving";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a href="/projects" className={styles.backLink}>← Projects</a>
        <p className={styles.eyebrow}>S09–S10 · Prototype import</p>
        <h1>Connect a public Figma prototype</h1>
        <p>
          Paste a participant-accessible <code>figma.com/proto/…</code> URL. V1 validates and embeds the public link; it does not request Researcher OAuth.
        </p>
      </header>

      <section className={styles.card} aria-labelledby="import-title">
        <h2 id="import-title">1. Paste and validate</h2>
        <form onSubmit={validate} className={styles.form}>
          <label>
            <span>Figma prototype URL</span>
            <textarea
              value={prototypeUrl}
              onChange={(event) => {
                setPrototypeUrl(event.target.value);
                setPrototype(null);
                setState("idle");
                setMessage(null);
              }}
              rows={3}
              placeholder="https://www.figma.com/proto/FILE_KEY/Prototype?node-id=1-2"
              required
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={busy || prototypeUrl.trim() === ""}>
            {state === "validating" ? "Validating…" : "Validate prototype"}
          </button>
        </form>
        {message ? (
          <div className={state === "error" ? styles.error : styles.notice} role={state === "error" ? "alert" : "status"}>
            {message}
          </div>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="preview-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="preview-title">2. Preview</h2>
            <p>Preview is enabled only after the URL passes the same server-side parser used during save.</p>
          </div>
          <span className={styles.status}>{prototype ? "VALID" : "NOT READY"}</span>
        </div>

        {prototype ? (
          <>
            <dl className={styles.meta}>
              <div><dt>File key</dt><dd>{prototype.fileKey}</dd></div>
              <div><dt>Node</dt><dd>{prototype.nodeId ?? "Figma default"}</dd></div>
              <div><dt>Flow start</dt><dd>{prototype.startingPointNodeId ?? "Figma default"}</dd></div>
            </dl>
            <div className={styles.previewFrame}>
              <iframe
                title="Figma prototype preview"
                src={prototype.embedUrl}
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </>
        ) : (
          <div className={styles.empty}>Validate a public Figma prototype URL to show the preview.</div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="save-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="save-title">3. Save draft configuration</h2>
            <p>
              Saves only the draft prototype configuration. Publish and immutable versioning remain a separate release step.
            </p>
          </div>
          {draft ? <span className={styles.status}>DRAFT v{draft.versionNo}</span> : null}
        </div>
        <button className={styles.primaryButton} type="button" onClick={save} disabled={!prototype || busy}>
          {state === "saving" ? "Saving…" : "Save prototype configuration"}
        </button>
      </section>
    </main>
  );
}

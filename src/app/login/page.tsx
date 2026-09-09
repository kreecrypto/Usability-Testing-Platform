"use client";

import { FormEvent, useState } from "react";
import styles from "./login.module.css";

type LoginError = "invalid_credentials" | "auth_unavailable" | "unknown" | null;

const copy: Record<Exclude<LoginError, null>, string> = {
  invalid_credentials: "Email or password is incorrect.",
  auth_unavailable: "Sign in is temporarily unavailable. Try again.",
  unknown: "Unable to sign in. Try again.",
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (body.error === "invalid_credentials") setError("invalid_credentials");
        else if (body.error === "auth_unavailable") setError("auth_unavailable");
        else setError("unknown");
        return;
      }
      window.location.assign("/projects");
    } catch {
      setError("auth_unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>UT Platform</div>
        <p className={styles.eyebrow}>Research workspace</p>
        <h1 id="login-title">Sign in</h1>
        <p className={styles.lead}>Open your projects and usability tests.</p>

        <form onSubmit={onSubmit} className={styles.form} noValidate>
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required disabled={loading} />
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>
          {error ? (
            <div className={styles.error} role="alert">
              {copy[error]}
            </div>
          ) : null}
          <button type="submit" disabled={loading} aria-busy={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

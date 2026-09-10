export function createSupabaseAdminFetch(secretKey: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  const normalizedKey = secretKey.trim();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    // Supabase's current sb_secret_* keys are opaque API keys, not JWTs.
    // Keep the key in `apikey`, but do not forward it as Bearer auth. Legacy
    // service_role JWTs keep Authorization for backward compatibility.
    if (normalizedKey.startsWith("sb_secret_")) {
      headers.delete("authorization");
    }

    return fetchImpl(input, { ...init, headers });
  }) as typeof fetch;
}

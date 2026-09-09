export function createSupabaseAdminFetch(secretKey: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  const normalizedKey = secretKey.trim();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    // Supabase's current sb_secret_* keys are API keys, not JWTs. Sending one
    // as Authorization: Bearer makes downstream JWT verification fail. Legacy
    // service_role JWTs keep their Authorization header for compatibility.
    if (normalizedKey.startsWith("sb_secret_")) {
      headers.delete("authorization");
    }

    return fetchImpl(input, { ...init, headers });
  }) as typeof fetch;
}

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/projects";
  try {
    const url = new URL(value, "https://utp.invalid");
    if (url.origin !== "https://utp.invalid" || !/^\/(projects|tests|builder|methods|findings|reports|results|retests|internal-validation)(\/|$)/.test(url.pathname)) return "/projects";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/projects"; }
}

export function loginHref(destination: string): string {
  return `/login?next=${encodeURIComponent(safeReturnPath(destination))}`;
}

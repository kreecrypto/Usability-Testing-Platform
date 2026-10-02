import { loginHref } from "./redirect.ts";

export const SESSION_EXPIRED_EVENT = "utp:session-expired";
export const SESSION_RESTORED_EVENT = "utp:session-restored";
export const SESSION_MESSAGE = "กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังอยู่ แล้วลองบันทึกอีกครั้ง";
let currentUserId: string | null = null;
export function setCurrentResearcher(id: string | null): void { currentUserId = id; }
export function withAuthLock<T>(action: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("utp-auth-refresh", action) : action();
}

export function createAuthenticatedFetch(fetchImpl: typeof fetch, onExpired: () => void) {
  let renewing: Promise<Response> | null = null;
  async function renew(): Promise<Response> {
    // Recheck inside the lock: another tab may already have rotated cookies.
    const perform = async () => {
      const current = await fetchImpl("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (current.status !== 401) return current;
      return fetchImpl("/api/auth/refresh", { method: "POST", signal: AbortSignal.timeout(15000) });
    };
    if (!renewing) {
      const run = withAuthLock(perform);
      renewing = run.finally(() => { renewing = null; });
    }
    return renewing;
  }
  return async (input: string, init?: RequestInit, notify = true): Promise<Response> => {
    const first = await fetchImpl(input, init);
    if (first.status !== 401) return first;
    const renewed = await renew();
    if (!renewed.ok) {
      if (renewed.status === 401 && notify) onExpired();
      return renewed.clone();
    }
    const session = await renewed.clone().json().catch(() => ({}));
    if (currentUserId && session.user?.id !== currentUserId) {
      if (notify) onExpired();
      return Response.json({ error: "account_mismatch" }, { status: 401 });
    }
    const retry = await fetchImpl(input, init);
    if (retry.status === 401 && notify) onExpired();
    return retry;
  };
}

export const authenticatedFetch = createAuthenticatedFetch(
  (input, init) => fetch(input, init),
  () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); },
);

export function redirectToLogin(): void {
  window.location.assign(loginHref(window.location.pathname + window.location.search + window.location.hash));
}

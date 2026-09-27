const GUEST_STARTED_KEY = "utp_guest_started_v1";

export function guestSessionHistory(): "new" | "previous" | "unknown" {
  try {
    return window.localStorage.getItem(GUEST_STARTED_KEY) === "1" ? "previous" : "new";
  } catch {
    return "unknown";
  }
}

export function markGuestSessionStarted(): void {
  try {
    window.localStorage.setItem(GUEST_STARTED_KEY, "1");
  } catch {
    // The guest session still works when browser storage is unavailable.
  }
}

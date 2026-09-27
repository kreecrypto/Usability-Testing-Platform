import assert from "node:assert/strict";
import test from "node:test";
import { guestSessionHistory, markGuestSessionStarted } from "../src/lib/auth/guest-client.ts";

test("guest history distinguishes first visit, prior guest, and unavailable storage", () => {
  const original = globalThis.window;
  const values = new Map<string, string>();
  try {
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
      },
    } as unknown as Window & typeof globalThis;
    assert.equal(guestSessionHistory(), "new");
    markGuestSessionStarted();
    assert.equal(guestSessionHistory(), "previous");

    globalThis.window = {
      localStorage: {
        getItem: () => { throw new Error("storage disabled"); },
        setItem: () => { throw new Error("storage disabled"); },
      },
    } as unknown as Window & typeof globalThis;
    assert.equal(guestSessionHistory(), "unknown");
    assert.doesNotThrow(markGuestSessionStarted);
  } finally {
    globalThis.window = original;
  }
});

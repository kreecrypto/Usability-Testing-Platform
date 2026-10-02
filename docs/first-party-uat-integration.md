# First-party UAT integration — V1

This integration is for a web target the research team controls. It extends the existing `first_party_web` target; it does not give the target a participant token or direct database access.

1. Host a copy of `public/utp-first-party-bridge-v1.js` on the UAT website and load it on the test route. The website must be reachable over HTTPS without a login barrier for the participants who receive the public test link.
2. On the HTML response for the exact test URL, set `x-utp-first-party-bridge: first-party-web-v1` and `Content-Type: text/html`. Do not set the header until the script is installed and configured on that route.
3. An operator adds the exact HTTPS origin (for example `https://uat.example.com`) to the comma-separated `UTP_APPROVED_TARGET_ORIGINS` server environment variable in Vercel. Multiple origins are supported; paths and wildcards are not accepted. Do not include internal or private-network origins.
4. In the UAT page, after loading the script, call `window.UTPFirstPartyBridge.start({ utpOrigin: "https://usability-testing-platform.vercel.app", screenId: "checkout:start" })`. The runner opens the page only after the participant accepts UTP consent. Outside a UTP-opened window, `start` returns `false` and sends nothing.
5. On client-side route or screen changes, call `setScreen("checkout:review")` with a stable ID. Mark task-relevant controls with `data-utp-element-id="checkout-submit"`. Call `completionSignal("checkout-complete")` only when the website has actually completed that outcome; configure the matching Task rule in UTP.
6. Save the owned UAT target in Builder, then use **ตรวจการเชื่อมต่อเว็บ UAT**. Preflight checks the allowlisted origin, live HTML response, and exact bridge-version header before the draft becomes publishable. If the target changes, save and preflight again. A runtime failure is a technical block, not a usability failure.

The script sends only stable IDs, route path without query parameters, viewport pointer coordinates, document scroll geometry, and explicit completion signals to the UTP opener through `postMessage` with an exact target origin. It does not send form values, text content, cookies, or credentials. The UTP runner accepts messages only from the exact opened window and target origin, and only after consent and an active task. Accepted evidence still goes through the existing durable outbox and `/v1/events` idempotency path.

The UAT response must preserve `window.opener`; a `Cross-Origin-Opener-Policy` that severs the opener prevents this V1 bridge from working. Configure the script's exact `utpOrigin` for the UTP environment used during preview and Production verification.

The response header is an operator assertion that the bridge is installed. Before a real study, preview the exact UAT URL and confirm `ready`, screen, pointer, scroll, and task-specific completion events in a participant session. Missing or unsupported evidence must stay unavailable in Results and Report. A local fixture cannot complete the MAJOR-A real Production proof gate.

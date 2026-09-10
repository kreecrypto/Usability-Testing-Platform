# Figma-only repair — 2026-09-10

Current Sheet Task List A27:K41 was refreshed. GWD-02 and GWD-10 remain externally blocked by actual Embed API client ID, allowed origin and live provider evidence. Production /figma-poc renders the simplified public-prototype page, but its serialized clientId is undefined. Requested the actual prototype and public client ID from the user. No client secret is required.

Task18 repair: concurrent Figma bridge calls previously calculated the same sequence before awaiting the sink. The bridge now serializes processing so sequence, idempotency and previous/current-screen metadata follow arrival order. Arrival timestamps are captured before queueing. Failed sinks reject their caller without advancing state or poisoning subsequent calls. Public interfaces and supported provider-event types are unchanged.

QA: npm run qa passed production build, typecheck and 201 tests. New regression cases cover delayed sink plus concurrent navigation/component-state messages, original arrival timestamps and recovery after sink rejection. No lint script exists. These are engineering fixtures, not live Figma access proof.

Only Figma bridge, its tests and this evidence document changed. GWD-02/GWD-10 are not COMPLETE. Live verification still requires the real configured app and prototype.

Vendor source checked: https://developers.figma.com/docs/embeds/embed-api/

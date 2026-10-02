# FEAT-01.11 — researcher access and session recovery

Status: IN_PROGRESS. Local implementation and automated QA pass; live account/email and release evidence remain open.

## Scope

The 28 September access audit found missing signup/recovery next steps, lost return destinations, access-token expiry discarding unsaved UI state, small login inputs, and no account/logout controls. This change adds email/password signup and recovery UI, a server-side PKCE callback, HttpOnly refresh-cookie rotation, safe return URLs, and an in-page same-account reauthentication dialog. Protected researcher clients retry once after a successful refresh; an invalid refresh preserves the mounted form and requires an explicit retry after login. Participant routes are unchanged.

Authentication writes use a browser Web Lock where available. Concurrent requests in one tab share refresh work. Tokens are never returned in the public login/refresh JSON. Cookie flags are HttpOnly, SameSite=Lax and Secure on HTTPS. This introduces no database migration, external email service, GitHub OAuth, guest authentication or production deployment.

## Local evidence

- `npm test`: 312/312 passing, including redirect validation, PKCE verification, cookie rotation, token secrecy, account mismatch rejection, refresh failures and draft-safe retry behavior.
- `npm run typecheck`, `npm run build`, `npm run check:design-system`, `npm run check:high-fi`: passing. Repository has no lint script.
- Browser against production Next build with an isolated HTTPS Supabase fixture: `/projects/new` redirected to `/login?next=%2Fprojects%2Fnew`; successful login returned to the original form and displayed account identity.
- Entered a project name and Thai description; forced access and refresh expiry. Saving opened the reauthentication dialog. Same-account login kept both field values and the original URL. Fixture recorded zero writes until explicit retry, then exactly one project write and navigation to the created project.
- No real credentials, emails, production records or Supabase configuration were used in the fixture test.
- Browser automation stalled at the logout confirmation dialog. Logout completion, mobile layout, keyboard focus traversal and screenshots of the final implementation remain unverified in this run. CSS specifies 48px inputs, 44px actions and visible focus; this is implementation evidence, not a substitute for mobile/keyboard QA.

## External checks before release

1. Allow the deployed `/auth/callback` URL in the Supabase redirect allowlist. Confirm signup settings and actual email delivery; do not assume the default mail service delivers to arbitrary recipients.
2. With an authorized researcher account, test signup confirmation and recovery in the same browser, expired/reused links, invalid credentials, throttling, logout, refresh and same-account draft recovery on Preview. Check cross-tab behavior in supported browsers.
3. Finish mobile/keyboard and assistive-technology verification, including the recovery form and dialog dismissal/reopening.
4. Use a Preview URL the reviewer can access. The earlier `ogwaua3d7` Preview led to Vercel's access login in a fresh browser, not the UTP login. Do not present Vercel credentials as Supabase credentials or disable protection to bypass this gate.
5. Record exact commit CI/Preview evidence and satisfy the existing MAJOR-A/MAJOR-C and production release gates before marking COMPLETE.

External account, email and Preview access checks are BLOCKED_EXTERNAL until an authorized environment/account is available. Existing research-methods database and release gates remain separate and open.

# GWD-11 — Runtime Version Pinning & Build QA

## Runtime contract

- Node runtime baseline: `>=20.9.0`
- CI/development pin: Node `24.20.0`
- Package manager pin: npm `11.19.0`
- Next.js: `16.3.4`
- React / React DOM: `19.2.8`
- TypeScript: `7.0.2`
- React types: `@types/react@19.2.18`, `@types/react-dom@19.2.7`
- Node types: `@types/node@24.13.3`

No runtime dependency uses `latest`, `next`, caret, or tilde ranges. `package-lock.json` is the dependency-tree source of truth and CI must use `npm ci` after bootstrap.

## QA contract

The final GitHub Actions gate must run on the pinned Node version and execute, in order:

1. `npm ci`
2. `npm run build`
3. `npm run typecheck`
4. `npm test`

A task is not complete until that workflow passes from `main` with the committed lockfile.

## Upgrade rule

Runtime upgrades are explicit changes. Update `package.json`, regenerate and review `package-lock.json`, update `.nvmrc` when Node changes, then pass the full build QA gate before merge/release.

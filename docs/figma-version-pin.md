# GWD-01 — Pin Figma Version at Publish

## Invariant

A published test is bound to one immutable Figma version ID.

At publish time:

1. Resolve the current version exactly once.
2. Persist `figmaVersionId` in the published prototype snapshot.
3. Use that exact ID in the participant embed as `version-id`.
4. Use that exact ID in Figma REST reads as `version`.
5. Never resolve `latest/current` again for an already-published test.

This prevents an edit to the source Figma file from silently changing historical participant experience or the metadata used to reconstruct results.

## Figma evidence

Official Figma developer docs:

- Prototype embed supports `version-id`; omitting it uses the latest file version:
  https://developers.figma.com/docs/embeds/embed-figma-prototype/
- `GET /v1/files/:key` supports `version`; omitting it reads the current version:
  https://developers.figma.com/docs/rest-api/file-endpoints/
- File node and image endpoints also accept a `version` parameter:
  https://developers.figma.com/docs/rest-api/file-endpoints/
- File version history exposes stable version IDs:
  https://developers.figma.com/docs/rest-api/version-history-endpoints/

## Stored snapshot

```ts
type PublishedFigmaPrototype = {
  provider: "figma";
  fileKey: string;
  figmaVersionId: string;
  versionResolvedAt: string;
  sourceLastModified: string;
  startNodeId: string;
  flowStartingPointNodeId?: string;
};
```

`figmaVersionId` is required. A publish operation without a version ID fails closed.

## Runner contract

Participant prototype URL:

```text
https://embed.figma.com/proto/:fileKey
  ?embed-host=ut-platform
  &node-id=:startNodeId
  &version-id=:figmaVersionId
```

The Runner must read the stored published snapshot. It must not consult a draft prototype record or query the current Figma version.

## REST contract

Every REST read used to map or interpret a published test carries the same stored version:

```text
GET /v1/files/:fileKey?version=:figmaVersionId
GET /v1/files/:fileKey?ids=:nodeIds&version=:figmaVersionId
GET /v1/images/:fileKey?ids=:nodeIds&version=:figmaVersionId
```

## Failure behavior

Publish is blocked when:

- Figma version resolution fails,
- the resolver returns an empty version ID,
- the file becomes inaccessible before the version is captured,
- the start node is missing.

An existing published test remains usable with its stored version when a newer source version appears, subject to participant access permissions.

## QA proof

`tests/figma-version-pin.test.ts` verifies:

- publish captures one version ID,
- changing the resolver's current version after publish does not mutate the snapshot,
- runner embed and REST URLs carry the same pinned version,
- a published snapshot without a version ID is rejected.

Run on Node 24+:

```bash
node --test tests/figma-version-pin.test.ts
```

## Boundaries

This task establishes the immutable version contract and executable URL behavior. OAuth token acquisition, provider preflight, caching/rate limits, frame mapping and event adaptation remain their dedicated tasks.

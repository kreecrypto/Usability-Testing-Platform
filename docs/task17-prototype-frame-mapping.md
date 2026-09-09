# Task 17 — Prototype Frame Mapping (Simplified V1)

## Decision

V1 does **not** enumerate frames through Figma REST and does not require Researcher OAuth to configure task targets.

The Researcher supplies a public Figma prototype URL plus explicit Figma node IDs for the task's start, success, and failure targets. The existing Task 16 parser validates Figma prototype URLs and canonicalizes URL-style node IDs such as `5-3` to the internal/Embed API form `5:3`.

Official Figma embed docs support `node-id` and `starting-point-node-id` on public prototype embeds. The Embed API later reports the active frame through `PRESENTED_NODE_CHANGED.data.presentedNodeId`; that live event capability remains separate from target configuration.

## Input contract

`PATCH /api/tasks/:taskId/frame-mapping`

Authenticated Researcher/Designer request body:

```json
{
  "workspaceId": "<uuid>",
  "testVersionId": "<uuid>",
  "prototypeUrl": "https://www.figma.com/proto/<fileKey>/<name>?node-id=5-3",
  "startNodeId": "5:3",
  "successNodeIds": ["10:20"],
  "failureNodeIds": ["30:40"]
}
```

`startNodeId` is optional only when the prototype URL already provides `starting-point-node-id` or `node-id`. Success and failure lists must each contain at least one unique valid Figma node ID.

## Persistence

The endpoint calls `public.save_figma_frame_mapping(...)` with the authenticated user's JWT and the normal Supabase public Data API key. It does not use `service_role`.

The database function is `SECURITY INVOKER`, so existing Task 21 RLS policies remain the authorization boundary. The function updates both records in one database transaction:

- `test_versions.figma_file_key`
- `test_versions.figma_start_node_id`
- `test_versions.prototype_mapping`
- `tasks.success_rule`
- `tasks.failure_rule`

Only a `draft` test version can be changed by Task 17.

The persisted mapping shape is:

```json
{
  "version": 1,
  "source": "explicit_node_ids",
  "prototypeUrl": "https://www.figma.com/proto/...",
  "fileKey": "...",
  "startNodeId": "5:3",
  "successNodeIds": ["10:20"],
  "failureNodeIds": ["30:40"]
}
```

Task rules use:

```json
{ "type": "presented_node", "nodeIds": ["10:20"] }
```

This contract lets the later Figma event adapter compare provider-emitted `presentedNodeId` values with the stored targets without inventing unsupported Figma metadata.

## Security and failure behavior

- Public Figma prototype URL only; no OAuth token or Client Secret.
- Node IDs are canonicalized before persistence and validated again in Postgres.
- The RPC is executable by `authenticated` only; `anon`, `PUBLIC`, and `service_role` direct execution are revoked.
- Existing RLS decides which Researcher/Designer may update the workspace/test/task rows.
- Missing or non-draft test version and missing task fail atomically; neither half of the mapping remains persisted.
- Provider details are not returned to the client.

## Out of scope

- Figma REST frame enumeration or `flowStartingPoints` import.
- Researcher OAuth authorization/token exchange.
- Automatic discovery of success/failure targets.
- Conflicting success/failure rule semantics; Task 30 owns that editor/validation behavior.

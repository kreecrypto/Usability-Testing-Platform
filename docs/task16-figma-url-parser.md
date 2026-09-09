# Task 16 — Figma Prototype URL Parser

## Source boundary

Task 16 parses identifiers that are present in public Figma prototype URLs. The simplified V1 does not use Researcher OAuth login, client-secret exchange, private-file access, or Figma REST metadata for this task.

Figma's prototype embed URL format is `/proto/:file_key`. The prototype embed parameters `node-id` and `starting-point-node-id` identify the initially displayed node and the prototype flow start point respectively.

## Parser contract

`parsePublicFigmaPrototypeUrl`:

- accepts HTTPS prototype URLs from `figma.com`, `www.figma.com`, and `embed.figma.com`;
- requires the `/proto/:file_key` path and parses the file key from that path;
- parses optional `node-id` and `starting-point-node-id` values;
- rejects duplicate identity parameters so the application never has two competing values for the same identifier;
- rejects empty, oversized, or unsafe identifier values and URLs containing credentials;
- preserves non-identity prototype query parameters while pinning `embed-host` to the UT Platform host identifier;
- clears URL fragments before producing the embed URL.

## Explicit non-goals

- No Figma REST metadata lookup.
- No OAuth token exchange.
- No inference of frame meaning from a node ID.
- No success/failure target mapping; that belongs to Task 17.
- No provider event interpretation; that belongs to GWD-03 / GWD-04.

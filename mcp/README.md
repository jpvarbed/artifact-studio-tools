# Artifact Studio — MCP server

A stdio [MCP](https://modelcontextprotocol.io) server that lets any MCP client (Claude Code, Claude
Desktop, Cursor, …) publish apps to Artifact Studio. Wraps the `/v1` HTTP API.

## Tools

- `publish_artifact({ slug, kind: svg|html|markdown, content, title?, visibility?, commentsEnabled? })` → `{ url, updated }`
- `deploy_app({ slug, files: [{ path, content }], title?, visibility?, commentsEnabled?, csp?, staging? })` → `{ url, updated, version, target }` — multi-file, esm.sh-style
- `promote_app({ slug })` · `rollback_app({ slug, n? })` · `list_app_versions({ slug })` — versioning (ADR-0009)
- `provision_backend({ slug })` → `{ dataKey }` — managed KV backend for an app
- `list_artifacts()` · `get_artifact({ slug, k? })` · `delete_artifact({ slug })`

**Redeploy / versions:** call `publish_artifact`/`deploy_app` again with a slug you own to deploy a
new immutable version — same URL + token. Files dropped from the set are simply absent in the new
version (no prune). `rollback_app` restores an earlier version; `deploy_app({ staging: true })` then
`promote_app` previews before going live. Omitted options (e.g. `visibility`) are preserved.

## Configure

The server needs one env var:

- `ARTIFACT_API_KEY` — mint at `studio.artifacts.jasonv.dev → Settings`
- `ARTIFACT_API_BASE` — optional; defaults to the hosted API, set it to self-host

### Claude Code (`.mcp.json`) / Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "artifact-studio": {
      "command": "bun",
      "args": ["run", "/ABSOLUTE/PATH/TO/artifact-studio-tools/mcp/src/index.ts"],
      "env": {
        "ARTIFACT_API_KEY": "ak_…"
      }
    }
  }
}
```

Run `bun install` in the repo first. Then an agent can call `deploy_app` to ship a React-on-esm.sh
app (no build) and get back a live `https://<slug>.jasonv.app` URL.

## Smoke test

```bash
ARTIFACT_API_KEY=… bun run mcp/src/index.ts   # then speak JSON-RPC on stdin
```

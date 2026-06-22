# Artifact Studio — MCP server

A stdio [MCP](https://modelcontextprotocol.io) server that lets any MCP client (Claude Code, Claude
Desktop, Cursor, …) publish apps to Artifact Studio. Wraps the `/v1` HTTP API.

## Tools

- `publish_artifact({ slug, kind: svg|html|markdown, content, title?, visibility?, commentsEnabled? })` → `{ url }`
- `deploy_app({ slug, files: [{ path, content }], title?, visibility?, commentsEnabled?, csp? })` → `{ url }` — multi-file, esm.sh-style
- `provision_backend({ slug })` → `{ dataKey }` — managed KV backend for an app
- `list_artifacts()` · `get_artifact({ slug, k? })` · `delete_artifact({ slug })`

## Configure

The server reads two env vars:

- `ARTIFACT_API_BASE` — `https://amiable-crocodile-777.convex.site`
- `ARTIFACT_API_KEY` — mint at `studio.artifacts.jasonv.dev → Settings`

### Claude Code (`.mcp.json`) / Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "artifact-studio": {
      "command": "bun",
      "args": ["run", "/ABSOLUTE/PATH/TO/artifact-studio-tools/mcp/src/index.ts"],
      "env": {
        "ARTIFACT_API_BASE": "https://amiable-crocodile-777.convex.site",
        "ARTIFACT_API_KEY": "ak_…"
      }
    }
  }
}
```

Run `bun install` in the repo first. Then an agent can call `deploy_app` to ship a React-on-esm.sh
app (no build) and get back a live `https://artifacts.jasonv.dev/<slug>/` URL.

## Smoke test

```bash
ARTIFACT_API_BASE=… ARTIFACT_API_KEY=… bun run mcp/src/index.ts   # then speak JSON-RPC on stdin
```

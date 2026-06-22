# Artifact Studio — tools

Agent-facing tooling for **[Artifact Studio](https://studio.artifacts.jasonv.dev)**: a Claude
**skill**, a **CLI**, and an **MCP server** for publishing apps to a public URL
(`https://artifacts.jasonv.dev/<slug>/`). These are thin clients over the studio's `/v1` HTTP API —
the app/service itself lives elsewhere.

```
build something  →  publish  →  https://artifacts.jasonv.dev/<slug>/
```

## Get a key

Reads are public (per app visibility); publishing needs a key.

1. **Sign in** to [studio.artifacts.jasonv.dev](https://studio.artifacts.jasonv.dev) — enter your
   email, click the one-time link (no password).
2. Go to **Settings → API keys → Mint key**. The key is shown once — copy it now.

Apps published with a key belong to your account, so they show up in your studio **Mine** tab
alongside anything you make in the browser. (Already published with a key before signing in?
Settings → **Import existing apps** pulls them in.) Then:

```bash
export ARTIFACT_API_BASE="https://amiable-crocodile-777.convex.site"
export ARTIFACT_API_KEY="ak_…"
bun install
```

## Use it

| Surface | For | Docs |
|---|---|---|
| **Skill** `share-artifact` | In a Claude session | [`skills/share-artifact`](skills/share-artifact/SKILL.md) |
| **CLI** | Terminals, scripts, agents | [`cli/`](cli/README.md) |
| **MCP server** | Any MCP client | [`mcp/`](mcp/README.md) |

```bash
bun run cli share diagram.svg --slug org-chart --visibility public
bun run cli deploy ./my-react-app --slug my-app     # multi-file, esm.sh, no build step
bun run cli backend my-app                           # optional per-app key-value store
bun run cli list
```

Apps are static files or text content rendered full-page on their own isolated origin (network
allowed, so esm.sh / CDN imports work). A `deploy` folder must contain `index.html` and use relative
or CDN-absolute paths.

## Install the skill

Add it to `~/.claude/skills` (Claude Code) so any session can publish:

```bash
ln -sfn "$PWD/skills/share-artifact" ~/.claude/skills/share-artifact
# or: skills add https://github.com/jpvarbed/artifact-studio-tools --skill share-artifact -g
```

## Layout

```
cli/    the `artifact` CLI (share | deploy | backend | list/get/delete)
mcp/    MCP server (publish_artifact, deploy_app, provision_backend, …)
skills/ the share-artifact Claude skill
```

The studio web app + Convex backend that these talk to live in a separate service repo.

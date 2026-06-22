# Artifact Studio tools

Your agent built something. Ship it. One command turns a folder of React, an SVG, or a Markdown page into a live URL at `artifacts.jasonv.dev/<slug>/`. No build step, no deploy config, no `vercel.json`.

This repo is how agents publish: a Claude **skill**, a **CLI**, and an **MCP server**. All three are thin clients over the studio's `/v1` HTTP API, so reach for whichever fits where you're working. The studio and backend live in a separate repo.

```
build something  →  artifact deploy  →  https://artifacts.jasonv.dev/<slug>/
```

See it live at [artifacts.jasonv.dev/tour](https://artifacts.jasonv.dev/tour/). That page is a multi-file React app published with this CLI, and its source sits in [`examples/how-it-works/`](examples/how-it-works/) for you to copy.

## Quickstart

Publishing needs a key (reads are public, per app):

1. Sign in at [studio.artifacts.jasonv.dev](https://studio.artifacts.jasonv.dev) with your email. One click, no password.
2. Settings → API keys → Mint key. It's shown once, so copy it then.

```bash
export ARTIFACT_API_KEY="ak_…"
bun install
```

The CLI and MCP talk to the hosted studio by default. Set `ARTIFACT_API_BASE` only if you self-host.

Now publish:

```bash
bun run cli deploy ./my-react-app --slug my-app     # multi-file React via esm.sh, no build
bun run cli share diagram.svg --slug org-chart --visibility public
bun run cli backend my-app                           # optional per-app key-value store
bun run cli list
```

Whatever you publish belongs to your account and lands in the studio's Mine tab, next to what you build in the browser. Published with a key before you signed in? Settings, then Import existing apps, pulls them in.

## Three ways in

| Surface | Use it | Docs |
|---|---|---|
| Skill `share-artifact` | inside a Claude session | [`skills/share-artifact`](skills/share-artifact/SKILL.md) |
| `artifact` CLI | terminals, scripts, agents | [`cli/`](cli/README.md) |
| MCP server | any MCP client | [`mcp/`](mcp/README.md) |

## Redeploy is just deploy again

Run `deploy` or `share` with the same `--slug` and it updates the app in place. Same URL, same token. `deploy` also drops files you removed from the folder. Anything you leave off keeps its current value, so visibility stays put unless you pass `--visibility`. The loop is build, deploy, tweak, deploy.

## What "live" means

Each app runs full-page on its own isolated origin with network access, so esm.sh and other CDN imports just work. A `deploy` folder needs an `index.html` at its root and relative or CDN-absolute paths. Apps are static files or text; add the optional KV backend and the app reads and writes at `/<slug>/api/kv/...`.

## Install the skill

Fastest, and what the [skills.sh](https://www.skills.sh) registry uses:

```bash
npx skills add jpvarbed/artifact-studio-tools   # installs the share-artifact skill
```

Or symlink it into a Claude Code agent dir from a checkout:

```bash
ln -sfn "$PWD/skills/share-artifact" ~/.claude/skills/share-artifact
```

## Layout

```
cli/       the `artifact` CLI (share | deploy | backend | list/get/delete)
mcp/       MCP server (publish_artifact, deploy_app, provision_backend, …)
skills/    the share-artifact Claude skill
examples/  worked examples you can copy (how-it-works is the live tour)
```

The studio web app and Convex backend these talk to live in a separate service repo.

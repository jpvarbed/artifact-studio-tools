---
name: share-artifact
description: Publish/host an app or artifact you built to Artifact Studio and get a public URL to share. Use after building an SVG/diagram, an interactive HTML widget, a Markdown one-pager, or a real multi-file React app (via esm.sh, no build) that you want to hand someone as a link — or when the user says "share this", "publish this", "host this", "give me a link", or "deploy this app". Apps go live at artifacts.jasonv.dev/<slug>/.
---

# Share / host an app on Artifact Studio

Publishes to Artifact Studio and returns a public URL, `https://artifacts.jasonv.dev/<slug>/`.
Three surfaces wrap one API; this skill drives the CLI. (Repo: `jpvarbed/artifact-studio-tools`.)

**Announce at start:** "Using share-artifact to publish this."

## Setup

From a checkout of the artifact-studio-tools repo (`bun install` once), export your credentials:

```bash
export ARTIFACT_API_BASE="https://amiable-crocodile-777.convex.site"
export ARTIFACT_API_KEY="ak_…"   # see below
```

If the key is missing, tell the user: sign in at **studio.artifacts.jasonv.dev** (email → one-time
link, no password), then **Settings → API keys → Mint key** (shown once). Apps published with that
key belong to their account and appear in the studio **Mine** tab. Run the CLI as
`bun run cli <args>` from the repo root (or `bun cli/src/index.ts <args>`).

## Publish a single file (svg / html / markdown)

```bash
bun run cli share <file> --slug <slug> [--kind svg|html|markdown] [--title "..."] \
  [--visibility private|unlisted|public] [--comments]
```

`--kind` is inferred from the extension. `--slug` is the URL. Default visibility `unlisted` (link
includes a `?k=` token). Prints the URL — hand it back.

**To update an existing app, re-run with the same `--slug`** — it updates in place (same URL + token),
not a new app. A slug you don't own or a retired one errors `taken` (pick another). Options you omit
are preserved, so to keep the current visibility just leave `--visibility` off.

## Deploy a multi-file app — real React, no build step (esm.sh)

Write `index.html` + JS modules that import deps from a CDN at runtime (no bundler):

```html
<script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom/client":"https://esm.sh/react-dom@19/client"}}</script>
<div id="root"></div>
<script type="module" src="./app.js"></script>
```

Then deploy the folder (must contain `index.html`; use relative or CDN-absolute paths):

```bash
bun run cli deploy <dir> --slug <slug> [--title "..."] [--visibility ...] [--comments]
```

Re-running `deploy` with the same `--slug` updates the app in place (same URL + token) and removes
files no longer in the folder. Prints `created`/`updated <slug>` and `- <path>` for each pruned file.

## Optional managed backend (per-app key-value store)

```bash
bun run cli backend <slug>     # prints a per-app data key (shown once)
```

From the app's frontend (same origin): `fetch("/api/kv/<collection>/<key>", { method:"PUT",
headers:{ "X-App-Key": KEY }, body: JSON.stringify(v) })` (GET → `{value}`; `/api/kv/<collection>`
lists). Shared storage, not per-end-user-private.

## Manage

```bash
bun run cli list            # your apps
bun run cli get <slug>      # one app's metadata
bun run cli delete <slug>   # remove one
```

## Notes

- Apps run full-page on their own origin (network allowed; HTML/React apps run their JS live),
  isolated from the studio's keys.
- Same actions are available as **MCP tools** (`mcp`: `publish_artifact`, `deploy_app`,
  `provision_backend`, `list/get/delete_artifact`) and a **REST API** at `$ARTIFACT_API_BASE/v1`
  (`/openapi.json`). See `cli/README.md` and `mcp/README.md`.

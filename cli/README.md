# artifact — CLI

Publish apps to Artifact Studio from the terminal. Wraps the `/v1` HTTP API.

## Setup

```bash
bun install                          # from the repo root
export ARTIFACT_API_KEY="ak_…"       # mint at studio.artifacts.jasonv.dev → Settings
```

The CLI talks to the hosted studio by default; set `ARTIFACT_API_BASE` only to self-host.

Run via `bun run cli <args>` (from the repo root) or `bun cli/src/index.ts <args>`. To get a
global `artifact` command: `bun link` in `cli`, or alias it.

## Commands

```
artifact share <file>  [options]   publish a single file (svg|html|markdown), print its URL
artifact deploy <dir>  [options]   deploy a multi-file site (esm.sh-style, no build)
artifact deploy <dir>  --staging   deploy to the staging origin (<slug>--staging.<domain>)
artifact promote <slug>            promote the staged version to live
artifact rollback <slug> [version] roll live back to an earlier (or the previous) version
artifact versions <slug>           list versions (live/staging marked)
artifact backend <slug>            provision a managed KV backend; prints the per-app data key
artifact list                      list your apps
artifact get <slug>                print one app's metadata
artifact delete <slug>             delete an app
artifact --help
```

**Options** (share/deploy): `--slug <slug>` (the URL; default from filename/dir),
`--kind svg|html|markdown` (share only; inferred from extension), `--title "..."`,
`--visibility private|unlisted|public` (default `unlisted` on first publish), `--comments`,
`--csp "<policy>"`, `--staging` (deploy only), `--json`.

**Redeploy & versions (ADR-0009):** run `share`/`deploy` again with the same `--slug` to deploy a new
immutable version — same URL, same token. Files you drop from the folder are simply absent in the new
version (no prune step). Roll back a bad deploy with `artifact rollback`; preview with `deploy
--staging` then `promote`. Options you omit are preserved (leave off `--visibility` and the current
one stays). `deploy` prints `created`/`updated <slug> (vN)`.

## Examples

```bash
# a diagram
bun run cli share architecture.svg --slug release-architecture --visibility public

# a real React app (index.html imports react from esm.sh — no bundler)
bun run cli deploy ./my-app --slug my-app --title "My App"
bun run cli backend my-app            # → data key; call /api/kv/<collection>/<key> from the app

# manage
bun run cli list
bun run cli delete my-app
```

A `deploy` folder must contain `index.html` at its root and use relative or CDN-absolute paths
(e.g. `https://esm.sh/react@19`). Slugs are globally unique: one you don't own (or a retired one)
errors `taken`; re-using your own slug updates it (see Redeploy above). Unlisted apps' URLs include
a `?k=<token>`.

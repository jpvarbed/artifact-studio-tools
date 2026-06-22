# artifact — CLI

Publish apps to Artifact Studio from the terminal. Wraps the `/v1` HTTP API.

## Setup

```bash
bun install                                              # from the repo root
export ARTIFACT_API_BASE="https://amiable-crocodile-777.convex.site"
export ARTIFACT_API_KEY="ak_…"   # mint at studio.artifacts.jasonv.dev → Settings
```

Run via `bun run cli <args>` (from the repo root) or `bun cli/src/index.ts <args>`. To get a
global `artifact` command: `bun link` in `cli`, or alias it.

## Commands

```
artifact share <file>  [options]   publish a single file (svg|html|markdown), print its URL
artifact deploy <dir>  [options]   deploy a multi-file site (esm.sh-style, no build)
artifact backend <slug>            provision a managed KV backend; prints the per-app data key
artifact list                      list your apps
artifact get <slug>                print one app's metadata
artifact delete <slug>             delete an app
artifact --help
```

**Options** (share/deploy): `--slug <slug>` (the URL; default from filename/dir),
`--kind svg|html|markdown` (share only; inferred from extension), `--title "..."`,
`--visibility private|unlisted|public` (default `unlisted`), `--comments`, `--csp "<policy>"`,
`--json`.

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
(e.g. `https://esm.sh/react@19`). Slugs are globally unique (errors `taken`/`reserved` → pick another).
Unlisted apps' URLs include a `?k=<token>`.

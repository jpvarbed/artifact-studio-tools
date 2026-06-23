---
name: build-artifact-app
description: Use when building a real interactive web app to host on Artifact Studio (apps go live at <slug>.jasonv.app), not just publishing a file you already made. Covers designing it, building it as a multi-file React app from esm.sh with no build step, adding the optional KV backend, and deploying + redeploying with the artifact CLI. Use whenever the task is "build and ship an app/tool/page" and the output should be a live URL.
---

# Build an Artifact Studio app

Design, build, and ship a real app to a live URL at `<slug>.jasonv.app`. Apps are multi-file static sites served full-page on their own origin with network access, so they load dependencies straight from a CDN. **There is no build step.** For publishing a one-off file you already made (an SVG, a Markdown page), use the `share-artifact` skill instead.

**Default to a multi-file React app from esm.sh.** A single self-contained HTML file is the exception, for something trivial. Real interactivity or more than ~100 lines means React + esm.sh.

## 1. Design first

Don't jump to code. Spend a moment on what you're building and how it should feel.

- If the ask is open-ended, sketch the idea before coding (a brainstorming skill helps if you have one).
- Make it feel built, not templated. A clear visual direction plus the small details that read as care: concentric border radii, `tabular-nums` on changing numbers, a subtle scale-on-press, staggered enter animations. (If you have `frontend-design` or `make-interfaces-feel-better` skills, use them.)
- Decide: does it need to store data across visits? If yes, you need the KV backend (step 3).

## 2. Build — multi-file React from esm.sh (no bundler)

A folder with `index.html` at the root, plus JS modules. Pin esm.sh versions. Each app is served at the root of its own origin (`<slug>.jasonv.app`), so relative (`./app.js`), root-absolute (`/app.js`), and CDN (`https://…`) paths all resolve — relative is safest.

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My App</title>
    <link rel="stylesheet" href="./styles.css" />
    <script type="importmap">
      { "imports": {
        "react": "https://esm.sh/react@19.0.0",
        "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
        "htm": "https://esm.sh/htm@3.1.1"
      } }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./app.js"></script>
  </body>
</html>
```

`app.js` uses **`htm`** for markup, not JSX. There's no transform step, so JSX would not run.

```js
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
const html = htm.bind(React.createElement);

function App() {
  const [n, setN] = useState(0);
  return html`<button onClick=${() => setN(n + 1)}>count ${n}</button>`;
}
createRoot(document.getElementById("root")).render(html`<${App} />`);
```

**Gotchas that will bite you:**

| Gotcha | Fix |
| --- | --- |
| `&lt;slug&gt;` shows up literally in output | HTML entities in `htm` template literals render as text. Use a JS expression: `${"<slug>"}`. |
| Multi-line `<pre>`/code mashes onto one line | `htm` collapses whitespace (incl. newlines) *between* elements, so one `<span>` per line gets concatenated. Render the block as one string with real `\n`: `` html`<pre>${code}</pre>` `` where `code = ["line1","line2"].join("\n")`. (String children keep their newlines; only inter-element whitespace is dropped.) |
| Styled `<button>`/`<input>` text is dark/invisible | Buttons & inputs do **not** inherit `color` — they default to the browser's (dark) UA color. Set `color: var(--ink)` (or your theme color) explicitly on every interactive element. |
| Bare `<script>` JSX | No build step. Use `htm`, or precompiled output. |
| Asset path confusion | Each app owns its origin (`<slug>.jasonv.app`), so `./foo.js`, `/foo.js`, and CDN URLs all work. Prefer relative. |
| `import "react"` fails | Pin it in the importmap (`react@19.0.0`), don't rely on bare specifiers resolving. |
| No `index.html` at root | `/` 404s. The root document must be `index.html`. |

## 3. Optional KV backend

If the app stores data, provision a per-app key-value store, then read/write from the frontend (same origin):

```bash
bun run cli backend <slug>     # prints a per-app data key (shown once); embed it in the app
```

```js
await fetch("/api/kv/scores/top", {
  method: "PUT", headers: { "X-Data-Key": KEY }, body: JSON.stringify(value),
});
// GET → { value }; GET /api/kv/<collection> lists. No X-End-User = app-shared data.
```

**Per-user data (ART-5).** Send an `X-End-User` header and the rows become private to that visitor.
Mint a per-visitor secret once and keep it in `localStorage` — different visitors can't see each
other's data, and the same visitor gets theirs back on return:

```js
const EU = localStorage.getItem("eu") ?? (() => { const v = crypto.randomUUID(); localStorage.setItem("eu", v); return v; })();
const h = { "X-Data-Key": KEY, "X-End-User": EU };
await fetch("/api/kv/notes/draft", { method: "PUT", headers: h, body: JSON.stringify(text) });
const { value } = await (await fetch("/api/kv/notes/draft", { headers: h })).json();
```

It's capability-based, not a login: the id is a secret per device (not cross-device, not authenticated).
Drop `X-End-User` for shared state (leaderboards, global counters); include it for "my stuff."

The data key only exists after the app does, so it's a three-step bootstrap: `deploy` once, run
`backend <slug>` to get the key, embed it, then `deploy` again. After that, normal redeploys.

## 4. Deploy

Credentials: set `ARTIFACT_API_KEY` (mint one at studio.artifacts.jasonv.dev → Settings; the `share-artifact` skill has the details). The API base defaults to the hosted studio.

```bash
bun run cli deploy ./my-app --slug my-app --visibility public --title "My App"
```

Prints `https://my-app.jasonv.app`. Unlisted links carry a `?k=` token.

**Redeploy = a new immutable version.** Re-run `deploy` with the same `--slug`: same URL, same token, but each deploy is a saved version. Files you drop from the folder are just absent in the new version (no prune). Leave `--visibility` off to keep the current setting.

- `artifact rollback <slug> [version]` — undo a bad deploy (live points back at an earlier version).
- `artifact deploy <dir> --slug x --staging` → preview at `x--staging.jasonv.app` without touching live, then `artifact promote x`.
- `artifact versions <slug>` — list versions (live/staging marked).

The loop is build → deploy → tweak → deploy, with rollback as the safety net and `--staging` when you want to review before going live.

## 5. Verify before you hand it over

Load the live URL in a browser, confirm it renders and the console is clean, and screenshot it. Don't claim it works unseen. The most common live failure is a wrong esm.sh path or a relative-path 404, both visible in the console.

**Caches lie when verifying a fix.** After a redeploy, a browser (and a headless/automation browser's persistent cache) can keep serving the *old* `app.js`/`styles.css` and make a correct fix look broken. Before concluding a fix didn't land, check the source of truth: `curl -s https://<slug>.jasonv.app/app.js | grep <your-change>`. If the server has it, it's just cache — hard-refresh (Cmd/Ctrl+Shift+R).

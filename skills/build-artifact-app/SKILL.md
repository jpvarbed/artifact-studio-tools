---
name: build-artifact-app
description: Use when building a real interactive web app to host on Artifact Studio (apps go live at artifacts.jasonv.dev/<slug>/), not just publishing a file you already made. Covers designing it, building it as a multi-file React app from esm.sh with no build step, adding the optional KV backend, and deploying + redeploying with the artifact CLI. Use whenever the task is "build and ship an app/tool/page" and the output should be a live URL.
---

# Build an Artifact Studio app

Design, build, and ship a real app to a live URL at `artifacts.jasonv.dev/<slug>/`. Apps are multi-file static sites served full-page on their own origin with network access, so they load dependencies straight from a CDN. **There is no build step.** For publishing a one-off file you already made (an SVG, a Markdown page), use the `share-artifact` skill instead.

**Default to a multi-file React app from esm.sh.** A single self-contained HTML file is the exception, for something trivial. Real interactivity or more than ~100 lines means React + esm.sh.

## 1. Design first

Don't jump to code. Spend a moment on what you're building and how it should feel.

- If the ask is open-ended, sketch the idea before coding (a brainstorming skill helps if you have one).
- Make it feel built, not templated. A clear visual direction plus the small details that read as care: concentric border radii, `tabular-nums` on changing numbers, a subtle scale-on-press, staggered enter animations. (If you have `frontend-design` or `make-interfaces-feel-better` skills, use them.)
- Decide: does it need to store data across visits? If yes, you need the KV backend (step 3).

## 2. Build — multi-file React from esm.sh (no bundler)

A folder with `index.html` at the root, plus JS modules. Pin esm.sh versions. Use relative or CDN-absolute paths only (the app is served from `/<slug>/`, never the domain root).

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
| Bare `<script>` JSX | No build step. Use `htm`, or precompiled output. |
| Absolute `/foo.js` 404s | App is served from `/<slug>/`. Use `./foo.js` or a full `https://` URL. |
| `import "react"` fails | Pin it in the importmap (`react@19.0.0`), don't rely on bare specifiers resolving. |
| No `index.html` at root | `/` 404s. The root document must be `index.html`. |

## 3. Optional KV backend

If the app stores data, provision a per-app key-value store, then read/write from the frontend (same origin):

```bash
bun run cli backend <slug>     # prints a per-app data key (shown once); embed it in the app
```

```js
await fetch("/api/kv/scores/alice", {
  method: "PUT", headers: { "X-App-Key": KEY }, body: JSON.stringify(value),
});
// GET → { value }; GET /api/kv/<collection> lists. Shared storage, not per-end-user-private.
```

The key only exists after the app does, so it's a three-step bootstrap: `deploy` once, run `backend <slug>` to get the key, embed it, then `deploy` again. After that, normal redeploys.

## 4. Deploy

Credentials: set `ARTIFACT_API_KEY` (mint one at studio.artifacts.jasonv.dev → Settings; the `share-artifact` skill has the details). The API base defaults to the hosted studio.

```bash
bun run cli deploy ./my-app --slug my-app --visibility public --title "My App"
```

Prints `https://artifacts.jasonv.dev/my-app/`. Unlisted links carry a `?k=` token.

**Redeploy is the same command.** Re-run `deploy` with the same `--slug` to update in place: same URL, same token. It replaces changed files and prunes ones you deleted. Leave `--visibility` off to keep the current setting. The loop is build, deploy, tweak, deploy.

## 5. Verify before you hand it over

Load the live URL in a browser, confirm it renders and the console is clean, and screenshot it. Don't claim it works unseen. The most common live failure is a wrong esm.sh path or a relative-path 404, both visible in the console.

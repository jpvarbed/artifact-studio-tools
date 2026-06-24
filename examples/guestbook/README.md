# Guestbook — a build-step example

A live demo app on Artifact Studio, built with a **real build step** (Vite + React + TypeScript, actual JSX/`.tsx`) instead of the no-build htm approach. It shows both KV persistence modes side by side: a **shared** guestbook feed and a **private** per-visitor note.

The point of this example: the host only serves static files, so you can build however you like — `vite build` produces a `dist/` folder, and you deploy that folder. You get JSX, types, and HMR; the host is none the wiser.

## Run it

```bash
bun install

# 1. first deploy (creates the app + URL)
bun run build && artifact deploy ./dist --slug my-guestbook --visibility public

# 2. provision the KV backend, paste the key into src/App.tsx (const KEY = ...)
artifact backend my-guestbook

# 3. rebuild + redeploy with the key baked in
bun run build && artifact deploy ./dist --slug my-guestbook
```

After that the loop is just: edit `src/*.tsx` → `bun run build` → `artifact deploy ./dist --slug my-guestbook`.

## Layout

```
index.html        Vite entry (fonts + <div id=root>)
vite.config.ts    base: "./"  → relative asset paths, so it serves from the app origin root
src/App.tsx       the component — real JSX, typed, style props are objects
src/main.tsx      createRoot
src/styles.css    the stylesheet
public/llms.txt   copied to the dist root → served at /llms.txt
```

## Notes

- `vite.config.ts` sets `base: "./"` so the built `index.html` references `./assets/...` — that resolves on the app's own origin.
- Anything in `public/` is copied verbatim to the deploy root. `llms.txt` lives there so it serves at `<slug>.jasonv.app/llms.txt`.
- The data key is public by design — it only unlocks this app's KV store, on this origin. Per-visitor rows use an `X-End-User` secret kept in `localStorage`.
- Prefer zero tooling? See `examples/how-it-works` for the no-build htm approach.

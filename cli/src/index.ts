#!/usr/bin/env bun
/**
 * artifact — publish apps to Artifact Studio from the terminal.
 *
 * Env:
 *   ARTIFACT_API_BASE   e.g. https://<deployment>.convex.site   (required)
 *   ARTIFACT_API_KEY    an ak_… key minted in the studio Settings (required for writes)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const HELP = `artifact — publish apps to Artifact Studio

USAGE
  artifact share <file> [options]      publish (or update) a single file, print its URL
  artifact deploy <dir> [options]      deploy (or update) a multi-file site (esm.sh-style, no build)
  artifact backend <slug>              provision a managed KV backend; prints the per-app data key
  artifact list                        list your apps
  artifact get <slug>                  print one app's metadata
  artifact delete <slug>               delete an app
  artifact --help

REDEPLOY
  Re-run share/deploy with the same --slug to UPDATE an app in place: same URL, same token.
  deploy also removes files no longer in the folder. Options you omit are preserved (e.g. leave
  off --visibility and the current visibility stays); pass an option to change it.

SHARE / DEPLOY OPTIONS
  --slug <slug>          subdomain label (default: from filename/dir)
  --kind <kind>          svg|html|markdown (default: inferred from extension)
  --title <title>        human title
  --visibility <v>       private|unlisted|public (default on first publish: unlisted)
  --comments             enable comments
  --json                 print raw JSON instead of the URL

ENV
  ARTIFACT_API_BASE   https://<deployment>.convex.site   (required)
  ARTIFACT_API_KEY    ak_… key from the studio Settings   (required for writes)

EXAMPLES
  artifact share diagram.svg --slug org-chart --visibility public
  artifact share notes.md --title "Release notes"
  echo "$ARTIFACT_API_KEY" >/dev/null; artifact list --json
`;

function fail(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function has(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} is not set`);
  return v;
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8", ts: "text/javascript; charset=utf-8",
  tsx: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8", map: "application/json; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", ico: "image/x-icon", wasm: "application/wasm",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", txt: "text/plain; charset=utf-8",
};
function mimeFor(p: string): string {
  return MIME[p.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

const SKIP = new Set([".git", "node_modules", ".DS_Store", ".vercel", ".convex"]);
function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full);
  }
  return out;
}

function kindFromExt(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".svg") return "svg";
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  fail(`cannot infer --kind from "${ext}" — pass --kind`);
}

async function api(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<any> {
  const base = env("ARTIFACT_API_BASE").replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (init.auth !== false) headers["Authorization"] = `Bearer ${env("ARTIFACT_API_KEY")}`;
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) fail(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

async function share(args: string[]) {
  const file = args.find((a) => !a.startsWith("--") && a !== args[0]);
  if (!file) fail("usage: artifact share <file> [options]");
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    fail(`cannot read file: ${file}`);
  }
  const kind = flag(args, "kind") ?? kindFromExt(file);
  const slug = flag(args, "slug") ?? basename(file, extname(file));
  const body = {
    slug,
    kind,
    title: flag(args, "title"),
    content,
    visibility: flag(args, "visibility"), // omit → server defaults (new) or preserves (update)
    commentsEnabled: has(args, "comments") ? true : undefined,
    csp: flag(args, "csp"),
  };
  const out = await api("/v1/apps", { method: "POST", body: JSON.stringify(body) });
  process.stderr.write(`${out.updated ? "updated" : "created"} ${out.slug}\n`);
  if (has(args, "json")) console.log(JSON.stringify(out, null, 2));
  else console.log(out.url + (out.visibility === "unlisted" ? `?k=${out.token}` : ""));
}

async function deploy(args: string[]) {
  const dir = args.find((a) => !a.startsWith("--") && a !== args[0]);
  if (!dir) fail("usage: artifact deploy <dir> [options]");
  let files: string[];
  try {
    files = walk(dir);
  } catch {
    fail(`cannot read directory: ${dir}`);
  }
  if (!files.length) fail(`no files found in ${dir}`);
  if (!files.some((f) => relative(dir, f) === "index.html"))
    process.stderr.write("warning: no index.html at the site root — '/' will 404\n");

  const slug = flag(args, "slug") ?? basename(dir.replace(/\/$/, ""));
  const site = await api("/v1/sites", {
    method: "POST",
    body: JSON.stringify({
      slug,
      title: flag(args, "title"),
      visibility: flag(args, "visibility"), // omit → server defaults (new) or preserves (update)
      commentsEnabled: has(args, "comments") ? true : undefined,
      csp: flag(args, "csp"),
    }),
  });

  const localPaths = new Set<string>();
  for (const full of files) {
    const path = relative(dir, full).split("\\").join("/");
    localPaths.add(path);
    const bytes = readFileSync(full);
    const ct = mimeFor(path);
    const { url } = await api("/v1/uploads", { method: "POST" });
    const up = await fetch(url, { method: "POST", headers: { "Content-Type": ct }, body: bytes });
    const { storageId } = await up.json();
    await api(`/v1/sites/${encodeURIComponent(site.slug)}/files`, {
      method: "POST",
      body: JSON.stringify({ path, storageId, size: bytes.length, contentType: ct }),
    });
    process.stderr.write(`  + ${path}\n`);
  }

  // On update, prune files that are live on the server but no longer in the folder.
  if (site.updated) {
    const { files: remote } = await api(`/v1/sites/${encodeURIComponent(site.slug)}/files`, { method: "GET" });
    for (const f of remote as { path: string }[]) {
      if (!localPaths.has(f.path)) {
        await api(`/v1/sites/${encodeURIComponent(site.slug)}/files?path=${encodeURIComponent(f.path)}`, { method: "DELETE" });
        process.stderr.write(`  - ${f.path}\n`);
      }
    }
  }

  process.stderr.write(`${site.updated ? "updated" : "created"} ${site.slug}\n`);
  if (has(args, "json")) console.log(JSON.stringify({ ...site, files: files.length }, null, 2));
  else console.log(site.url + (site.visibility === "unlisted" ? `?k=${site.token}` : ""));
}

async function backend(args: string[]) {
  const slug = args[1];
  if (!slug) fail("usage: artifact backend <slug>");
  const out = await api(`/v1/sites/${encodeURIComponent(slug)}/backend`, { method: "POST" });
  if (has(args, "json")) console.log(JSON.stringify(out, null, 2));
  else {
    process.stderr.write("Per-app data key (shown once). Embed it in your app and send as X-App-Key:\n");
    console.log(out.dataKey);
    process.stderr.write(`\nUse it: fetch("/api/kv/<collection>/<key>", { headers: { "X-App-Key": KEY } })\n`);
  }
}

async function list(args: string[]) {
  const out = await api("/v1/apps", { method: "GET" });
  if (has(args, "json")) return void console.log(JSON.stringify(out, null, 2));
  for (const a of out.apps) console.log(`${a.slug}\t${a.kind}\t${a.visibility}\t${a.url}`);
}

async function get(args: string[]) {
  const slug = args[1];
  if (!slug) fail("usage: artifact get <slug>");
  const out = await api(`/v1/apps/${encodeURIComponent(slug)}`, { method: "GET", auth: false });
  console.log(JSON.stringify(out, null, 2));
}

async function del(args: string[]) {
  const slug = args[1];
  if (!slug) fail("usage: artifact delete <slug>");
  await api(`/v1/apps/${encodeURIComponent(slug)}`, { method: "DELETE" });
  console.log(`deleted ${slug}`);
}

const args = process.argv.slice(2);
const cmd = args[0];
if (!cmd || cmd === "--help" || cmd === "-h") {
  process.stdout.write(HELP);
  process.exit(0);
}
const run = { share, deploy, backend, list, get, delete: del }[cmd as "share"];
if (!run) fail(`unknown command: ${cmd} (try --help)`);
await run(args);

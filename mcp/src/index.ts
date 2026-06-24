#!/usr/bin/env bun
/**
 * Artifact Studio MCP server (stdio). Lets any agent publish/manage apps.
 *
 * Env:
 *   ARTIFACT_API_KEY    ak_… key from the studio Settings   (required)
 *   ARTIFACT_API_BASE   optional; defaults to the hosted API, set it to self-host
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// The hosted studio API. Override ARTIFACT_API_BASE only to point at your own deployment.
const DEFAULT_API_BASE = "https://amiable-crocodile-777.convex.site";
const API_BASE = (process.env.ARTIFACT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
const API_KEY = process.env.ARTIFACT_API_KEY ?? "";

async function api(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (init.auth !== false) {
    if (!API_KEY) throw new Error("ARTIFACT_API_KEY is not set");
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const err = (e: unknown) => ({ content: [{ type: "text" as const, text: `error: ${String((e as Error)?.message ?? e)}` }], isError: true });

const server = new McpServer({ name: "artifact-studio", version: "1.0.0" });

server.tool(
  "publish_artifact",
  "Publish (or update) an app on Artifact Studio and return its public URL. Use for svg, html, or markdown content. Re-using a slug you own UPDATES it in place (same URL + token); omitted options like visibility are preserved.",
  {
    slug: z.string().describe("Subdomain label, e.g. 'org-chart'. Slugified. Re-use your own slug to update in place."),
    kind: z.enum(["svg", "html", "markdown"]),
    content: z.string().describe("The full artifact content (SVG/HTML/Markdown source)."),
    title: z.string().optional(),
    visibility: z.enum(["private", "unlisted", "public"]).optional().describe("Default unlisted on first publish; preserved on update."),
    commentsEnabled: z.boolean().optional(),
    csp: z.string().optional().describe("Optional Content-Security-Policy; overrides the permissive default."),
    llmsTxt: z.string().optional().describe("Agent-facing manifest (markdown) served at <slug>.<domain>/llms.txt — describe what the app does, its routes, and any data API so other agents can use it. Recommended for every app."),
  },
  async (args) => {
    try {
      const out = await api("/v1/apps", { method: "POST", body: JSON.stringify(args) });
      const url = out.url + (out.visibility === "unlisted" ? `?k=${out.token}` : "");
      return ok({ slug: out.slug, url, updated: out.updated });
    } catch (e) {
      return err(e);
    }
  },
);

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8", jsx: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json; charset=utf-8",
  svg: "image/svg+xml", txt: "text/plain; charset=utf-8",
};
const mimeFor = (p: string) => MIME[p.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

server.tool(
  "deploy_app",
  "Deploy (or update) a multi-file web app (esm.sh-style, no build step). Provide text files like index.html + JS modules that import deps from https://esm.sh at runtime. Each deploy is an immutable VERSION (ADR-0009): re-using a slug you own creates a new version (same URL + token) — files dropped from the list are simply absent in the new version (no prune). Pass staging:true to deploy to <slug>--staging.<domain> without touching live, then promote_app. Omitted options (e.g. visibility) are preserved. Returns the live URL + version.",
  {
    slug: z.string().describe("Subdomain label; slugified. Re-use your own slug to deploy a new version."),
    files: z
      .array(z.object({ path: z.string().describe("e.g. index.html, app.js"), content: z.string() }))
      .describe("The complete file set for this version. Must include index.html at the root."),
    title: z.string().optional(),
    visibility: z.enum(["private", "unlisted", "public"]).optional(),
    commentsEnabled: z.boolean().optional(),
    csp: z.string().optional().describe("Optional CSP to lock the app down; overrides the permissive default."),
    llmsTxt: z.string().optional().describe("Agent-facing manifest, uploaded as a versioned llms.txt file served at /llms.txt (equivalent to putting an llms.txt in `files`). Recommended for every app."),
    staging: z.boolean().optional().describe("Deploy to the staging origin instead of live."),
  },
  async ({ slug, files, title, visibility, commentsEnabled, csp, llmsTxt, staging }) => {
    try {
      if (!files.some((f) => f.path.replace(/^\//, "") === "index.html"))
        return err("files must include an index.html at the root");
      // New draft version — not live until finalize() below (zero-downtime redeploys, ADR-0009).
      const site = await api("/v1/sites", {
        method: "POST",
        body: JSON.stringify({ slug, title, visibility, commentsEnabled, csp }),
      });
      // llmsTxt ships as a versioned llms.txt FILE (stage-aware + finalize-gated), overriding any
      // llms.txt already in `files`.
      const allFiles = llmsTxt !== undefined
        ? [...files.filter((f) => f.path.replace(/^\//, "") !== "llms.txt"), { path: "llms.txt", content: llmsTxt }]
        : files;
      for (const f of allFiles) {
        const path = f.path.replace(/^\//, "") || "index.html";
        const ct = mimeFor(path);
        const { url } = await api("/v1/uploads", { method: "POST" });
        const up = await fetch(url, { method: "POST", headers: { "Content-Type": ct }, body: f.content });
        const { storageId } = await up.json();
        await api(`/v1/sites/${encodeURIComponent(site.slug)}/files`, {
          method: "POST",
          body: JSON.stringify({ path, storageId, size: f.content.length, contentType: ct }),
        });
      }
      const fin = await api(`/v1/sites/${encodeURIComponent(site.slug)}/finalize`, { method: "POST", body: JSON.stringify({ staging }) });
      const url = site.url + (site.visibility === "unlisted" ? `?k=${site.token}` : "");
      return ok({ slug: site.slug, url, files: files.length, updated: site.updated, version: fin.version, target: fin.target });
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "promote_app",
  "Promote an app's staged version to live (after a staging deploy_app).",
  { slug: z.string() },
  async ({ slug }) => {
    try { return ok(await api(`/v1/sites/${encodeURIComponent(slug)}/promote`, { method: "POST" })); }
    catch (e) { return err(e); }
  },
);

server.tool(
  "rollback_app",
  "Roll an app's live pointer back to an earlier version (omit n for the previous version).",
  { slug: z.string(), n: z.number().optional() },
  async ({ slug, n }) => {
    try { return ok(await api(`/v1/sites/${encodeURIComponent(slug)}/rollback`, { method: "POST", body: JSON.stringify({ n }) })); }
    catch (e) { return err(e); }
  },
);

server.tool(
  "list_app_versions",
  "List an app's deploy versions, with which is live and which is staged.",
  { slug: z.string() },
  async ({ slug }) => {
    try { return ok(await api(`/v1/sites/${encodeURIComponent(slug)}/versions`, { method: "GET" })); }
    catch (e) { return err(e); }
  },
);

server.tool(
  "provision_backend",
  "Give a deployed site a managed key-value backend. Returns a per-app data key to embed in the app; the app reads/writes at /api/kv/<collection>/<key> sending the key as the X-Data-Key header. Shared storage (not per-end-user private).",
  { slug: z.string() },
  async ({ slug }) => {
    try {
      const out = await api(`/v1/sites/${encodeURIComponent(slug)}/backend`, { method: "POST" });
      return ok({ dataKey: out.dataKey, usage: 'fetch("/api/kv/<collection>/<key>", { headers: { "X-Data-Key": dataKey } })' });
    } catch (e) {
      return err(e);
    }
  },
);

server.tool("list_artifacts", "List the apps you own.", {}, async () => {
  try {
    return ok(await api("/v1/apps", { method: "GET" }));
  } catch (e) {
    return err(e);
  }
});

server.tool(
  "get_artifact",
  "Get an app's metadata by slug.",
  { slug: z.string(), k: z.string().optional().describe("Token for unlisted apps.") },
  async ({ slug, k }) => {
    try {
      return ok(await api(`/v1/apps/${encodeURIComponent(slug)}${k ? `?k=${k}` : ""}`, { method: "GET", auth: false }));
    } catch (e) {
      return err(e);
    }
  },
);

server.tool("delete_artifact", "Delete one of your apps by slug.", { slug: z.string() }, async ({ slug }) => {
  try {
    await api(`/v1/apps/${encodeURIComponent(slug)}`, { method: "DELETE" });
    return ok({ deleted: slug });
  } catch (e) {
    return err(e);
  }
});

await server.connect(new StdioServerTransport());

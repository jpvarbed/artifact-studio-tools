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
  "Deploy (or update) a multi-file web app (esm.sh-style, no build step). Provide text files like index.html + JS modules that import deps from https://esm.sh at runtime. Re-using a slug you own UPDATES the app in place (same URL + token) and removes files no longer in the list. Omitted options (e.g. visibility) are preserved. Returns the live URL.",
  {
    slug: z.string().describe("Subdomain label; slugified. Re-use your own slug to update in place."),
    files: z
      .array(z.object({ path: z.string().describe("e.g. index.html, app.js"), content: z.string() }))
      .describe("The complete file set of the app (a redeploy replaces all files and prunes the rest). Must include index.html at the root."),
    title: z.string().optional(),
    visibility: z.enum(["private", "unlisted", "public"]).optional(),
    commentsEnabled: z.boolean().optional(),
    csp: z.string().optional().describe("Optional CSP to lock the app down; overrides the permissive default."),
  },
  async ({ slug, files, title, visibility, commentsEnabled, csp }) => {
    try {
      if (!files.some((f) => f.path.replace(/^\//, "") === "index.html"))
        return err("files must include an index.html at the root");
      const site = await api("/v1/sites", {
        method: "POST",
        body: JSON.stringify({ slug, title, visibility, commentsEnabled, csp }),
      });
      const localPaths = new Set<string>();
      for (const f of files) {
        const path = f.path.replace(/^\//, "") || "index.html";
        localPaths.add(path);
        const ct = mimeFor(path);
        const { url } = await api("/v1/uploads", { method: "POST" });
        const up = await fetch(url, { method: "POST", headers: { "Content-Type": ct }, body: f.content });
        const { storageId } = await up.json();
        await api(`/v1/sites/${encodeURIComponent(site.slug)}/files`, {
          method: "POST",
          body: JSON.stringify({ path, storageId, size: f.content.length, contentType: ct }),
        });
      }
      let pruned = 0;
      if (site.updated) {
        const { files: remote } = await api(`/v1/sites/${encodeURIComponent(site.slug)}/files`, { method: "GET" });
        for (const r of remote as { path: string }[]) {
          if (!localPaths.has(r.path)) {
            await api(`/v1/sites/${encodeURIComponent(site.slug)}/files?path=${encodeURIComponent(r.path)}`, { method: "DELETE" });
            pruned++;
          }
        }
      }
      const url = site.url + (site.visibility === "unlisted" ? `?k=${site.token}` : "");
      return ok({ slug: site.slug, url, files: files.length, updated: site.updated, pruned });
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "provision_backend",
  "Give a deployed site a managed key-value backend. Returns a per-app data key to embed in the app; the app reads/writes at /api/kv/<collection>/<key> sending the key as the X-App-Key header. Shared storage (not per-end-user private).",
  { slug: z.string() },
  async ({ slug }) => {
    try {
      const out = await api(`/v1/sites/${encodeURIComponent(slug)}/backend`, { method: "POST" });
      return ok({ dataKey: out.dataKey, usage: 'fetch("/api/kv/<collection>/<key>", { headers: { "X-App-Key": dataKey } })' });
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

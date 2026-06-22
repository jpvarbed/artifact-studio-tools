import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";

const html = htm.bind(React.createElement);
const REPO = "https://github.com/jpvarbed/artifact-studio-tools";

const KINDS = [
  { id: "site", name: "site", title: "Multi-file app (esm.sh, no build)", desc: "A real React/JS app — index.html plus modules and assets, served at its own path. Imports run straight from esm.sh, so there's no build step. This page is one.", ex: "deploy ./my-app  →  artifacts.jasonv.dev/my-app/" },
  { id: "html", name: "html", title: "Single self-contained page", desc: "One HTML file with inline CSS and JS. Great for a quick interactive widget or a one-off page you wrote by hand.", ex: "share page.html --kind html" },
  { id: "svg", name: "svg", title: "Vector graphic", desc: "A standalone SVG — a diagram, chart, or illustration — rendered full-page.", ex: "share org-chart.svg --kind svg" },
  { id: "markdown", name: "markdown", title: "Formatted document", desc: "A Markdown one-pager, rendered to clean styled HTML. Good for notes, specs, and write-ups.", ex: "share notes.md --kind markdown" },
  { id: "image", name: "image", title: "Image", desc: "A PNG/JPG hosted and shown full-bleed on its own URL.", ex: "share render.png --kind image" },
];

const VIS = [
  { id: "private", color: "#9499a2", who: "Only you, in your account.", url: null },
  { id: "unlisted", color: "#ffd14a", who: "Anyone with the secret link. Send it to specific people — no account needed.", url: "artifacts.jasonv.dev/demo/?k=•••secret" },
  { id: "public", color: "#5dcaa5", who: "Anyone, and it shows up in the Gallery.", url: "artifacts.jasonv.dev/demo/" },
];

function Header() {
  return html`
    <header class="rise" style=${{ animationDelay: "0ms" }}>
      <div class="brand">artifact<span>.studio</span></div>
      <a class="ghost-link" href=${REPO} target="_blank" rel="noopener">View the tools repo ↗</a>
    </header>`;
}

function Hero() {
  return html`
    <div class="hero">
      <span class="eyebrow rise" style=${{ animationDelay: "60ms" }}>Agent-native app host</span>
      <h1 class="rise" style=${{ animationDelay: "130ms" }}>Build something.<br/>Publish it. <span class="dim">Share a link.</span></h1>
      <p class="lede rise" style=${{ animationDelay: "210ms" }}>
        An agent builds an app — a diagram, a widget, or a full React app — and publishes it to a
        public URL in one step. No deploy config, no build server. You manage everything from one console.
      </p>
      <div class="cta-row rise" style=${{ animationDelay: "290ms" }}>
        <a class="btn btn-primary" href="https://studio.artifacts.jasonv.dev" target="_blank" rel="noopener">Open the studio</a>
        <a class="btn btn-secondary" href=${REPO} target="_blank" rel="noopener">Skill · CLI · MCP</a>
      </div>
    </div>`;
}

function Flow() {
  const steps = [
    { n: 1, h: "Build", p: html`An agent makes the thing — SVG, an HTML widget, or a multi-file React app pulling deps from esm.sh.` },
    { n: 2, h: "Publish", p: html`One call through the ${" "}<code>share-artifact</code> skill, the <code>artifact</code> CLI, or the MCP server.` },
    { n: 3, h: "Share", p: html`It's live at <code>artifacts.jasonv.dev/&lt;slug&gt;/</code>, sandboxed on its own origin. Copy the link.` },
  ];
  return html`
    <section class="rise" style=${{ animationDelay: "120ms" }}>
      <div class="kicker">The loop</div>
      <h2>Three steps, one URL</h2>
      <div class="steps">
        ${steps.map((s) => html`
          <div class="step" key=${s.n}>
            <div class="n">${s.n}</div>
            <h3>${s.h}</h3>
            <p>${s.p}</p>
          </div>`)}
      </div>
    </section>`;
}

function Kinds() {
  const [active, setActive] = useState("site");
  const k = KINDS.find((x) => x.id === active);
  return html`
    <section class="rise" style=${{ animationDelay: "140ms" }}>
      <div class="kicker">What you can publish</div>
      <h2>Five kinds of artifact</h2>
      <p class="sub">From a one-off graphic to a real app with a backend. Pick a kind to see what it's for.</p>
      <div class="card">
        <div class="tabs">
          ${KINDS.map((x) => html`
            <button class="tab" key=${x.id} data-on=${x.id === active} onClick=${() => setActive(x.id)}>${x.name}</button>`)}
        </div>
        <div class="kind-body" key=${k.id}>
          <h3>${k.title}</h3>
          <p>${k.desc}</p>
          <div class="ex mono">${k.ex}</div>
        </div>
      </div>
    </section>`;
}

function Visibility() {
  const [v, setV] = useState("unlisted");
  const cur = VIS.find((x) => x.id === v);
  return html`
    <section class="rise" style=${{ animationDelay: "160ms" }}>
      <div class="kicker">Who sees it</div>
      <h2>Private, by link, or public</h2>
      <p class="sub">Every app has one of three visibilities. Sharing with specific people is just an unlisted link — the token in the URL is the key.</p>
      <div class="card">
        <div class="vis-grid">
          ${VIS.map((x) => html`
            <button class="vis" key=${x.id} data-on=${x.id === v} onClick=${() => setV(x.id)}>
              <div><span class="dot" style=${{ background: x.color }}></span><span class="label">${x.id}</span></div>
              <div class="who">${x.who}</div>
            </button>`)}
        </div>
        <div class="share">
          <span class="lbl mono">${cur.url ? "share →" : "no link —"}</span>
          <span class="url mono">${cur.url ?? "this app is visible only to you"}</span>
        </div>
      </div>
    </section>`;
}

function Backend() {
  return html`
    <section class="rise" style=${{ animationDelay: "160ms" }}>
      <div class="kicker">Optional</div>
      <h2>Give an app a backend</h2>
      <p class="sub">Need to store data? Provision a managed key-value store for an app — one call, no server to run.</p>
      <div class="card">
        <pre><span class="c"># publish a multi-file React app, then add a KV store</span>
<span class="k">artifact</span> deploy ./my-app --slug my-app --visibility public
<span class="k">artifact</span> backend my-app
<span class="c"># the app reads + writes at</span>  <span class="s">/api/kv/&lt;collection&gt;/&lt;key&gt;</span></pre>
      </div>
    </section>`;
}

function Footer() {
  return html`
    <div class="meta-note rise" style=${{ animationDelay: "200ms" }}>
      <span class="pulse"></span>
      <span><b>This page is itself an Artifact Studio <span class="mono">site</span> app</b> — multi-file React from esm.sh, no build step, published with the CLI. <a class="mono" style=${{ color: "var(--accent)" }} href=${REPO + "/tree/main/examples/how-it-works"} target="_blank" rel="noopener">View its source ↗</a></span>
    </div>`;
}

function App() {
  return html`
    <div class="wrap">
      <${Header} />
      <${Hero} />
      <${Flow} />
      <${Kinds} />
      <${Visibility} />
      <${Backend} />
      <${Footer} />
    </div>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);

import { useState, useEffect, type FormEvent } from "react";

// Per-app data key. Get yours with `artifact backend <slug>` after the first deploy, then paste it
// here and redeploy. Public by design — it only grants access to THIS app's KV store, on this origin.
const KEY = "__PASTE_YOUR_DATA_KEY__";

// A per-visitor secret kept in localStorage → scopes "private" rows to this device (ART-5).
const EU =
  localStorage.getItem("eu") ??
  (() => {
    const v = crypto.randomUUID();
    localStorage.setItem("eu", v);
    return v;
  })();

const shared = { "X-Data-Key": KEY, "Content-Type": "application/json" };
const mine = { ...shared, "X-End-User": EU };

type Entry = { name: string; message: string; at: number };

const initial = (n: string) => (n || "?").trim().charAt(0).toUpperCase() || "?";
function avatarHue(n: string) {
  let h = 0;
  for (const c of n || "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const avatarBg = (n: string) =>
  `linear-gradient(140deg, hsl(${avatarHue(n)} 70% 58%), hsl(${(avatarHue(n) + 40) % 360} 70% 48%))`;

function relTime(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  async function loadEntries() {
    const r = await fetch("/api/kv/entries", { headers: shared });
    const { items = [] } = await r.json();
    setEntries(items.map((i: { value: Entry }) => i.value).sort((a: Entry, b: Entry) => b.at - a.at));
  }

  useEffect(() => {
    loadEntries();
    fetch("/api/kv/notes/me", { headers: mine })
      .then((r) => (r.ok ? r.json() : { value: { text: "" } }))
      .then((d) => setNote(d.value?.text ?? ""))
      .catch(() => {});
  }, []);

  async function sign(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await fetch(`/api/kv/entries/${id}`, {
      method: "PUT",
      headers: shared,
      body: JSON.stringify({ name: name.trim() || "anon", message: message.trim(), at: Date.now() }),
    });
    setMessage("");
    loadEntries();
  }

  async function saveNote() {
    await fetch("/api/kv/notes/me", { method: "PUT", headers: mine, body: JSON.stringify({ text: note }) });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1600);
  }

  return (
    <div className="wrap">
      <header className="rise" style={{ animationDelay: "0ms" }}>
        <div className="badge">
          <span className="dot" />
          hosted on Artifact Studio
        </div>
        <h1>Guestbook</h1>
        <p>
          A live demo. The feed below is <b>shared</b> with everyone; your note is{" "}
          <b>private to this device</b>. Both persist server-side — no backend code, just a key-value call.
        </p>
      </header>

      <div className="card rise" style={{ animationDelay: "90ms" }}>
        <div className="label">
          <span className="tag">shared</span>
          <h2>Sign the guestbook</h2>
          <span className="meta">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <form onSubmit={sign}>
          <div className="row">
            <input className="name" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="say something…" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="actions">
            <button type="submit">Sign</button>
          </div>
        </form>
        <ul className="entries">
          {entries.length === 0 ? (
            <li className="empty">No entries yet — be the first.</li>
          ) : (
            entries.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <div className="avatar" style={{ background: avatarBg(e.name) }}>
                  {initial(e.name)}
                </div>
                <div className="entry-body">
                  <div className="top">
                    <span className="who">{e.name}</span>
                    <span className="when">{relTime(e.at)}</span>
                  </div>
                  <div className="msg">{e.message}</div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="card rise" style={{ animationDelay: "170ms" }}>
        <div className="label">
          <span className="tag priv">private</span>
          <h2>Your private note</h2>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="just for you — only this device sees it…"
        />
        <div className="actions">
          <button onClick={saveNote}>Save note</button>
          <span className={"saved" + (noteSaved ? " on" : "")}>saved ✓</span>
        </div>
      </div>

      <footer className="rise" style={{ animationDelay: "250ms" }}>
        Built + hosted on{" "}
        <a href="https://github.com/jpvarbed/artifact-studio-tools">Artifact Studio</a> · see{" "}
        <code>/llms.txt</code>
      </footer>
    </div>
  );
}

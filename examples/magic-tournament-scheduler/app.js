import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildSchedule, computeStandings, isBye, BYE } from "./tournament.js";

// Plain React, no JSX and no htm — `h` is just React.createElement. Keeps the
// app build-free (esm.sh imports) without a template-string DSL dependency.
const h = React.createElement;
const { Fragment } = React;

let _idSeq = 0;
const newId = () => `p${++_idSeq}`;

const SAMPLE = [
  "Jace",
  "Liliana",
  "Chandra",
  "Garruk",
  "Nissa",
  "Teferi",
  "Kaya",
].join("\n");

function App() {
  const [phase, setPhase] = useState("setup"); // "setup" | "running"
  const [raw, setRaw] = useState(SAMPLE);
  const [bestOf, setBestOf] = useState(1); // 1 (default) | 3 | 5
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [results, setResults] = useState({}); // "ri:mi" -> result
  const [currentRound, setCurrentRound] = useState(0); // which round you're entering

  const gamesToWin = Math.ceil(bestOf / 2); // Bo1→1, Bo3→2, Bo5→3

  const parsed = useMemo(
    () =>
      raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [raw]
  );
  const dupes = useMemo(() => {
    const seen = new Set();
    const dup = new Set();
    for (const n of parsed) {
      const k = n.toLowerCase();
      if (seen.has(k)) dup.add(n);
      seen.add(k);
    }
    return dup;
  }, [parsed]);

  function generate() {
    const ps = parsed.map((name) => ({ id: newId(), name }));
    setPlayers(ps);
    setRounds(buildSchedule(ps.map((p) => p.id)));
    setResults({});
    setCurrentRound(0);
    setPhase("running");
  }

  function reset() {
    setPhase("setup");
    setPlayers([]);
    setRounds([]);
    setResults({});
    setCurrentRound(0);
  }

  const nameById = useMemo(() => {
    const m = new Map(players.map((p) => [p.id, p.name]));
    m.set(BYE, "Bye");
    return m;
  }, [players]);

  const resultsMap = useMemo(() => new Map(Object.entries(results)), [results]);

  const standings = useMemo(
    () =>
      phase === "running"
        ? computeStandings(players, rounds, resultsMap, gamesToWin)
        : [],
    [phase, players, rounds, resultsMap, gamesToWin]
  );

  const totalMatches = rounds.flat().filter((m) => !isBye(m)).length;
  const playedMatches = Object.keys(results).length;

  function setResult(ri, mi, winnerId, loserId, w, l) {
    setResults((prev) => ({
      ...prev,
      [`${ri}:${mi}`]: {
        winner: winnerId,
        games: { [winnerId]: w, [loserId]: l },
      },
    }));
  }
  function clearResult(ri, mi) {
    setResults((prev) => {
      const next = { ...prev };
      delete next[`${ri}:${mi}`];
      return next;
    });
  }

  return h(
    Fragment,
    null,
    h(
      "div",
      { className: "app-head" },
      h("div", { className: "logo" }, "🪄"),
      h("div", null, h("h1", null, "Magic Tournament Scheduler"))
    ),
    h(
      "p",
      { className: "subtitle" },
      "Round-robin pairings for a draft pod — everyone plays everyone once. Odd pod? One bye per round. Ties break on head-to-head, then strength of who you beat."
    ),
    phase === "setup"
      ? h(Setup, {
          raw,
          setRaw,
          parsed,
          dupes,
          bestOf,
          setBestOf,
          onGenerate: generate,
        })
      : h(Running, {
          rounds,
          results,
          nameById,
          standings,
          totalMatches,
          playedMatches,
          currentRound,
          setCurrentRound,
          bestOf,
          setBestOf,
          gamesToWin,
          onSetResult: setResult,
          onClearResult: clearResult,
          onReset: reset,
        }),
    h(
      "div",
      { className: "foot-wrap" },
      h(
        "a",
        {
          className: "foot",
          href: "https://studio.artifacts.jasonv.dev",
          target: "_blank",
          rel: "noreferrer",
        },
        "built on Artifact Studio · in-memory, nothing is saved"
      )
    )
  );
}

// Segmented "Best of" control. Best-of-1 is the default (a single game, 1–0).
function FormatPicker({ bestOf, setBestOf }) {
  const opts = [1, 3, 5];
  return h(
    "div",
    { className: "fmt", role: "group", "aria-label": "Match format" },
    h("span", { className: "fmt-label" }, "Best of"),
    opts.map((o) =>
      h(
        "button",
        {
          key: o,
          type: "button",
          className: "fmt-btn" + (bestOf === o ? " active" : ""),
          onClick: () => setBestOf(o),
        },
        o
      )
    )
  );
}

function Setup({ raw, setRaw, parsed, dupes, bestOf, setBestOf, onGenerate }) {
  const n = parsed.length;
  const odd = n % 2 === 1;
  const rounds = n < 2 ? 0 : odd ? n : n - 1;
  const canGo = n >= 2 && dupes.size === 0;
  return h(
    "div",
    { className: "panel" },
    h("h2", null, "Players"),
    h("textarea", {
      value: raw,
      onChange: (e) => setRaw(e.target.value),
      placeholder: "One name per line…",
      spellCheck: false,
    }),
    h(
      "div",
      { className: "setup-meta" },
      h("span", { className: "chip tabular" }, `${n} player${n === 1 ? "" : "s"}`),
      n >= 2 && h("span", { className: "chip tabular" }, `${rounds} rounds`),
      n >= 2 &&
        h("span", { className: "chip tabular" }, `${(n * (n - 1)) / 2} matches`),
      odd &&
        n >= 2 &&
        h("span", { className: "chip warn" }, "⚑ odd — one bye each round"),
      dupes.size > 0 &&
        h(
          "span",
          { className: "chip warn" },
          `duplicate name: ${[...dupes].join(", ")}`
        )
    ),
    h("div", { className: "setup-meta" }, h(FormatPicker, { bestOf, setBestOf })),
    h(
      "div",
      { className: "setup-meta" },
      h(
        "button",
        { className: "primary", disabled: !canGo, onClick: onGenerate },
        "Generate schedule →"
      ),
      n < 2 && h("span", { className: "muted" }, "Add at least two players.")
    )
  );
}

// How many real (non-bye) matches a round has, and how many have a result.
function roundProgress(matches, results, ri) {
  let real = 0;
  let done = 0;
  matches.forEach((m, mi) => {
    if (isBye(m)) return;
    real += 1;
    if (results[`${ri}:${mi}`]) done += 1;
  });
  return { real, done, complete: real > 0 ? done === real : true };
}

function Running({
  rounds,
  results,
  nameById,
  standings,
  totalMatches,
  playedMatches,
  currentRound,
  setCurrentRound,
  bestOf,
  setBestOf,
  gamesToWin,
  onSetResult,
  onClearResult,
  onReset,
}) {
  const nRounds = rounds.length;
  const ri = Math.min(Math.max(currentRound, 0), Math.max(nRounds - 1, 0));
  const matches = rounds[ri] || [];
  const { real, done, complete } = roundProgress(matches, results, ri);

  return h(
    Fragment,
    null,
    h(
      "div",
      { className: "toolbar" },
      h(
        "div",
        { className: "rnav" },
        h(
          "button",
          {
            className: "ghost",
            disabled: ri === 0,
            onClick: () => setCurrentRound(ri - 1),
            "aria-label": "Previous round",
          },
          "‹"
        ),
        h(
          "span",
          { className: "rnav-label" },
          "Round ",
          h("b", null, ri + 1),
          " ",
          h("span", { className: "muted" }, `/ ${nRounds}`)
        ),
        h(
          "button",
          {
            className: "ghost",
            disabled: ri >= nRounds - 1,
            onClick: () => setCurrentRound(ri + 1),
            "aria-label": "Next round",
          },
          "›"
        )
      ),
      h(
        "div",
        { className: "right" },
        h(FormatPicker, { bestOf, setBestOf }),
        h(
          "button",
          { className: "ghost danger", onClick: onReset },
          "New tournament"
        )
      )
    ),
    h(
      "div",
      { className: "round-dots" },
      rounds.map((rm, i) => {
        const p = roundProgress(rm, results, i);
        return h(
          "button",
          {
            key: i,
            className:
              "rdot" + (i === ri ? " active" : "") + (p.complete ? " done" : ""),
            onClick: () => setCurrentRound(i),
            title: `Round ${i + 1} — ${p.done}/${p.real} entered`,
          },
          i + 1
        );
      })
    ),
    h(RoundPanel, {
      ri,
      matches,
      results,
      nameById,
      gamesToWin,
      onSetResult,
      onClearResult,
    }),
    h(
      "div",
      { className: "round-foot" },
      h(
        "span",
        { className: "progress tabular" },
        `${done}/${real} this round · ${playedMatches}/${totalMatches} overall`
      ),
      ri < nRounds - 1 &&
        h(
          "button",
          {
            className: "primary next-round" + (complete ? "" : " ghosted"),
            onClick: () => setCurrentRound(ri + 1),
          },
          complete ? `Round ${ri + 2} →` : "Skip to next round →"
        )
    ),
    h(Standings, { rows: standings, live: true })
  );
}

function RoundPanel({
  ri,
  matches,
  results,
  nameById,
  gamesToWin,
  onSetResult,
  onClearResult,
}) {
  return h(
    "div",
    { className: "round" },
    matches.map((m, mi) =>
      isBye(m)
        ? h(
            "div",
            { className: "match bye", key: mi },
            h(
              "div",
              { className: "side" },
              h("span", { className: "pname" }, nameById.get(m.a))
            ),
            h("span", { className: "vs" }, "—"),
            h(
              "div",
              { className: "side right" },
              h("span", { className: "bye-tag" }, "BYE · sits out")
            )
          )
        : h(MatchCard, {
            key: mi,
            ri,
            mi,
            m,
            res: results[`${ri}:${mi}`],
            nameById,
            gamesToWin,
            onSetResult,
            onClearResult,
          })
    )
  );
}

function MatchCard({
  ri,
  mi,
  m,
  res,
  nameById,
  gamesToWin,
  onSetResult,
  onClearResult,
}) {
  const aName = nameById.get(m.a);
  const bName = nameById.get(m.b);
  const aWon = res && res.winner === m.a;
  const bWon = res && res.winner === m.b;
  const aGames = res?.games?.[m.a];
  const bGames = res?.games?.[m.b];
  const isActive = (winId, w, l) =>
    res &&
    res.winner === winId &&
    res.games?.[winId] === w &&
    res.games?.[winId === m.a ? m.b : m.a] === l;

  const scoreBtn = (winId, loseId, w, l, label) =>
    h(
      "button",
      {
        key: `${winId}-${w}-${l}`,
        className: "score-btn" + (isActive(winId, w, l) ? " active" : ""),
        onClick: () => onSetResult(ri, mi, winId, loseId, w, l),
      },
      label
    );

  // Possible loser-game counts for the chosen format: 0 … gamesToWin-1.
  // Bo1 → [0] (1–0 only); Bo3 → [0,1] (2–0, 2–1); Bo5 → [0,1,2] (3–0…3–2).
  const W = gamesToWin;
  const losses = Array.from({ length: W }, (_, l) => l);

  return h(
    "div",
    { className: "match" + (res ? " done" : "") },
    h(
      "div",
      { className: "side" },
      h(
        "span",
        { className: "pname " + (aWon ? "winner" : bWon ? "loser" : "") },
        aName
      ),
      res && h("span", { className: "muted tabular" }, aGames)
    ),
    h("span", { className: "vs" }, "VS"),
    h(
      "div",
      { className: "side right" },
      res && h("span", { className: "muted tabular" }, bGames),
      h(
        "span",
        { className: "pname " + (bWon ? "winner" : aWon ? "loser" : "") },
        bName
      )
    ),
    h(
      "div",
      { className: "match-actions" },
      losses.map((l) => scoreBtn(m.a, m.b, W, l, `${aName} ${W}–${l}`)),
      [...losses]
        .reverse()
        .map((l) => scoreBtn(m.b, m.a, W, l, `${bName} ${W}–${l}`)),
      res &&
        h(
          "button",
          {
            className: "score-btn clear",
            onClick: () => onClearResult(ri, mi),
          },
          "clear"
        )
    )
  );
}

const pct = (x) => `${Math.round(x * 100)}%`;

function Standings({ rows, live }) {
  if (rows.length === 0)
    return h(
      "div",
      { className: "panel" },
      h("div", { className: "empty" }, "No players.")
    );
  return h(
    "div",
    { className: "panel" },
    h(
      "h2",
      null,
      "Standings",
      live &&
        h(
          "span",
          { className: "live-dot", title: "Updates as you enter results" },
          "live"
        )
    ),
    h(
      "div",
      { className: "table-wrap" },
      h(
        "table",
        { className: "tabular" },
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", { className: "rank" }, "#"),
            h("th", null, "Player"),
            h(
              "th",
              {
                className: "num",
                title: "Match wins — losses (byes don't count as wins)",
              },
              "W–L"
            ),
            h(
              "th",
              { className: "num", title: "Byes received (a sit-out, not a win)" },
              "Bye"
            ),
            h(
              "th",
              { className: "num", title: "Points (1 per match win)" },
              "Pts"
            ),
            h(
              "th",
              { className: "num", title: "Game win % across all games played" },
              "GW%"
            ),
            h(
              "th",
              {
                className: "num",
                title:
                  "Tiebreaker: average match-win% of the opponents you BEAT",
              },
              "Beat-%"
            ),
            h(
              "th",
              {
                className: "num",
                title:
                  "Opponents' match-win% across everyone you faced (info)",
              },
              "OMW%"
            )
          )
        ),
        h(
          "tbody",
          null,
          rows.map((r) =>
            h(
              "tr",
              { key: r.id },
              h(
                "td",
                { className: "rank" + (r.rank === 1 ? " top" : "") },
                r.rank
              ),
              h("td", null, r.name),
              h(
                "td",
                { className: "num wl" },
                h("span", { className: "w" }, r.wins),
                "–",
                h("span", { className: "l" }, r.losses)
              ),
              h("td", { className: "num muted" }, r.byes || ""),
              h("td", { className: "num pts" }, r.points),
              h("td", { className: "num muted" }, pct(r.gameWinPct)),
              h("td", { className: "num" }, pct(r.beatenStrength)),
              h("td", { className: "num muted" }, pct(r.omw))
            )
          )
        )
      )
    ),
    h(
      "div",
      { className: "legend" },
      h(
        "div",
        null,
        h("b", null, "Sort order:"),
        " points, then head-to-head among tied players, then ",
        h("b", null, "Beat-%"),
        " (the win-rate of the players you beat)."
      ),
      h(
        "div",
        null,
        h("b", null, "Beat-%"),
        " rewards beating strong players · ",
        h("b", null, "OMW%"),
        " is the classic opponents'-win% over everyone you faced, shown for reference."
      ),
      h(
        "div",
        null,
        "A ",
        h("b", null, "bye"),
        " is a sit-out — it scores no points and is left out of W–L, win%, and games."
      )
    )
  );
}

createRoot(document.getElementById("root")).render(h(App, null));

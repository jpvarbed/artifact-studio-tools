import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import {
  buildSchedule,
  computeStandings,
  isBye,
  BYE,
} from "./tournament.js";

const html = htm.bind(React.createElement);

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
  const [tab, setTab] = useState("rounds");

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
    setTab("rounds");
    setPhase("running");
  }

  function reset() {
    setPhase("setup");
    setPlayers([]);
    setRounds([]);
    setResults({});
  }

  const nameById = useMemo(() => {
    const m = new Map(players.map((p) => [p.id, p.name]));
    m.set(BYE, "Bye");
    return m;
  }, [players]);

  const resultsMap = useMemo(
    () => new Map(Object.entries(results)),
    [results]
  );

  const standings = useMemo(
    () =>
      phase === "running"
        ? computeStandings(players, rounds, resultsMap, gamesToWin)
        : [],
    [phase, players, rounds, resultsMap, gamesToWin]
  );

  const totalMatches = rounds
    .flat()
    .filter((m) => !isBye(m)).length;
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

  return html`
    <${React.Fragment}>
    <div class="app-head">
      <div class="logo">🪄</div>
      <div>
        <h1>Magic Tournament Scheduler</h1>
      </div>
    </div>
    <p class="subtitle">
      Round-robin pairings for a draft pod — everyone plays everyone once.
      Odd pod? One bye per round. Ties break on head-to-head, then strength of
      who you beat.
    </p>

    ${phase === "setup"
      ? html`<${Setup}
          raw=${raw}
          setRaw=${setRaw}
          parsed=${parsed}
          dupes=${dupes}
          bestOf=${bestOf}
          setBestOf=${setBestOf}
          onGenerate=${generate}
        />`
      : html`<${Running}
          tab=${tab}
          setTab=${setTab}
          rounds=${rounds}
          results=${results}
          nameById=${nameById}
          standings=${standings}
          totalMatches=${totalMatches}
          playedMatches=${playedMatches}
          bestOf=${bestOf}
          setBestOf=${setBestOf}
          gamesToWin=${gamesToWin}
          onSetResult=${setResult}
          onClearResult=${clearResult}
          onReset=${reset}
        />`}

    <div class="foot-wrap">
      <a
        class="foot"
        href="https://studio.artifacts.jasonv.dev"
        target="_blank"
        rel="noreferrer"
        >built on Artifact Studio · in-memory, nothing is saved</a
      >
    </div>
    <//>
  `;
}

// Segmented "Best of" control. Best-of-1 is the default (a single game, 1–0).
function FormatPicker({ bestOf, setBestOf }) {
  const opts = [1, 3, 5];
  return html`
    <div class="fmt" role="group" aria-label="Match format">
      <span class="fmt-label">Best of</span>
      ${opts.map(
        (o) => html`<button
          key=${o}
          type="button"
          class=${"fmt-btn" + (bestOf === o ? " active" : "")}
          onClick=${() => setBestOf(o)}
        >
          ${o}
        </button>`
      )}
    </div>
  `;
}

function Setup({ raw, setRaw, parsed, dupes, bestOf, setBestOf, onGenerate }) {
  const n = parsed.length;
  const odd = n % 2 === 1;
  const rounds = n < 2 ? 0 : odd ? n : n - 1;
  const canGo = n >= 2 && dupes.size === 0;
  return html`
    <div class="panel">
      <h2>Players</h2>
      <textarea
        value=${raw}
        onChange=${(e) => setRaw(e.target.value)}
        placeholder="One name per line…"
        spellCheck=${false}
      ></textarea>
      <div class="setup-meta">
        <span class="chip tabular">${n} player${n === 1 ? "" : "s"}</span>
        ${n >= 2 &&
        html`<span class="chip tabular">${rounds} rounds</span>`}
        ${n >= 2 &&
        html`<span class="chip tabular"
          >${(n * (n - 1)) / 2} matches</span
        >`}
        ${odd &&
        n >= 2 &&
        html`<span class="chip warn">⚑ odd — one bye each round</span>`}
        ${dupes.size > 0 &&
        html`<span class="chip warn"
          >duplicate name: ${[...dupes].join(", ")}</span
        >`}
      </div>
      <div class="setup-meta">
        <${FormatPicker} bestOf=${bestOf} setBestOf=${setBestOf} />
      </div>
      <div class="setup-meta">
        <button class="primary" disabled=${!canGo} onClick=${onGenerate}>
          Generate schedule →
        </button>
        ${n < 2 &&
        html`<span class="muted">Add at least two players.</span>`}
      </div>
    </div>
  `;
}

function Running({
  tab,
  setTab,
  rounds,
  results,
  nameById,
  standings,
  totalMatches,
  playedMatches,
  bestOf,
  setBestOf,
  gamesToWin,
  onSetResult,
  onClearResult,
  onReset,
}) {
  return html`
    <${React.Fragment}>
    <div class="toolbar">
      <div class="tabs">
        <button
          class=${tab === "rounds" ? "active" : ""}
          onClick=${() => setTab("rounds")}
        >
          Rounds
        </button>
        <button
          class=${tab === "standings" ? "active" : ""}
          onClick=${() => setTab("standings")}
        >
          Standings
        </button>
      </div>
      <div class="right">
        <${FormatPicker} bestOf=${bestOf} setBestOf=${setBestOf} />
        <span class="progress tabular"
          >${playedMatches}/${totalMatches} played</span
        >
        <button class="ghost danger" onClick=${onReset}>New tournament</button>
      </div>
    </div>

    ${tab === "rounds"
      ? html`<${Rounds}
          rounds=${rounds}
          results=${results}
          nameById=${nameById}
          gamesToWin=${gamesToWin}
          onSetResult=${onSetResult}
          onClearResult=${onClearResult}
        />`
      : html`<${Standings} rows=${standings} />`}
    <//>
  `;
}

function Rounds({ rounds, results, nameById, gamesToWin, onSetResult, onClearResult }) {
  return rounds.map(
    (matches, ri) => html`
      <div class="round" key=${ri}>
        <div class="round-title">
          <span>Round ${ri + 1}</span>
          <span class="bar"></span>
        </div>
        ${matches.map((m, mi) =>
          isBye(m)
            ? html`<div class="match done" key=${mi}>
                <div class="side">
                  <span class="pname winner">${nameById.get(m.a)}</span>
                </div>
                <span class="vs">—</span>
                <div class="side right">
                  <span class="bye-tag">BYE (auto-win)</span>
                </div>
              </div>`
            : html`<${MatchCard}
                key=${mi}
                ri=${ri}
                mi=${mi}
                m=${m}
                res=${results[`${ri}:${mi}`]}
                nameById=${nameById}
                gamesToWin=${gamesToWin}
                onSetResult=${onSetResult}
                onClearResult=${onClearResult}
              />`
        )}
      </div>
    `
  );
}

function MatchCard({ ri, mi, m, res, nameById, gamesToWin, onSetResult, onClearResult }) {
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

  const scoreBtn = (winId, loseId, w, l, label) => html`
    <button
      key=${`${winId}-${w}-${l}`}
      class=${"score-btn" + (isActive(winId, w, l) ? " active" : "")}
      onClick=${() => onSetResult(ri, mi, winId, loseId, w, l)}
    >
      ${label}
    </button>
  `;

  // Possible loser-game counts for the chosen format: 0 … gamesToWin-1.
  // Bo1 → [0] (1–0 only); Bo3 → [0,1] (2–0, 2–1); Bo5 → [0,1,2] (3–0…3–2).
  const W = gamesToWin;
  const losses = Array.from({ length: W }, (_, l) => l);

  return html`
    <div class=${"match" + (res ? " done" : "")}>
      <div class="side">
        <span
          class=${"pname " + (aWon ? "winner" : bWon ? "loser" : "")}
          >${aName}</span
        >
        ${res && html`<span class="muted tabular">${aGames}</span>`}
      </div>
      <span class="vs">VS</span>
      <div class="side right">
        ${res && html`<span class="muted tabular">${bGames}</span>`}
        <span
          class=${"pname " + (bWon ? "winner" : aWon ? "loser" : "")}
          >${bName}</span
        >
      </div>
      <div class="match-actions">
        ${losses.map((l) =>
          scoreBtn(m.a, m.b, W, l, `${aName} ${W}–${l}`)
        )}
        ${[...losses]
          .reverse()
          .map((l) => scoreBtn(m.b, m.a, W, l, `${bName} ${W}–${l}`))}
        ${res &&
        html`<button
          class="score-btn clear"
          onClick=${() => onClearResult(ri, mi)}
        >
          clear
        </button>`}
      </div>
    </div>
  `;
}

const pct = (x) => `${Math.round(x * 100)}%`;

function Standings({ rows }) {
  if (rows.length === 0)
    return html`<div class="panel"><div class="empty">No players.</div></div>`;
  return html`
    <div class="panel">
      <h2>Standings</h2>
      <div class="table-wrap">
        <table class="tabular">
          <thead>
            <tr>
              <th class="rank">#</th>
              <th>Player</th>
              <th class="num" title="Match wins — losses (byes count as wins)">
                W–L
              </th>
              <th class="num" title="Byes received">Bye</th>
              <th class="num" title="Points (1 per match win)">Pts</th>
              <th class="num" title="Game win % across all games played">
                GW%
              </th>
              <th
                class="num"
                title="Tiebreaker: average match-win% of the opponents you BEAT"
              >
                Beat-%
              </th>
              <th
                class="num"
                title="Opponents' match-win% across everyone you faced (info)"
              >
                OMW%
              </th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
              (r) => html`
                <tr key=${r.id}>
                  <td class=${"rank" + (r.rank === 1 ? " top" : "")}>
                    ${r.rank}
                  </td>
                  <td>${r.name}</td>
                  <td class="num wl">
                    <span class="w">${r.wins}</span>–<span class="l"
                      >${r.losses}</span
                    >
                  </td>
                  <td class="num muted">${r.byes || ""}</td>
                  <td class="num pts">${r.points}</td>
                  <td class="num muted">${pct(r.gameWinPct)}</td>
                  <td class="num">${pct(r.beatenStrength)}</td>
                  <td class="num muted">${pct(r.omw)}</td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
      <div class="legend">
        <div>
          <b>Sort order:</b> points, then head-to-head among tied players, then
          <b>Beat-%</b> (the win-rate of the players you beat).
        </div>
        <div>
          <b>Beat-%</b> rewards beating strong players · <b>OMW%</b> is the
          classic opponents'-win% over everyone you faced, shown for reference.
        </div>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);

// Pure tournament logic: round-robin scheduling + standings with tiebreakers.
// No React, no DOM — keep it testable and import it from app.js.

export const BYE = "__BYE__";

// Circle-method round-robin. Everyone plays everyone exactly once.
// Odd player count → a phantom BYE is added so each round one real player sits out.
// Returns rounds: Array<Array<{ a, b }>> where `a`/`b` are player ids, and
// b === BYE marks the player who has the bye that round.
export function buildSchedule(playerIds) {
  const ids = [...playerIds];
  if (ids.length < 2) return [];

  if (ids.length % 2 === 1) ids.push(BYE); // odd → add phantom for byes
  const n = ids.length;
  const rounds = [];

  // Fix the first slot, rotate the rest. n-1 rounds, n/2 matches each.
  let arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // Normalize so a real player is always `a` when the other side is a bye.
      if (a === BYE) matches.push({ a: b, b: BYE });
      else matches.push({ a, b });
    }
    rounds.push(matches);
    // rotate: keep arr[0] fixed, move the rest clockwise
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

// A match result records the winner and the games. The match format is
// "best of N" (default best-of-1, a single game → 1–0); Bo3/Bo5 are opt-in.
// result shape: { winner: playerId, games: { [playerId]: gamesWon } } or null (unplayed).
// A bye is auto-counted as a clean win (gamesToWin–0) in whatever format is set.

export function isBye(match) {
  return match.b === BYE;
}

// Compute full standings from players + rounds + results.
// results: Map keyed by `${roundIdx}:${matchIdx}` → result object.
// gamesToWin: games the winner needs (1 for Bo1, 2 for Bo3, 3 for Bo5) — used
// for bye game-credit and as the fallback when a result omits explicit games.
export function computeStandings(players, rounds, results, gamesToWin = 1) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const stats = new Map(
    players.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        wins: 0, // match wins (real matches only — byes don't count)
        losses: 0, // match losses
        byes: 0, // byes received (informational; not a win)
        gamesWon: 0,
        gamesLost: 0,
        played: 0, // decided real matches (byes excluded)
        beat: new Set(), // opponent ids this player defeated (real opponents)
        lostTo: new Set(),
        oppAll: new Set(), // every real opponent faced (decided or not)
        h2h: new Map(), // opponentId → net (wins - losses) head-to-head
      },
    ])
  );

  const bump = (id, oppId, didWin, gw, gl) => {
    const s = stats.get(id);
    if (!s) return;
    s.played += 1;
    s.gamesWon += gw;
    s.gamesLost += gl;
    if (oppId) s.oppAll.add(oppId);
    if (didWin) {
      s.wins += 1;
      if (oppId) s.beat.add(oppId);
    } else {
      s.losses += 1;
      if (oppId) s.lostTo.add(oppId);
    }
    if (oppId) {
      const prev = s.h2h.get(oppId) || 0;
      s.h2h.set(oppId, prev + (didWin ? 1 : -1));
    }
  };

  rounds.forEach((matches, ri) => {
    matches.forEach((m, mi) => {
      if (isBye(m)) {
        // A bye is a sit-out, not a win: it earns no points and doesn't count
        // toward matches played, win%, or games. We only track the count.
        const s = stats.get(m.a);
        if (s) s.byes += 1;
        return;
      }
      const res = results.get(`${ri}:${mi}`);
      if (!res || !res.winner) return; // unplayed
      const aw = res.games?.[m.a] ?? (res.winner === m.a ? gamesToWin : 0);
      const bw = res.games?.[m.b] ?? (res.winner === m.b ? gamesToWin : 0);
      bump(m.a, m.b, res.winner === m.a, aw, bw);
      bump(m.b, m.a, res.winner === m.b, bw, aw);
    });
  });

  // Match win % over real matches only (byes are excluded entirely).
  const matchWinPct = (id) => {
    const s = stats.get(id);
    if (!s || s.played === 0) return 0;
    return s.wins / s.played;
  };

  // Tiebreaker 2: average match-win% of the opponents this player BEAT.
  // Rewards beating strong players (the user's "win % of the people you beat").
  const beatenStrength = (id) => {
    const s = stats.get(id);
    if (!s || s.beat.size === 0) return 0;
    let sum = 0;
    for (const oppId of s.beat) sum += matchWinPct(oppId);
    return sum / s.beat.size;
  };

  // Bonus info: opponents' match-win% over EVERYONE faced (classic OMW%).
  const omw = (id) => {
    const s = stats.get(id);
    if (!s || s.oppAll.size === 0) return 0;
    let sum = 0;
    for (const oppId of s.oppAll) sum += matchWinPct(oppId);
    return sum / s.oppAll.size;
  };

  const rows = players.map((p) => {
    const s = stats.get(p.id);
    return {
      ...s,
      points: s.wins, // 1 point per match win in this simple model
      matchWinPct: matchWinPct(p.id),
      beatenStrength: beatenStrength(p.id),
      omw: omw(p.id),
      gameWinPct:
        s.gamesWon + s.gamesLost > 0
          ? s.gamesWon / (s.gamesWon + s.gamesLost)
          : 0,
    };
  });

  return sortStandings(rows);
}

// Sort: points → head-to-head within the tied group → beaten-opponent strength → name.
// Head-to-head is resolved as a mini-league among only the players tied on points,
// which handles 2-way ties (direct result) and N-way ties (most wins vs the group).
export function sortStandings(rows) {
  const byPoints = [...rows].sort((a, b) => b.points - a.points);

  // Partition into groups of equal points, sort within each, then concat.
  const out = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const group = byPoints.slice(i, j);
    out.push(...resolveTiedGroup(group));
    i = j;
  }
  // assign ranks (shared rank for genuinely-equal rows)
  let rank = 0;
  let prevKey = null;
  out.forEach((row, idx) => {
    const key = tieKey(row, out);
    if (key !== prevKey) rank = idx + 1;
    row.rank = rank;
    prevKey = key;
  });
  return out;
}

function tieKey(row) {
  // Two rows are "truly tied" (share a rank) only if every ordered metric matches.
  return [
    row.points,
    row._h2hWins ?? 0,
    row.beatenStrength.toFixed(6),
    row.name.toLowerCase(),
  ].join("|");
}

function resolveTiedGroup(group) {
  if (group.length <= 1) return group;
  const groupIds = new Set(group.map((r) => r.id));

  // head-to-head wins counted only against others in this tied group
  for (const r of group) {
    let h = 0;
    for (const oppId of groupIds) {
      if (oppId === r.id) continue;
      const net = r.h2h.get(oppId) || 0;
      if (net > 0) h += 1; // won the head-to-head with that tied player
    }
    r._h2hWins = h;
  }

  return [...group].sort((a, b) => {
    if (b._h2hWins !== a._h2hWins) return b._h2hWins - a._h2hWins;
    if (b.beatenStrength !== a.beatenStrength)
      return b.beatenStrength - a.beatenStrength;
    return a.name.localeCompare(b.name);
  });
}

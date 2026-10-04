// The stop order on the phone: a travelling-salesman heuristic over a travel-time matrix.
// Nearest neighbour to start, then 2-opt and Or-opt until nothing improves, then kick and repeat (iterated local
// search): cut the best route in four and swap the middle pieces, polish, keep it if it's better. Driving time is
// minimised; Express (ADR 0005): arriving after a deadline costs 20x the lateness. Two driver preferences on top
// (ADR 0006): coming back to a stretch of street already left costs REVISIT_SEC, and with "Express first" no
// ordinary stop may come before an Express one.
// ponytail: fixed time budget, not VROOM's full metaheuristic; raise `budgetMs` if tours still look off.

/** What driving a stretch of street twice is worth avoiding: a re-visit has to save more than this to be planned. */
export const REVISIT_SEC = 90;
/** A lower-ranked point after a higher-ranked one ("Express first" broken): never worth it. */
const RANK_PENALTY = 1e7;

/** How often the route comes back to a stretch of street it left: a mate seen before, the previous point not a mate. */
export function revisits(route: number[], mates: number[][]) {
  let n = 0;
  const seen = new Set<number>();
  for (let k = 0; k < route.length; k++) {
    const ms = mates[route[k]];
    if (k > 0 && ms?.length && !ms.includes(route[k - 1]) && ms.some(x => seen.has(x))) n++;
    seen.add(route[k]);
  }
  return n;
}

/** How often a point follows one of a higher rank. 0 = every rank-0 point before every rank-1 point. */
export function descents(route: number[], rank: number[]) {
  let n = 0;
  for (let k = 1; k < route.length; k++) if ((rank[route[k]] ?? 0) < (rank[route[k - 1]] ?? 0)) n++;
  return n;
}

/**
 * m[i][j] = seconds from point i to j. Point 0 is the start; `end` (if set) is the last point, fixed.
 * `service[i]` = seconds spent at point i, `due[i]` = latest arrival (seconds after start) or null,
 * `rank[i]` = lower ranks are visited first, `mates[i]` = points on the same stretch of street as i.
 */
export function solveOrder(m: number[][], end?: number, opt: { service?: number[]; due?: (number | null)[]; rank?: number[]; mates?: number[][]; budgetMs?: number } = {}): number[] {
  const { service = [], due = [], rank = [], mates = [], budgetMs = 1500 } = opt;
  const deadlines = due.some(d => d != null);
  const streets = mates.some(x => x.length), ranked = rank.some(r => r);
  const n = m.length;
  const jobs = [...Array(n).keys()].filter(i => i !== 0 && i !== end);
  // nearest neighbour, lowest rank first
  const route: number[] = [];
  const left = new Set(jobs);
  let at = 0;
  while (left.size) {
    let best = -1;
    const low = Math.min(...[...left].map(j => rank[j] ?? 0));
    for (const j of left) if ((rank[j] ?? 0) === low && (best < 0 || m[at][j] < m[at][best])) best = j;
    route.push(best); left.delete(best); at = best;
  }
  const full = (r: number[]) => [0, ...r, ...(end != null ? [end] : [])];
  const cost = (r: number[]) => {
    const p = full(r);
    let drive = 0, clock = 0, late = 0;
    for (let i = 1; i < p.length; i++) {
      drive += m[p[i - 1]][p[i]];
      if (!deadlines) continue;
      clock += (service[p[i - 1]] ?? 0) + m[p[i - 1]][p[i]];
      const d = due[p[i]];
      if (d != null && clock > d) late += clock - d;
    }
    return drive + 20 * late + (streets ? REVISIT_SEC * revisits(r, mates) : 0) + (ranked ? RANK_PENALTY * descents(r, rank) : 0);
  };

  const polish = (route: number[]) => {
    let best = cost(route), improved = true;
    for (let pass = 0; improved && pass < 50; pass++) {
      improved = false;
      // 2-opt: reverse a stretch (costs recomputed in full: the matrix is one-way-aware, so not symmetric)
      for (let i = 0; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const cand = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
          const c = cost(cand);
          if (c < best - 1e-6) { route.splice(0, route.length, ...cand); best = c; improved = true; }
        }
      }
      // Or-opt: move a run of 1-3 stops elsewhere, keeping its direction
      for (let len = 1; len <= 3; len++) {
        for (let i = 0; i + len <= route.length; i++) {
          const seg = route.slice(i, i + len), rest = [...route.slice(0, i), ...route.slice(i + len)];
          for (let j = 0; j <= rest.length; j++) {
            if (j === i) continue;
            const cand = [...rest.slice(0, j), ...seg, ...rest.slice(j)];
            const c = cost(cand);
            if (c < best - 1e-6) { route.splice(0, route.length, ...cand); best = c; improved = true; break; }
          }
        }
      }
    }
    return best;
  };

  let bestCost = polish(route), bestRoute = [...route];
  let seed = 1; const rnd = (k: number) => { seed = (seed * 16807) % 2147483647; return seed % k; }; // repeatable
  const stop = Date.now() + budgetMs;
  for (let tries = 0; route.length >= 8 && tries < 5000 && Date.now() < stop; tries++) {
    const [a, b, c] = [rnd(route.length), rnd(route.length), rnd(route.length)].sort((x, y) => x - y);
    if (a === b || b === c) continue;
    const kicked = [...bestRoute.slice(0, a), ...bestRoute.slice(b, c), ...bestRoute.slice(a, b), ...bestRoute.slice(c)];
    const c2 = polish(kicked);
    if (c2 < bestCost - 1e-6) { bestCost = c2; bestRoute = kicked; }
  }
  return bestRoute;
}

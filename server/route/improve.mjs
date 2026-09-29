// Polish a stop order on our one-way, kerb-side (so strongly asymmetric) travel times. VROOM's single-vehicle
// solver works on a symmetrised matrix and lost ~8 % of the driving on a real 56-stop day; this iterated local
// search (2-opt, Or-opt, double-bridge kicks; the phone's solver, mobile/.../solve.ts) on the true costs gets
// it back. `cost(route)` is whatever the caller minimises (here driving + 20x lateness), so no move can break
// an Express deadline that VROOM kept. Never returns a worse route than it was given.

/** `order`: job indices in visiting order; `cost`: total seconds of a route; returns the best route found within `budgetMs`. */
export function improve(order, cost, { budgetMs = 1500 } = {}) {
  const polish = route => {
    let best = cost(route), improved = true;
    for (let pass = 0; improved && pass < 50; pass++) {
      improved = false;
      // 2-opt: reverse a stretch (full recomputation: reversing changes every one-way leg inside it)
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

  let bestRoute = [...order], bestCost = polish(bestRoute);
  let seed = 1; const rnd = k => { seed = (seed * 16807) % 2147483647; return seed % k; }; // repeatable
  const stop = Date.now() + budgetMs;
  for (let tries = 0; bestRoute.length >= 8 && tries < 5000 && Date.now() < stop; tries++) {
    const [a, b, c] = [rnd(bestRoute.length), rnd(bestRoute.length), rnd(bestRoute.length)].sort((x, y) => x - y);
    if (a === b || b === c) continue;
    const kicked = [...bestRoute.slice(0, a), ...bestRoute.slice(b, c), ...bestRoute.slice(a, b), ...bestRoute.slice(c)];
    const c2 = polish(kicked);
    if (c2 < bestCost - 1e-6) { bestCost = c2; bestRoute = kicked; }
  }
  return bestRoute;
}

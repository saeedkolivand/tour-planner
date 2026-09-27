// Express stops no order can serve on time: VROOM (hard time windows) leaves them out. They're put back where
// they cost least, weighing each minute late 20x a minute of driving, then moved around until nothing improves.
// Same idea as the phone's solver (mobile/src/features/planner/solve.ts).

const LATE_WEIGHT = 20;

/**
 * Arrival (after any wait for a shop to open) at each point of `order` (indices into the matrix, 0 = start,
 * the end point excluded), total driving seconds and total seconds late against `win[i] = [earliest, latest]`.
 */
export function timeline(order, m, service, win, end) {
  let clock = 0, drive = 0, late = 0, at = 0;
  const arrive = [];
  for (const i of order) {
    drive += m[at][i]; clock += m[at][i];
    const w = win[i];
    if (w && clock < w[0]) clock = w[0]; // the shop isn't open yet: wait
    if (w && clock > w[1]) late += clock - w[1];
    arrive.push(clock);
    clock += service[i]; at = i;
  }
  if (end != null) drive += m[at][end];
  return { arrive, drive, late, cost: drive + LATE_WEIGHT * late };
}

/** `order` (VROOM's, on-time stops) + `missing` (stops it couldn't fit) -> an order with least driving + lateness. */
export function insertLate(order, missing, m, service, win, end) {
  const cost = r => timeline(r, m, service, win, end).cost;
  let route = [...order];
  for (const x of missing) {
    let best = null;
    for (let p = 0; p <= route.length; p++) {
      const cand = [...route.slice(0, p), x, ...route.slice(p)], c = cost(cand);
      if (!best || c < best.c) best = { cand, c };
    }
    route = best.cand;
  }
  // Or-opt: move single stops while it helps (catches insertions that pushed an earlier Express late)
  let best = cost(route);
  for (let improved = true, pass = 0; improved && pass < 20; pass++) {
    improved = false;
    for (let i = 0; i < route.length; i++) {
      const rest = [...route.slice(0, i), ...route.slice(i + 1)];
      for (let p = 0; p <= rest.length; p++) {
        if (p === i) continue;
        const cand = [...rest.slice(0, p), route[i], ...rest.slice(p)], c = cost(cand);
        if (c < best - 1e-6) { route = cand; best = c; improved = true; break; }
      }
    }
  }
  return route;
}

// The animated splash's geometry, on the app icon's 2048 grid (the still splash image shows the same check, centred):
// the road along the check, the van's place and heading on it, and the seam the screen splits along.
// Worklets: they run on the UI thread for every frame (and in node for the tests).

export const PTS = [[580, 1060], [900, 1380], [1500, 700]] as const;
export const ROAD = 330, MARK = 46, DASH = 90, GAP = 80, MARK_START = 40;
const SEG = [Math.hypot(320, 320), Math.hypot(600, 680)];
export const TOTAL = SEG[0] + SEG[1];

/** The point `d` grid units along the road. */
export function pointAt(d: number): [number, number] {
  'worklet';
  const [a, b, c] = PTS;
  if (d <= SEG[0]) { const t = Math.max(0, d) / SEG[0]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  const t = Math.min(1, (d - SEG[0]) / SEG[1]);
  return [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t];
}

/**
 * Where the van is at `p` (0..1 of the road) and which way it points, in degrees: the heading is taken over a stretch
 * either side, so it turns through the corner instead of snapping, and at the road's end it keeps the last stretch's.
 * It rides on the road's top edge, `lift` units off the centre line.
 */
export function vanPose(p: number, span = 70, lift = 128) {
  'worklet';
  const d = p * TOTAL;
  const [x, y] = pointAt(d);
  const [x1, y1] = pointAt(Math.max(0, d - span));
  const [x2, y2] = pointAt(Math.min(TOTAL, Math.max(d + span, 2 * span)));
  const a = Math.atan2(y2 - y1, x2 - x1);
  return { x: x + Math.sin(a) * lift, y: y - Math.cos(a) * lift, deg: (a * 180) / Math.PI };
}

/**
 * The drive's pace: a soft start, an even speed, a soft stop. Its top speed is 1.3x the average, where an ease-in-out
 * peaks at 1.5x right on the long climb up the check (it looked rushed there).
 */
export function glide(t: number) {
  'worklet';
  const ta = 0.2, td = 0.26, v = 1 / (1 - ta / 2 - td / 2);
  if (t < ta) return (v * t * t) / (2 * ta);
  if (t < 1 - td) return v * (ta / 2 + (t - ta));
  return 1 - (v * (1 - t) ** 2) / (2 * td);
}

/** The two halves the splash tears into: the seam runs from the left edge along the check to the right edge. */
export function halves(box: { x: number; y: number; w: number; h: number }) {
  const [a, v, b] = PTS;
  const k1 = (v[1] - a[1]) / (v[0] - a[0]), k2 = (b[1] - v[1]) / (b[0] - v[0]);
  const m = Math.max(box.w, box.h); // beyond the screen, so a half still covers it while it turns
  const L = box.x - m, R = box.x + box.w + m, T = box.y - m, B = box.y + box.h + m;
  const seam = [[L, a[1] + k1 * (L - a[0])], a, v, b, [R, b[1] + k2 * (R - b[0])]];
  const pts = (ps: readonly (readonly number[])[]) => ps.map(p => `${p[0]},${p[1]}`).join(' ');
  // the lower half reaches a little above the seam: two cut edges meeting exactly leave a hairline of the app between them
  const over = seam.map(([x, y]) => [x, y - 12]);
  return { upper: pts([...seam, [R, T], [L, T]]), lower: pts([...over, [R, B], [L, B]]), pivot: v };
}

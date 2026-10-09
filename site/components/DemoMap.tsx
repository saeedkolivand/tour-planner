'use client';
// The demo's map: stops as dots on a plain grid, the scanner's order as a dashed line, a plan as parking spots joined
// by the drive (drawn in) with a walk out to each door. Stops can be dragged.
import { useRef } from 'react';
import { type DemoStop, type Group, SAMPLE, START } from '@/lib/plan';

const W = 600, H = 540, PAD = 36;
const lats = [...SAMPLE.map(s => s.lat), START.lat], lons = [...SAMPLE.map(s => s.lon), START.lon];
const box = { s: Math.min(...lats), n: Math.max(...lats), w: Math.min(...lons), e: Math.max(...lons) };
const K = Math.cos((box.s * Math.PI) / 180); // a degree of longitude is shorter than one of latitude here
const scale = Math.min((W - 2 * PAD) / ((box.e - box.w) * K), (H - 2 * PAD) / (box.n - box.s));
export const xy = (p: { lat: number; lon: number }) => ({ x: PAD + (p.lon - box.w) * K * scale, y: H - PAD - (p.lat - box.s) * scale });
const unxy = (x: number, y: number) => ({ lon: box.w + (x - PAD) / (K * scale), lat: box.s + (H - PAD - y) / scale });
const line = (ps: { lat: number; lon: number }[]) => ps.map(p => { const { x, y } = xy(p); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');

export function DemoMap({ stops, groups, onMove }: { stops: DemoStop[]; groups: Group[] | null; onMove(i: number, p: { lat: number; lon: number }): void }) {
  const svg = useRef<SVGSVGElement>(null), drag = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (drag.current == null || !svg.current) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM()!.inverse());
    onMove(drag.current, unxy(Math.min(W - 8, Math.max(8, pt.x)), Math.min(H - 8, Math.max(8, pt.y))));
  };
  const s0 = xy(START);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="bg-card border-border w-full touch-none rounded-2xl border select-none" onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
      <defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" className="stroke-border" fill="none" /></pattern></defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {!groups && <polyline points={line([START, ...stops])} className="stroke-muted-foreground/60" strokeWidth={2} strokeDasharray="5 6" fill="none" />}
      {groups && (
        <>
          {groups.flatMap((g, i) => g.stops.map((s, j) => <line key={`${i}-${j}`} {...{ x1: xy(g.park).x, y1: xy(g.park).y, x2: xy(s as DemoStop).x, y2: xy(s as DemoStop).y }} className="stroke-primary/50" strokeWidth={1.5} strokeDasharray="2 4" />))}
          <polyline key={groups.map(g => g.park.lat).join()} points={line([START, ...groups.map(g => g.park)])} pathLength={1} className="stroke-primary animate-[draw_1.4s_ease-out_both]" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray="1" />
        </>
      )}
      {stops.map((s, i) => {
        const { x, y } = xy(s);
        return (
          <g key={s.key} onPointerDown={e => { drag.current = i; (e.target as Element).setPointerCapture?.(e.pointerId); }} className="cursor-grab active:cursor-grabbing">
            <circle cx={x} cy={y} r={14} fill="transparent" />
            <circle cx={x} cy={y} r={6} className={s.express ? 'fill-express stroke-card' : 'fill-foreground stroke-card'} strokeWidth={2} />
          </g>
        );
      })}
      {groups?.map((g, i) => {
        const { x, y } = xy(g.park);
        return (
          <g key={i} className="pointer-events-none animate-[pop_0.4s_ease-out_both]" style={{ animationDelay: `${0.25 + (i / groups.length) * 1.1}s`, transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r={9.5} className="fill-primary stroke-card" strokeWidth={2} />
            <text x={x} y={y + 3.2} textAnchor="middle" className="fill-primary-foreground text-[9px] font-bold">{i + 1}</text>
          </g>
        );
      })}
      <g className="pointer-events-none"><rect x={s0.x - 9} y={s0.y - 9} width={18} height={18} rx={5} className="fill-success stroke-card" strokeWidth={2} /></g>
    </svg>
  );
}

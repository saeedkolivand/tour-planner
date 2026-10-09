'use client';
// The app's opening animation, on the web: the still check (server-rendered, so it is the first paint), then the van
// drives the road painting its markings and the page tears open along it. Same geometry as the app (geometry.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DASH, GAP, glide, halves, MARK, MARK_START, ROAD, TOTAL, vanPose } from '@app/components/splash/geometry';

const ROUTE = 'M580 1060 L900 1380 L1500 700';
const M = 0.15; // each half reaches this far past the screen, so it still covers it while it turns
const size = () => Math.min(innerWidth * 0.6, innerHeight * 0.45, 420); // the 2048 grid's width on screen, as the CSS below
const BG = 'fill-[#DC0032] dark:fill-[#0A0A0C]', FG = 'fill-white dark:fill-[#F02850]';
const BG_S = 'stroke-[#DC0032] dark:stroke-[#0A0A0C]', FG_S = 'stroke-white dark:stroke-[#F02850]';

export const replaySplash = () => dispatchEvent(new Event('splash'));

type Geo = { W: number; H: number; S: number; box: { x: number; y: number; w: number; h: number } };

function Van() {
  const r = 110; // grid units, facing right
  return (
    <>
      <rect x={-2.1 * r} y={-1.2 * r} width={2.8 * r} height={1.7 * r} rx={0.25 * r} className={FG} />
      <rect x={0.4 * r} y={-0.6 * r} width={1.6 * r} height={1.1 * r} rx={0.35 * r} className={FG} />
      <polygon points={`${0.7 * r},${-0.45 * r} ${1.4 * r},${-0.45 * r} ${1.75 * r},${-0.05 * r} ${0.7 * r},${-0.05 * r}`} className={BG} />
      {[-1.3 * r, 1.1 * r].map(cx => <g key={cx}><circle cx={cx} cy={0.7 * r} r={0.5 * r} className={BG} /><circle cx={cx} cy={0.7 * r} r={0.33 * r} className={FG} /></g>)}
    </>
  );
}

export function Splash() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [shown, setShown] = useState(true);
  const up = useRef<HTMLDivElement>(null), down = useRef<HTMLDivElement>(null), van = useRef<SVGGElement>(null), covers = useRef<SVGPathElement[]>([]);

  useEffect(() => {
    const play = () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(false); return; }
      const W = innerWidth, H = innerHeight, S = size() / 2048;
      setShown(true);
      setGeo({ W, H, S, box: { x: 1024 - ((0.5 + M) * W) / S, y: 1024 - ((0.5 + M) * H) / S, w: ((1 + 2 * M) * W) / S, h: ((1 + 2 * M) * H) / S } });
    };
    play();
    addEventListener('splash', play);
    return () => removeEventListener('splash', play);
  }, []);

  useLayoutEffect(() => {
    if (!geo) return;
    const { W, H } = geo, t0 = performance.now() + 250;
    let frame = requestAnimationFrame(function tick(now) {
      const d = glide(Math.min(1, Math.max(0, (now - t0) / 650)));
      for (const c of covers.current) c?.setAttribute('stroke-dashoffset', String(-d * TOTAL));
      const p = vanPose(d);
      van.current?.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.deg})`);
      const e = Math.min(1, Math.max(0, (now - t0 - 730) / 380)) ** 2.2;
      if (up.current) up.current.style.transform = `translate(${-0.55 * e * W}px, ${-0.8 * e * H}px) rotate(${-9 * e}deg)`;
      if (down.current) down.current.style.transform = `translate(${0.5 * e * W}px, ${0.8 * e * H}px) rotate(${7 * e}deg)`;
      if (e < 1) frame = requestAnimationFrame(tick); else { setShown(false); setGeo(null); }
    });
    return () => cancelAnimationFrame(frame);
  }, [geo]);

  if (!shown) return null;
  if (!geo) return ( // the still frame: what the server sends, and what the app's own splash shows
    <div id="splash" className="fixed inset-0 z-50 grid place-items-center bg-[#DC0032] dark:bg-[#0A0A0C]" aria-hidden>
      <noscript><style>{'#splash{display:none}'}</style></noscript>
      <svg viewBox="0 0 2048 2048" style={{ width: 'min(60vw, 45vh, 420px)' }}><path d={ROUTE} className={FG_S} strokeWidth={ROAD} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
    </div>
  );
  const { W, H, S, box } = geo, { upper, lower, pivot } = halves(box);
  const half = { position: 'absolute', left: -M * W, top: -M * H, width: (1 + 2 * M) * W, height: (1 + 2 * M) * H, transformOrigin: `${(pivot[0] - box.x) * S}px ${(pivot[1] - box.y) * S}px` } as const;
  const scene = (id: string, points: string, withVan: boolean, k: number) => (
    <svg width="100%" height="100%" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      <defs><clipPath id={id}><polygon points={points} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} className={BG} />
        <path d={ROUTE} className={FG_S} strokeWidth={ROAD} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={ROUTE} className={BG_S} strokeWidth={MARK} strokeDasharray={`${DASH} ${GAP}`} strokeDashoffset={-MARK_START} strokeLinecap="round" fill="none" />
        <path ref={el => { if (el) covers.current[k] = el; }} d={ROUTE} className={FG_S} strokeWidth={MARK + 8} strokeDasharray={`${2 * TOTAL} ${2 * TOTAL}`} fill="none" />
        {withVan && <g ref={van}><Van /></g>}
      </g>
    </svg>
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <div ref={down} style={half}>{scene('splash-down', lower, false, 0)}</div>
      <div ref={up} style={half}>{scene('splash-up', upper, true, 1)}</div>
    </div>
  );
}

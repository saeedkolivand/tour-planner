'use client';
import { CircleCheck, Clock, Construction, Footprints, LocateFixed, Navigation, Package, Route, Sparkles, Zap } from 'lucide-react';
import type { Text } from '@/lib/en';
import { useCount, useTicker } from '@/lib/useCount';
import { Phone, Title } from './Phone';

const NEXT = [
  { no: 80, street: 'Gereonswall 110', sub: '50670 · Anna Wagner', at: '09:05', parcels: 3, walk: 'Gereonswall 89' },
  { no: 72, street: 'Hansaring 1', sub: '50670 · Paketshop Hansaring', at: '09:11', parcels: 3, express: '10:00' },
  { no: 64, street: 'Hansaring 82', sub: '50670 · Tom Klein', at: '09:16', parcels: 2 },
];

/** Route: the plan's numbers (time saved counting up), and with `deliver` the next-stop card being worked through. */
export function RouteScreen({ s, active, deliver = false }: { s: Text['screens']; active: boolean; deliver?: boolean }) {
  const saved = Math.round(useCount(41, active));
  const k = useTicker(NEXT.length, active && deliver, 2200);
  const x = NEXT[k], done = 9 + k;
  return (
    <Phone s={s} tab={1}>
      <Title kicker={`${17 - k} ${s.left}`} title={s.route}>
        <span className="flex gap-1.5">{[Construction, LocateFixed].map((I, i) => <span key={i} className="bg-secondary grid size-8 place-items-center rounded-full"><I className="size-4" /></span>)}</span>
      </Title>
      <div className="grid grid-cols-3 gap-1.5">
        {[[Route, '9.8 km', s.distance, ''], [Clock, '3h 52m', s.time, ''], [Sparkles, `${active ? saved : 41}m`, s.saved, 'text-success-ink']].map(([I, v, l, c]) => {
          const Icon = I as typeof Route;
          return <div key={l as string} className="bg-card border-border rounded-xl border p-2"><Icon className={`size-3.5 ${c || 'text-muted-foreground'}`} /><p className={`mt-1 text-[15px] font-bold ${c}`}>{v as string}</p><p className="text-muted-foreground text-[9px]">{l as string}</p></div>;
        })}
      </div>
      <div className="mt-2.5 flex justify-between text-[11px] font-semibold"><span>{s.delivered}</span><span className="text-muted-foreground">{done} / 26</span></div>
      <div className="bg-success/15 mt-1 h-1.5 rounded-full"><div className="bg-success h-full rounded-full transition-[width] duration-500" style={{ width: `${(done / 26) * 100}%` }} /></div>
      <div className="border-primary/40 bg-card mt-3 rounded-2xl border-2 p-3">
        <div key={k} className="rise">
          <div className="flex justify-between text-[9px] font-bold tracking-widest"><span className="text-primary">{s.next} · {k + 1} {s.of.toUpperCase()} 17</span><span className="text-muted-foreground tracking-normal">{s.arrive} ~{x.at}</span></div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="bg-foreground text-background grid size-11 place-items-center rounded-xl text-[20px] font-extrabold">{x.no}</span>
            <div className="min-w-0"><p className="truncate text-[16px] leading-tight font-extrabold">{x.street}</p><p className="text-muted-foreground truncate text-[11px]">{x.sub}</p></div>
          </div>
          <div className="mt-2 flex gap-1.5 text-[9px] font-semibold">
            {x.express && <span className="bg-express text-express-foreground flex items-center gap-0.5 rounded-full px-2 py-0.5"><Zap className="size-2.5" />Express {x.express}</span>}
            <span className="bg-secondary flex items-center gap-0.5 rounded-full px-2 py-0.5"><Package className="size-2.5" />{x.parcels} {s.parcels}</span>
          </div>
          {x.walk && <p className="bg-secondary text-muted-foreground mt-2 flex items-center gap-1 rounded-xl p-2 text-[10px]"><Footprints className="size-3" />{s.walk} <b className="text-foreground">{x.walk}</b></p>}
        </div>
        <span className="bg-primary text-primary-foreground mt-2.5 flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold"><Navigation className="size-4" />{s.navigate}</span>
        <span key={`d${k}`} className={`bg-success text-success-foreground mt-1.5 flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold ${deliver && active ? 'animate-[tap_2.2s_ease-in-out_infinite]' : ''}`}><CircleCheck className="size-4" />{s.delivered}</span>
      </div>
    </Phone>
  );
}

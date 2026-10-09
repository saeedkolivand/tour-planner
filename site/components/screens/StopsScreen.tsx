'use client';
import { Camera, CircleCheck, Home, Images, Package, Plus, ScanText, Store } from 'lucide-react';
import type { Text } from '@/lib/en';
import { useCount, useTicker } from '@/lib/useCount';
import { Phone, Title } from './Phone';

const ROWS = [
  { street: 'Dagobertstraße 86', sub: '50668 · Paketshop', no: 98, parcels: 4, shop: true },
  { street: 'Ursulagartenstraße 16', sub: '50668 · Leon Hoffmann', no: 75, parcels: 3 },
  { street: 'Thürmchenswall 29', sub: '50668 · Jonas Wolf', no: 91, parcels: 1 },
  { street: 'Hansaring 82', sub: '50670 · Tom Klein', no: 64, parcels: 2 },
];

/** Stops: the capture card reading photos one by one, the count check filling, the stops coming in. */
export function StopsScreen({ s, active }: { s: Text['screens']; active: boolean }) {
  const read = useTicker(5, active, 700, false); // photo 1..4, then the list
  const done = active && read === 4;
  const n = Math.round(useCount(26, done, 700));
  const count = active ? n : 26; // at rest it shows the finished list
  return (
    <Phone s={s} tab={0}>
      <Title kicker={s.date} title={s.stops}><span className="bg-secondary grid size-8 place-items-center rounded-full"><Plus className="size-4" /></span></Title>
      <div className="bg-primary text-primary-foreground rounded-2xl p-3.5">
        <div className="flex gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/20"><ScanText className="size-5" /></span>
          <div><p className="text-[13px] leading-tight font-bold">{s.capture}</p><p className="text-[10px] opacity-85">{active && !done ? `${s.reading} ${Math.min(read + 1, 4)} ${s.of} 4` : s.captureSub}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-bold">
          <span className="text-primary flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white"><Camera className="size-4" />{s.camera}</span>
          <span className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/20"><Images className="size-4" />{s.shots}</span>
        </div>
      </div>
      <div className="bg-card border-border mt-2.5 rounded-2xl border p-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold"><CircleCheck className="text-success-ink size-4" />{count} {s.of} 26 {s.stops}</p>
        <div className="bg-secondary mt-2 h-1.5 rounded-full"><div className="bg-success h-full rounded-full transition-[width] duration-700" style={{ width: `${(count / 26) * 100}%` }} /></div>
        <p className="text-muted-foreground mt-1.5 text-[10px]">{s.countOk}</p>
      </div>
      <div className="mt-2.5 space-y-2">
        {ROWS.map((r, i) => (
          <div key={r.street} className="bg-card border-border flex items-center gap-2.5 rounded-2xl border p-2.5 transition-all duration-500"
            style={{ opacity: done || !active ? 1 : 0, transform: done || !active ? 'none' : 'translateY(12px)', transitionDelay: `${i * 90}ms` }}>
            <span className="bg-secondary grid size-8 place-items-center rounded-xl">{r.shop ? <Store className="size-4" /> : <Home className="size-4" />}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{r.street}</p><p className="text-muted-foreground truncate text-[10px]">{r.sub}</p></div>
            <div className="text-right"><p className="text-muted-foreground text-[12px] font-bold">#{r.no}</p><p className="text-muted-foreground flex items-center gap-0.5 text-[9px]"><Package className="size-2.5" />{r.parcels}</p></div>
          </div>
        ))}
      </div>
    </Phone>
  );
}

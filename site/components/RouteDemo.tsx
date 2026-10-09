'use client';
import { LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Text } from '@/lib/en';
import { type DemoStop, type Group, plan, SAMPLE, scannerMin, WALK_M } from '@/lib/plan';
import { useCount } from '@/lib/useCount';
import { DemoMap } from './DemoMap';

function Toggle({ on, onClick, children }: { on: boolean; onClick(): void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{children}</button>;
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return <div className="bg-card border-border rounded-xl border p-4"><p className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p><p className="text-muted-foreground text-xs">{label}</p></div>;
}

export function RouteDemo({ t }: { t: Text['demo'] }) {
  const [stops, setStops] = useState<DemoStop[]>(SAMPLE);
  const [style, setStyle] = useState<'walk' | 'door'>('walk');
  const [first, setFirst] = useState(false);
  const [result, setResult] = useState<{ groups: Group[]; min: number } | null>(null);
  const [busy, setBusy] = useState(0); // ms searched so far, 0 = idle
  const before = useMemo(() => scannerMin(stops), [stops]);
  const saved = useCount(result ? before - result.min : 0, !!result, 1200);

  const searching = busy > 0;
  useEffect(() => { // the seconds counter on the button while the search runs
    if (!searching) return;
    const id = setInterval(() => setBusy(b => (b ? b + 100 : 0)), 100);
    return () => clearInterval(id);
  }, [searching]);

  const run = async () => {
    setBusy(1); setResult(null);
    const r = await plan(stops, WALK_M[style], first);
    setBusy(0); setResult(r);
  };
  const change = (f: () => void) => { f(); setResult(null); };

  return (
    <section id="demo" className="bg-secondary/50 border-border border-y">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="text-muted-foreground mt-4 text-lg">{t.body}</p>
          <div className="bg-card border-border mt-6 inline-flex rounded-xl border p-1">
            <Toggle on={style === 'walk'} onClick={() => change(() => setStyle('walk'))}>{t.walk}</Toggle>
            <Toggle on={style === 'door'} onClick={() => change(() => setStyle('door'))}>{t.door}</Toggle>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={first} onChange={e => change(() => setFirst(e.target.checked))} className="accent-primary size-4" />{t.express}</label>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={run} disabled={busy > 0} className="bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-xl px-6 font-semibold shadow-lg shadow-primary/25 disabled:opacity-80">
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}{busy ? `${t.planning} ${(busy / 1000).toFixed(1)} s` : t.plan}
            </button>
            {stops !== SAMPLE && <button onClick={() => change(() => setStops(SAMPLE))} className="text-muted-foreground hover:text-foreground inline-flex h-12 items-center gap-2 px-2 text-sm font-medium"><RotateCcw className="size-4" />{t.reset}</button>}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label={`${t.before} · ${t.drive}`} value={before.toFixed(0)} />
            <Stat label={`${t.after} · ${t.drive}`} value={result ? result.min.toFixed(0) : '–'} />
            <Stat label={`${t.drive} ${t.saved}`} value={result ? `−${saved.toFixed(0)}` : '–'} tone="text-success-ink" />
            <Stat label={`${t.parking} · ${stops.length} ${t.stops}`} value={result ? String(result.groups.length) : '–'} />
          </div>
        </div>
        <div>
          <DemoMap stops={stops} groups={result?.groups ?? null} onMove={(i, p) => change(() => setStops(xs => xs.map((s, k) => (k === i ? { ...s, ...p } : s))))} />
          <p className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5"><i className="bg-success size-3 rounded" />{t.legendStart}</span>
            <span className="flex items-center gap-1.5"><i className="bg-express size-3 rounded-full" />{t.legendExpress}</span>
            <span className="flex items-center gap-1.5"><i className="bg-primary size-3 rounded-full" />{t.legendPark}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

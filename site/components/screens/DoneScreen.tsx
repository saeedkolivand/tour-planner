import { Clock, Gauge, History, Package, PartyPopper, Route, Zap } from 'lucide-react';
import type { Text } from '@/lib/en';
import { Phone, Title } from './Phone';

/** The end of the day: Tour complete, and the summary card the app shows (and keeps in Past deliveries). */
export function DoneScreen({ s, active }: { s: Text['screens']; active: boolean }) {
  const lines = [[Package, s.doneStops, ''], [Clock, s.span, ''], [Zap, s.express, 'text-success-ink'], [Gauge, s.pace, ''], [Clock, s.vsPlan, ''], [Route, s.planned, '']] as const;
  return (
    <Phone s={s} tab={1}>
      <Title kicker={s.allDone} title={s.route} />
      <div className="mt-2 flex flex-col items-center text-center">
        <span className={`bg-accent text-primary grid size-16 place-items-center rounded-full transition-transform duration-700 ${active ? 'scale-100 rotate-0' : 'scale-75 -rotate-12'}`}><PartyPopper className="size-8" /></span>
        <p className="mt-2 text-[16px] font-bold">{s.complete}</p>
      </div>
      <div className="bg-card border-border mt-3 space-y-2 rounded-2xl border p-3">
        <p className="text-[14px] font-bold">{s.done}</p>
        {lines.map(([I, l, c], i) => (
          <p key={i} className={`flex gap-1.5 text-[10.5px] leading-snug transition-all duration-500 ${c}`} style={{ opacity: active ? 1 : 0.35, transitionDelay: `${i * 80}ms` }}>
            <I className="text-muted-foreground mt-px size-3 shrink-0" />{l}
          </p>
        ))}
      </div>
      <span className="bg-card border-border mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold"><History className="size-3.5" />{s.past}</span>
    </Phone>
  );
}

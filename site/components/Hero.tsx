import { Download, Play, Sparkles } from 'lucide-react';
import type { Text } from '@/lib/en';
import { Mark } from './Mark';
import { Replay } from './Replay';

export function Hero({ t, replay }: { t: Text['hero']; replay: string }) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="from-accent pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-gradient-to-b to-transparent" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="rise">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase">{t.kicker}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">{t.title}</h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-lg text-pretty">{t.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#install" className="bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-xl px-6 font-semibold shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5">
              <Download className="size-5" />{t.cta}
            </a>
            <a href="#demo" className="bg-card border-border inline-flex h-12 items-center gap-2 rounded-xl border px-6 font-semibold transition-transform hover:-translate-y-0.5">
              <Sparkles className="text-primary size-5" />{t.demo}
            </a>
          </div>
          <ul className="text-muted-foreground mt-8 flex flex-wrap gap-2 text-sm">
            {t.chips.map(c => <li key={c} className="bg-secondary rounded-full px-3 py-1">{c}</li>)}
          </ul>
        </div>
        <div className="rise relative mx-auto w-full max-w-sm [animation-delay:150ms]">
          <div className="bg-primary/30 absolute inset-8 rounded-full blur-3xl" />
          <div className="relative aspect-square rounded-[22%] bg-gradient-to-b from-[#E81040] to-[#B2002A] p-[12%] shadow-2xl dark:from-[#161618] dark:to-[#0A0A0C]">
            <Mark className="size-full" road="stroke-white dark:stroke-[#F02850]" marks="stroke-[#C8003A] dark:stroke-[#0F0F11]" moving />
          </div>
          <Replay label={replay}><Play className="size-4" /></Replay>
        </div>
      </div>
    </section>
  );
}

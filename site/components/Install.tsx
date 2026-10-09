import { Apple, Download, Smartphone } from 'lucide-react';
import type { Text } from '@/lib/en';
import { RELEASE } from '@/lib/site';

export function Install({ t }: { t: Text['install'] }) {
  const cards = [[Apple, t.ios], [Smartphone, t.android]] as const;
  return (
    <section id="install" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
      <p className="text-muted-foreground mt-4 text-lg">{t.body}</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {cards.map(([I, c]) => (
          <div key={c.title} className="bg-card border-border rounded-2xl border p-6">
            <div className="flex items-center gap-3"><span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl"><I className="size-5" /></span><h3 className="text-xl font-bold">{c.title}</h3></div>
            <ol className="mt-5 space-y-3">
              {c.steps.map((x, i) => <li key={x} className="flex gap-3"><span className="bg-secondary grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold">{i + 1}</span>{x}</li>)}
            </ol>
            <a href={RELEASE} className="bg-primary text-primary-foreground mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 font-semibold"><Download className="size-4" />{t.cta}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

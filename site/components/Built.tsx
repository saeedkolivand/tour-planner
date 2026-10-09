import { Cpu, ExternalLink, House, Smartphone } from 'lucide-react';
import type { Text } from '@/lib/en';
import { REPO } from '@/lib/site';

const ICONS = [Smartphone, Cpu, House];

export function Built({ t }: { t: Text['built'] }) {
  return (
    <section id="built" className="bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
        <p className="mt-4 max-w-2xl text-lg opacity-70">{t.body}</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {t.cols.map((c, i) => {
            const I = ICONS[i];
            return (
              <div key={c.title} className="rounded-2xl border border-current/15 p-6">
                <I className="text-primary size-6" />
                <h3 className="mt-3 text-lg font-bold">{c.title}</h3>
                <ul className="mt-3 space-y-2 text-sm opacity-80">{c.items.map(x => <li key={x} className="flex gap-2"><span className="text-primary">▸</span>{x}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <a href={REPO} className="text-primary mt-8 inline-flex items-center gap-2 font-semibold hover:underline">{t.source}<ExternalLink className="size-4" /></a>
      </div>
    </section>
  );
}

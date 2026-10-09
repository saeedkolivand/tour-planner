import { Car, Footprints, History, Settings, Signpost, Zap } from 'lucide-react';
import type { Text } from '@/lib/en';

const ICONS = { zap: Zap, footprints: Footprints, road: Signpost, history: History, car: Car, settings: Settings };

export function Features({ t }: { t: Text['features'] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.items.map(f => {
          const I = ICONS[f.icon as keyof typeof ICONS];
          return (
            <div key={f.title} className="bg-card border-border group rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
              <span className="bg-accent text-primary grid size-11 place-items-center rounded-xl transition-transform group-hover:scale-110 group-hover:-rotate-6"><I className="size-5" /></span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="text-muted-foreground mt-2">{f.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

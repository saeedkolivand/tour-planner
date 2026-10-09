import { ListChecks, Navigation, ScanBarcode, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Text } from '@/lib/en';

/** A phone frame around one of the app's screens, with its tab bar; `tab` is the highlighted tab. */
export function Phone({ s, tab, children }: { s: Text['screens']; tab: 0 | 1; children: ReactNode }) {
  const tabs = [[ListChecks, s.stops], [Navigation, s.route], [ScanBarcode, s.scan], [Settings, s.settings]] as const;
  return (
    <div className="bg-background relative h-[600px] w-[290px] shrink-0 overflow-hidden rounded-[46px] border-[9px] border-neutral-900 shadow-2xl ring-1 ring-black/5 dark:border-neutral-800 dark:ring-white/10">
      <div className="absolute top-2 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="flex h-10 items-end justify-between px-7 pb-1 text-[11px] font-semibold"><span>9:41</span><span>●●● ▮</span></div>
      <div className="absolute inset-x-0 top-10 bottom-14 overflow-hidden px-3.5 pt-3">{children}</div>
      <div className="bg-card border-border absolute inset-x-0 bottom-0 grid h-14 grid-cols-4 border-t pt-1.5">
        {tabs.map(([I, label], i) => (
          <div key={label} className={`flex flex-col items-center gap-0.5 text-[9px] font-medium ${i === tab ? 'text-primary' : 'text-muted-foreground'}`}>
            <I className="size-4" />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The large-title header every tab has: a small caps line, the title, and round actions on the title's line. */
export function Title({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-2.5">
      <p className="text-muted-foreground text-[9px] font-semibold tracking-widest">{kicker}</p>
      <div className="flex items-center justify-between"><h3 className="text-[25px] font-extrabold tracking-tight">{title}</h3>{children}</div>
    </div>
  );
}

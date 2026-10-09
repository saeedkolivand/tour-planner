'use client';
// "A day with Tour Planner": four steps beside one phone that stays in view and changes screen as each step scrolls
// into the middle of the window. Below the lg breakpoint each step carries its own phone.
import { useEffect, useRef, useState } from 'react';
import type { Text } from '@/lib/en';
import { DoneScreen } from './screens/DoneScreen';
import { RouteScreen } from './screens/RouteScreen';
import { StopsScreen } from './screens/StopsScreen';

function Screen({ i, s, active }: { i: number; s: Text['screens']; active: boolean }) {
  if (i === 0) return <StopsScreen s={s} active={active} />;
  if (i === 3) return <DoneScreen s={s} active={active} />;
  return <RouteScreen s={s} active={active} deliver={i === 2} />;
}

export function Story({ t, s }: { t: Text['story']; s: Text['screens'] }) {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.i)); }, { rootMargin: '-45% 0px -45% 0px' });
    for (const el of refs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id="story" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="sticky top-24 hidden h-[620px] lg:block">
          {t.steps.map((_, i) => (
            <div key={i} className="absolute inset-0 flex justify-center transition-all duration-500"
              style={{ opacity: step === i ? 1 : 0, transform: `translateY(${(i - step) * 24}px) scale(${step === i ? 1 : 0.96})`, pointerEvents: 'none' }}>
              <Screen i={i} s={s} active={step === i} />
            </div>
          ))}
        </div>
        <ol>
          {t.steps.map((x, i) => (
            <li key={x.title} ref={el => { refs.current[i] = el; }} data-i={i} className="flex min-h-[80vh] flex-col justify-center gap-6 py-8">
              <div className={`transition-opacity duration-500 ${step === i ? 'opacity-100' : 'lg:opacity-40'}`}>
                <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-full font-bold">{i + 1}</span>
                <h3 className="mt-4 text-2xl font-bold tracking-tight">{x.title}</h3>
                <p className="text-muted-foreground mt-3 max-w-md text-lg">{x.body}</p>
              </div>
              <div className="flex justify-center lg:hidden"><Screen i={i} s={s} active={step === i} /></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

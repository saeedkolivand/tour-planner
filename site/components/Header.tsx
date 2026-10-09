'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BASE, type Lang } from '@/lib/site';
import type { Text } from '@/lib/en';
import { Mark } from './Mark';

/** Light or dark: the system's until the visitor picks one (kept in localStorage, read before paint in the layout). */
function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => { try { if (localStorage.getItem('theme')) return; } catch {} document.documentElement.classList.toggle('dark', mq.matches); setDark(mq.matches); };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);
  const flip = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
    setDark(next);
  };
  return (
    <button onClick={flip} aria-label={label} title={label} className="bg-secondary hover:bg-accent grid size-10 place-items-center rounded-full transition-colors">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

export function Header({ t, lang }: { t: Text['nav']; lang: Lang }) {
  const links = [['story', t.story], ['demo', t.demo], ['built', t.built], ['install', t.install]] as const;
  return (
    <header className="bg-background/80 border-border sticky top-0 z-40 border-b backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="bg-primary grid size-8 place-items-center rounded-lg"><Mark className="size-6" road="stroke-white" marks="stroke-primary" /></span>
          Tour Planner
        </a>
        <div className="text-muted-foreground ml-auto hidden gap-6 text-sm font-medium md:flex">
          {links.map(([id, label]) => <a key={id} href={`#${id}`} className="hover:text-foreground transition-colors">{label}</a>)}
        </div>
        <a href={`${BASE}/${lang === 'de' ? 'en' : 'de'}/`} hrefLang={lang === 'de' ? 'en' : 'de'} className="text-muted-foreground hover:text-foreground ml-auto text-sm font-medium md:ml-0">{t.other}</a>
        <ThemeToggle label={t.theme} />
      </nav>
    </header>
  );
}

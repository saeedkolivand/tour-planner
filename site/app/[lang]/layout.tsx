import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BASE, LANGS, text } from '@/lib/site';
import '../globals.css';

export const dynamicParams = false;
export const generateStaticParams = () => LANGS.map(lang => ({ lang }));

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const t = text((await params).lang);
  return {
    title: t.meta.title, description: t.meta.description, icons: { icon: `${BASE}/favicon.png` },
    alternates: { languages: { en: `${BASE}/en/`, de: `${BASE}/de/` } },
    openGraph: { title: t.meta.title, description: t.meta.description, type: 'website' },
  };
}

export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#DC0032' }, { media: '(prefers-color-scheme: dark)', color: '#0A0A0C' }] };

// before the first paint: the chosen theme (or the system's), so a dark-mode visitor never sees a white flash
const THEME = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <html lang={lang} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}

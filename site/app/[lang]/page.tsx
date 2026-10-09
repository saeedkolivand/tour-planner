import { Built } from '@/components/Built';
import { Features } from '@/components/Features';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Install } from '@/components/Install';
import { RouteDemo } from '@/components/RouteDemo';
import { Splash } from '@/components/Splash';
import { Story } from '@/components/Story';
import { text, type Lang } from '@/lib/site';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = text(lang);
  return (
    <>
      <Splash />
      <Header t={t.nav} lang={lang} />
      <main>
        <Hero t={t.hero} replay={t.nav.replay} />
        <Story t={t.story} s={t.screens} />
        <RouteDemo t={t.demo} />
        <Features t={t.features} />
        <Built t={t.built} />
        <Install t={t.install} />
      </main>
      <footer className="text-muted-foreground border-border border-t px-6 py-10 text-center text-sm">{t.footer}</footer>
    </>
  );
}

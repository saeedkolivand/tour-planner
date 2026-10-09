// The app icon's mark: a check drawn as a road. `moving` lets its markings run like a van driving it.
const ROUTE = 'M580 1060 L900 1380 L1500 700';

export function Mark({ className, road = 'stroke-primary', marks = 'stroke-background', moving = false }: { className?: string; road?: string; marks?: string; moving?: boolean }) {
  return (
    <svg viewBox="400 520 1280 1040" className={className} aria-hidden>
      <path d={ROUTE} className={road} strokeWidth={330} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={ROUTE} className={`${marks} ${moving ? 'markings' : ''}`} strokeWidth={46} strokeDasharray="90 80" strokeDashoffset={-40} strokeLinecap="round" fill="none" />
    </svg>
  );
}

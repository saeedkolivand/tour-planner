'use client';
import type { ReactNode } from 'react';
import { replaySplash } from './Splash';

export function Replay({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button onClick={replaySplash} className="bg-card border-border text-muted-foreground hover:text-foreground absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center whitespace-nowrap gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-md transition-colors">
      {children}{label}
    </button>
  );
}

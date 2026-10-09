'use client';
import { useEffect, useState } from 'react';

/** Counts from 0 up to `to` over `ms` once `on` turns true (and back to 0 when it turns false). */
export function useCount(to: number, on: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) { setN(0); return; }
    const t0 = performance.now();
    let f = requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - t0) / ms);
      setN(to * (1 - (1 - k) ** 3));
      if (k < 1) f = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(f);
  }, [to, on, ms]);
  return n;
}

/** 0, 1, 2 ... every `ms` while `on`: back to 0 after n - 1, or stays there when `loop` is false. */
export function useTicker(n: number, on: boolean, ms: number, loop = true) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) { setI(0); return; }
    const id = setInterval(() => setI(x => (x + 1 < n ? x + 1 : loop ? 0 : x)), ms);
    return () => clearInterval(id);
  }, [n, on, ms, loop]);
  return i;
}

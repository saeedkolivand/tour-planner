import { useEffect, useState } from 'react';

/** The current minute (epoch ms, floored), re-rendering once a minute: for times that move with the clock. */
export function useMinute() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 60_000) * 60_000), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

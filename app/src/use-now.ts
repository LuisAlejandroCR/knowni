// use-now.ts: the current Unix time, re-read every few seconds, for screens
// that show a countdown. Coarse on purpose: minutes do not need a 1 s tick.

import { useEffect, useState } from "react";

export function useNowUnix(everyMs = 5_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

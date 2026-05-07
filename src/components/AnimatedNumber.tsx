import { useEffect, useMemo, useRef, useState } from 'react';

export default function AnimatedNumber({
  value,
  duration = 250,
  formatter,
}: {
  value: number | null;
  duration?: number;
  formatter?: (v: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const hasInitialized = useRef(false);
  const fromRef = useRef(0); // tracks previous end-value without being a dep

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) return;

    // First real value: show immediately, no animation.
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fromRef.current = value;
      setDisplayValue(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    fromRef.current = value; // ready for the next change

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplayValue(from + (to - from) * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]); // ← displayValue intentionally removed

  const text = useMemo(() => {
    if (value === null || !Number.isFinite(value)) return '—';
    return formatter ? formatter(displayValue) : String(Math.floor(displayValue));
  }, [displayValue, formatter, value]);

  return <>{text}</>;
}

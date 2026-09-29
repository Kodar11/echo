import { useEffect, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Reveals `text` one character at a time, like someone typing it. Shows the
 * whole text at once under reduced motion.
 */
export function useTypewriter(text: string, { delay = 320, speed = 44 } = {}): { typed: string; done: boolean } {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let typed = 0;
    let timer = window.setTimeout(function tick() {
      typed += 1;
      setCount(typed);
      // A little unevenness reads as a person rather than a ticker.
      if (typed < text.length) timer = window.setTimeout(tick, speed + ((typed * 7) % 5) * 6);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, reduced, delay, speed]);

  return { typed: text.slice(0, count), done: count >= text.length };
}

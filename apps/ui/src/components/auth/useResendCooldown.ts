import { useCallback, useEffect, useRef, useState } from 'react';

const FIRST_DELAY_SECONDS = 30;
const STEP_SECONDS = 30;
const MAX_DELAY_SECONDS = 300;

/**
 * Paces "resend the code" so a mistyped address cannot be turned into a mail cannon. The first
 * wait is 30 seconds and every further resend adds another 30, up to a five-minute ceiling —
 * arithmetic rather than exponential, so an honest person who genuinely lost the first mail is
 * not pushed into a multi-minute wait by their second attempt.
 *
 * The count lives in a ref rather than state: it must survive the re-render that each tick
 * causes without restarting the schedule. Ticking at 250ms keeps the displayed second honest;
 * a 1000ms interval drifts far enough to show the same number twice.
 */
export const useResendCooldown = (): {
  secondsLeft: number;
  isReady: boolean;
  start: () => void;
} => {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const attempts = useRef(0);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = useCallback(() => {
    const delay = Math.min(
      FIRST_DELAY_SECONDS + attempts.current * STEP_SECONDS,
      MAX_DELAY_SECONDS,
    );
    attempts.current += 1;
    setEndsAt(Date.now() + delay * 1000);
  }, []);

  return { secondsLeft, isReady: secondsLeft === 0, start };
};

export { FIRST_DELAY_SECONDS, STEP_SECONDS, MAX_DELAY_SECONDS };

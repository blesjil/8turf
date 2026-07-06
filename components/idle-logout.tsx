'use client';

import { useEffect } from 'react';
import { signOut } from '@/lib/auth-client';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_KEY = '8turf:last-activity';
const CHECK_INTERVAL_MS = 15 * 1000;

export function IdleLogout() {
  useEffect(() => {
    let signingOut = false;

    const markActivity = () => {
      if (!signingOut) localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    };

    const logOut = () => {
      if (signingOut) return;
      signingOut = true;
      localStorage.removeItem(ACTIVITY_KEY);
      signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = '/authenticate?reason=idle';
          },
          onError: () => {
            // Session may already be expired server-side; go to login anyway.
            window.location.href = '/authenticate?reason=idle';
          },
        },
      });
    };

    const checkIdle = () => {
      const last = Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
      if (Date.now() - last >= IDLE_TIMEOUT_MS) logOut();
    };

    markActivity();

    let throttled = false;
    const onActivity = () => {
      if (throttled) return;
      throttled = true;
      setTimeout(() => {
        throttled = false;
      }, 1000);
      markActivity();
    };

    const onVisible = () => {
      // Catches tabs waking up long after the deadline (sleep, backgrounding).
      if (document.visibilityState === 'visible') checkIdle();
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      for (const event of events) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  return null;
}

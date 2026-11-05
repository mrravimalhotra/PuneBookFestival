'use client';
import { useEffect, useState } from 'react';

/**
 * Registers the service worker and shows a "New version available" banner
 * when an updated worker is waiting, so stale code is never served silently.
 */
export function ServiceWorkerRegister({ message, action }: { message: string; action: string }) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        // Check for updates when the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch((err: unknown) => console.warn('sw.register', err));

    return () =>
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="no-print bg-brand-800 fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white"
    >
      <span>{message}</span>
      <button
        type="button"
        className="text-brand-800 min-h-11 rounded-lg bg-white px-4 font-semibold"
        onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
      >
        {action}
      </button>
    </div>
  );
}

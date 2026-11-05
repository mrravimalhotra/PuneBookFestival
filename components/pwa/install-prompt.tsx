'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pbf.install.dismissedAt';

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < 3 * 86_400_000;
  } catch {
    return false;
  }
}

/** Polite "Add to Home Screen" prompt (Android) or manual instructions (iOS Safari). */
export function InstallPrompt({
  text,
  iosText,
  installLabel,
  notNowLabel,
}: {
  text: string;
  iosText: string;
  installLabel: string;
  notNowLabel: string;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || recentlyDismissed()) return;

    const ua = navigator.userAgent;
    const isIos =
      /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const showTimer = isIos
      ? window.setTimeout(() => {
          setIos(true);
          setHidden(false);
        }, 1500)
      : undefined;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (showTimer) window.clearTimeout(showTimer);
    };
  }, []);

  if (hidden || (!deferred && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };

  return (
    <aside
      className="no-print rounded-card border-brand-200 bg-brand-50 flex items-start gap-3 border p-4"
      aria-label={installLabel}
    >
      <Download aria-hidden="true" className="text-brand-700 mt-0.5 size-5 shrink-0" />
      <div className="flex-1 text-sm">
        <p>{ios ? iosText : text}</p>
        {deferred ? (
          <button
            type="button"
            className="bg-brand-600 mt-3 min-h-11 rounded-lg px-4 font-semibold text-white"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice.catch(() => null);
              setDeferred(null);
              setHidden(true);
            }}
          >
            {installLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="-m-2 inline-flex size-11 items-center justify-center rounded-md"
        aria-label={notNowLabel}
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </aside>
  );
}

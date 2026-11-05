'use client';

import {
  Camera,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  Search,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { staffLookupAction, type LookupResult } from '@/app/staff/actions';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { formatClock, formatDay } from '@/lib/format';
import { t, tError } from '@/lib/i18n';
import type { CheckinRequestItem } from '@/lib/staff/checkin-types';
import {
  enqueue,
  flushQueue,
  newClientRef,
  pendingCount,
  postCheckins,
  tokenFromScan,
} from '@/lib/staff/queue';

type Feedback =
  | { kind: 'checking' }
  | { kind: 'success'; name: string }
  | { kind: 'already'; name: string; at: string }
  | { kind: 'invalid' }
  | { kind: 'not_found' }
  | { kind: 'queued' };

type CameraState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';

const READER_ID = 'qr-reader';
const SAME_CODE_COOLDOWN_MS = 4000;

let audioCtx: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = ok ? 880 : 330;
    g.gain.value = 0.15;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + (ok ? 0.12 : 0.3));
  } catch {}
  navigator.vibrate?.(ok ? 80 : [120, 60, 120]);
}

type Html5QrcodeInstance = {
  start: (
    camera: { facingMode: string } | string,
    config: {
      fps: number;
      qrbox: (w: number, h: number) => { width: number; height: number };
      aspectRatio?: number;
    },
    onSuccess: (text: string) => void,
    onError: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  isScanning: boolean;
};

export function Scanner({ initialTodayCount }: { initialTodayCount: number }) {
  const [camera, setCamera] = useState<CameraState>('idle');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [todayCount, setTodayCount] = useState(initialTodayCount);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [cameraCount, setCameraCount] = useState(0);
  const router = useRouter();
  const qrRef = useRef<Html5QrcodeInstance | null>(null);
  const camerasRef = useRef<Array<{ id: string; label: string }>>([]);
  const cameraIndexRef = useRef(-1);
  const lastCodeRef = useRef<{ text: string; at: number } | null>(null);
  const clearTimer = useRef<number | undefined>(undefined);

  const refreshPending = useCallback(async () => setPending(await pendingCount()), []);

  const showFeedback = useCallback((f: Feedback) => {
    setFeedback(f);
    window.clearTimeout(clearTimer.current);
    if (f.kind !== 'checking') {
      clearTimer.current = window.setTimeout(
        () => setFeedback(null),
        f.kind === 'success' ? 2200 : 3500,
      );
    }
  }, []);

  const submit = useCallback(
    async (item: CheckinRequestItem) => {
      showFeedback({ kind: 'checking' });
      try {
        const { results, todayCount: count } = await postCheckins([item]);
        const r = results[0];
        if (count !== null) setTodayCount(count);
        if (!r || r.status === 'error') throw new Error('server');
        if (r.status === 'checked_in') {
          beep(true);
          showFeedback({ kind: 'success', name: r.name ?? '' });
        } else if (r.status === 'already') {
          beep(false);
          showFeedback({ kind: 'already', name: r.name ?? '', at: r.checkinAt ?? '' });
        } else if (r.status === 'invalid') {
          beep(false);
          showFeedback({ kind: 'invalid' });
        } else {
          beep(false);
          showFeedback({ kind: 'not_found' });
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'auth') {
          router.push('/staff/login?next=/staff/scan');
          return;
        }
        // Network down or slow: keep the scan, sync later without double counting.
        await enqueue(item);
        beep(true);
        showFeedback({ kind: 'queued' });
        refreshPending();
      }
    },
    [refreshPending, router, showFeedback],
  );

  const onDecoded = useCallback(
    (text: string) => {
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.text === text && now - last.at < SAME_CODE_COOLDOWN_MS) return;
      lastCodeRef.current = { text, at: now };
      const token = tokenFromScan(text);
      if (!token) {
        beep(false);
        showFeedback({ kind: 'invalid' });
        return;
      }
      submit({ clientRef: newClientRef(), token, scannedAt: new Date().toISOString() });
    },
    [showFeedback, submit],
  );

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setCamera('starting');
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (qrRef.current?.isScanning) await qrRef.current.stop();
        qrRef.current ??= new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        }) as unknown as Html5QrcodeInstance;
        await qrRef.current.start(
          deviceId ?? { facingMode: 'environment' },
          {
            fps: 12,
            aspectRatio: 1,
            qrbox: (w, h) => {
              const s = Math.floor(Math.min(w, h) * 0.75);
              return { width: s, height: s };
            },
          },
          onDecoded,
          () => {},
        );
        setCamera('running');
        if (camerasRef.current.length === 0) {
          camerasRef.current = await Html5Qrcode.getCameras().catch(() => []);
          setCameraCount(camerasRef.current.length);
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : String(err);
        setCamera(/NotAllowed|Permission/i.test(name) ? 'denied' : 'unavailable');
      }
    },
    [onDecoded],
  );

  const switchCamera = useCallback(() => {
    const cams = camerasRef.current;
    if (cams.length < 2) return;
    cameraIndexRef.current = (cameraIndexRef.current + 1) % cams.length;
    startCamera(cams[cameraIndexRef.current].id);
  }, [startCamera]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await flushQueue();
    } catch {
      // still offline; try again later
    } finally {
      setSyncing(false);
      refreshPending();
    }
  }, [refreshPending, syncing]);

  useEffect(() => {
    pendingCount().then(setPending);
    const onOnline = () => sync();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CHECKINS_SYNCED') refreshPending();
    };
    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    const interval = window.setInterval(() => {
      pendingCount().then((n) => {
        if (n > 0 && navigator.onLine) void sync();
      });
    }, 20_000);
    return () => {
      window.removeEventListener('online', onOnline);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      window.clearInterval(interval);
      qrRef.current?.stop().catch(() => {});
    };
  }, [refreshPending, sync]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span aria-live="polite">{t('staff.todayCount', { count: todayCount })}</span>
        {pending > 0 ? (
          <button
            type="button"
            onClick={sync}
            className="bg-warning-50 text-warning-800 inline-flex min-h-11 items-center gap-1 rounded-lg px-3"
          >
            <CloudOff aria-hidden="true" className="size-4" />
            {t('staff.pendingSync', { count: pending })}
            <RefreshCw aria-hidden="true" className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t('staff.syncNow')}</span>
          </button>
        ) : null}
      </div>

      <div className="rounded-card relative overflow-hidden bg-black">
        <div
          id={READER_ID}
          className="aspect-square w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        {camera !== 'running' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            {camera === 'denied' ? (
              <p>{t('staff.cameraDenied')}</p>
            ) : camera === 'unavailable' ? (
              <p>{t('staff.cameraUnavailable')}</p>
            ) : (
              <p className="text-white/80">{t('staff.cameraHelp')}</p>
            )}
            <Button
              variant="accent"
              size="lg"
              onClick={() => startCamera()}
              disabled={camera === 'starting'}
            >
              <Camera aria-hidden="true" className="size-5" />
              {camera === 'starting' ? t('common.loading') : t('staff.startCamera')}
            </Button>
          </div>
        ) : null}
        <FeedbackOverlay feedback={feedback} />
      </div>

      {camera === 'running' && cameraCount > 1 ? (
        <Button variant="outline" block onClick={switchCamera}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {t('staff.switchCamera')}
        </Button>
      ) : null}

      <ManualSearch
        onCheckIn={(attendeeId) =>
          submit({ clientRef: newClientRef(), attendeeId, scannedAt: new Date().toISOString() })
        }
      />
    </div>
  );
}

function FeedbackOverlay({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return <p className="sr-only" aria-live="assertive" />;
  const styles: Record<Feedback['kind'], string> = {
    checking: 'bg-black/60 text-white',
    success: 'bg-success-600 text-white',
    already: 'bg-warning-500 text-ink',
    invalid: 'bg-danger-600 text-white',
    not_found: 'bg-danger-600 text-white',
    queued: 'bg-brand-700 text-white',
  };
  let icon = <RefreshCw aria-hidden="true" className="size-16 animate-spin" />;
  let title = t('staff.checking');
  let sub = '';
  switch (feedback.kind) {
    case 'success':
      icon = <CheckCircle2 aria-hidden="true" className="size-20" />;
      title = t('staff.checkedIn', { name: feedback.name });
      break;
    case 'already':
      icon = <TriangleAlert aria-hidden="true" className="size-20" />;
      title = feedback.name;
      sub = t('staff.already', { time: feedback.at ? formatClock(feedback.at) : '' });
      break;
    case 'invalid':
      icon = <XCircle aria-hidden="true" className="size-20" />;
      title = t('staff.invalidQr');
      break;
    case 'not_found':
      icon = <XCircle aria-hidden="true" className="size-20" />;
      title = t('staff.notFound');
      break;
    case 'queued':
      icon = <CloudOff aria-hidden="true" className="size-20" />;
      title = t('staff.queued');
      break;
  }
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center ${styles[feedback.kind]}`}
    >
      {icon}
      <p className="text-3xl leading-tight font-bold">{title}</p>
      {sub ? <p className="text-xl font-semibold">{sub}</p> : null}
    </div>
  );
}

function ManualSearch({ onCheckIn }: { onCheckIn: (attendeeId: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <h2 className="text-lg font-bold">{t('staff.manualTitle')}</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await staffLookupAction(query);
            if (res.ok) setResult(res.data);
            else setError(res.error);
          });
        }}
      >
        <label htmlFor="manual-q" className="sr-only">
          {t('staff.manualHint')}
        </label>
        <Input
          id="manual-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('staff.manualHint')}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
        <Button
          type="submit"
          disabled={pending || query.trim().length < 3}
          aria-label={t('staff.find')}
        >
          <Search aria-hidden="true" className="size-5" />
        </Button>
      </form>
      {error ? (
        <Alert tone="danger" className="mt-3">
          {tError(error)}
        </Alert>
      ) : null}
      {result === null ? <p className="text-muted mt-3">{t('staff.noMatch')}</p> : null}
      {result ? (
        <div className="mt-4 space-y-2">
          <p className="text-xl font-bold">{result.fullName}</p>
          <p className="text-muted font-mono">
            {result.passCode} · {result.maskedMobile}
          </p>
          <p className="text-sm">
            {t('staff.dates', { dates: result.dates.map((d) => formatDay(d)).join(', ') })}
          </p>
          <p className={result.checkedInToday ? 'text-success-700 font-semibold' : 'text-muted'}>
            {result.checkedInToday && result.checkedInAt
              ? t('staff.statusIn', { time: formatClock(result.checkedInAt) })
              : t('staff.statusOut')}
          </p>
          {!result.checkedInToday ? (
            <Button
              block
              onClick={() => {
                onCheckIn(result.attendeeId);
                setResult({
                  ...result,
                  checkedInToday: true,
                  checkedInAt: new Date().toISOString(),
                });
              }}
            >
              {t('staff.checkInButton')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

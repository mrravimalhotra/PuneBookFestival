'use client';
import { openDB, type IDBPDatabase } from 'idb';
import type { CheckinRequestItem, CheckinResultItem } from './checkin-types';

/**
 * Offline scan queue (IndexedDB 'pbf-scanner' / 'queue', keyed by clientRef).
 * The same store is replayed by the service worker on Background Sync.
 */
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('pbf-scanner', 1, {
    upgrade(d) {
      d.createObjectStore('queue', { keyPath: 'clientRef' });
    },
  });
  return dbp;
}

export async function enqueue(item: CheckinRequestItem) {
  await (await db()).put('queue', item);
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sync = (
      reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }
    )?.sync;
    await sync?.register('pbf-checkins');
  } catch {
    // Background Sync unsupported (iOS): the page retries when back online.
  }
}

export async function pendingCount(): Promise<number> {
  return (await db()).count('queue');
}

export type PostResult = { results: CheckinResultItem[]; todayCount: number | null };

export async function postCheckins(
  items: CheckinRequestItem[],
  timeoutMs = 5000,
): Promise<PostResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/staff/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      signal: ctrl.signal,
      credentials: 'same-origin',
    });
    if (res.status === 401 || res.status === 403) throw new Error('auth');
    if (!res.ok) throw new Error(`http ${res.status}`);
    return (await res.json()) as PostResult;
  } finally {
    clearTimeout(timer);
  }
}

/** Replays the queue in batches; returns how many items were settled. */
export async function flushQueue(): Promise<number> {
  const d = await db();
  const items = (await d.getAll('queue')) as CheckinRequestItem[];
  let settled = 0;
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    const { results } = await postCheckins(batch, 15_000);
    const tx = d.transaction('queue', 'readwrite');
    for (const r of results) {
      if (r.final) {
        await tx.store.delete(r.clientRef);
        settled++;
      }
    }
    await tx.done;
  }
  return settled;
}

export function newClientRef(): string {
  return crypto.randomUUID();
}

/** Pulls the pass token out of a scanned QR (full pass URL or bare token). */
export function tokenFromScan(text: string): string | null {
  const v = text.trim();
  const m = v.match(/\/pass\/([A-Za-z0-9_-]{20,64})(?:[/?#]|$)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,64}$/.test(v) ? v : null;
}

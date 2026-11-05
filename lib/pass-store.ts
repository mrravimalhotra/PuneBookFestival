'use client';
import { openDB, type IDBPDatabase } from 'idb';
import { useMemo, useSyncExternalStore } from 'react';
import type { PassSnapshot } from './pass-types';

/**
 * The attendee's own pass, cached on their device (IndexedDB) so the QR opens
 * with no network at a crowded gate. Holds only this device owner's pass.
 */
const DB = 'pbf-passes';
const STORE = 'passes';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB(DB, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: 'token' });
    },
  });
  return dbPromise;
}

async function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 300_000) return null;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function savePass(pass: PassSnapshot): Promise<void> {
  // Inline sponsor logos so they show offline too.
  const sponsors = (
    await Promise.all(
      pass.sponsors.map(async (s) => {
        const logoUrl = await toDataUrl(s.logoUrl);
        return logoUrl ? { ...s, logoUrl } : null;
      }),
    )
  ).filter((s): s is PassSnapshot['sponsors'][number] => s !== null);
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  // One pass per device: replace any older one.
  await tx.store.clear();
  await tx.store.put({ ...pass, sponsors, savedAt: new Date().toISOString() });
  await tx.done;
  try {
    localStorage.setItem(
      'pbf.savedPass',
      JSON.stringify({ token: pass.token, name: pass.fullName }),
    );
    window.dispatchEvent(new Event('pbf:saved-pass'));
  } catch {}
}

export async function loadSavedPass(): Promise<PassSnapshot | null> {
  try {
    const all = (await (await db()).getAll(STORE)) as PassSnapshot[];
    return all[0] ?? null;
  } catch {
    return null;
  }
}

export async function removeSavedPass(): Promise<void> {
  await (await db()).clear(STORE);
  try {
    localStorage.removeItem('pbf.savedPass');
    window.dispatchEvent(new Event('pbf:saved-pass'));
  } catch {}
}

/** Fast synchronous hint (token + name) for the self check-in page. */
export function savedPassHint(): { token: string; name: string } | null {
  try {
    const raw = localStorage.getItem('pbf.savedPass');
    return raw ? (JSON.parse(raw) as { token: string; name: string }) : null;
  } catch {
    return null;
  }
}

// ---- React hook: subscribe to the saved-pass hint without setState-in-effect ----

function subscribeHint(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener('pbf:saved-pass', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('pbf:saved-pass', cb);
  };
}

function hintSnapshot(): string | null {
  try {
    return localStorage.getItem('pbf.savedPass');
  } catch {
    return null;
  }
}

export function useSavedPassHint(): { token: string; name: string } | null {
  const raw = useSyncExternalStore(subscribeHint, hintSnapshot, () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { token: string; name: string };
    } catch {
      return null;
    }
  }, [raw]);
}

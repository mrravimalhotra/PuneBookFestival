'use client';
import { useEffect } from 'react';

const KEY = 'pbf.venueKey';

/** Remembers a valid venue key so the "Self Check-in" app shortcut works later. */
export function RememberVenueKey({ venueKey }: { venueKey: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, venueKey);
    } catch {}
  }, [venueKey]);
  return null;
}

/** On the "please scan the poster" screen: reuse a remembered key if there is one. */
export function RestoreVenueKey() {
  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY);
      if (k && !new URLSearchParams(window.location.search).get('k')) {
        window.location.replace(`/checkin?k=${encodeURIComponent(k)}`);
      }
    } catch {}
  }, []);
  return null;
}

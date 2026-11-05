'use client';
import { useOffline } from 'next/offline';
import { WifiOff } from 'lucide-react';

export function OfflineBanner({ label }: { label: string }) {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="no-print bg-ink flex items-center justify-center gap-2 px-4 py-2 text-sm text-white"
    >
      <WifiOff aria-hidden="true" className="size-4" />
      {label}
    </div>
  );
}

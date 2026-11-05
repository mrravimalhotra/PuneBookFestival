import 'server-only';
import { publicEnv } from '@/lib/env-public';
import { signVenueKey } from '@/lib/tokens';

/** URL encoded in the venue self check-in poster. */
export function venueCheckinUrl(festivalYear: number): string {
  return `${publicEnv().NEXT_PUBLIC_APP_URL}/checkin?k=${encodeURIComponent(signVenueKey(festivalYear))}`;
}

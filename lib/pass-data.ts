import 'server-only';
import { publicEnv } from '@/lib/env-public';
import { qrPngDataUrl } from '@/lib/qr';
import { partnerLogoUrl } from '@/lib/storage-url';
import { createServiceClient } from '@/lib/supabase/service';
import { signPassToken } from '@/lib/tokens';
import { topSponsors, type Partner, type PublicSettings } from '@/lib/data/public';
import type { PassSnapshot } from '@/lib/pass-types';

export type PassRecord = {
  attendeeId: string;
  fullName: string;
  passCode: string;
  dates: string[];
  checkedInToday: boolean;
  checkedInAt: string | null;
};

/** Loads a pass for a verified attendee id (call only after verifying the HMAC token). */
export async function loadPass(attendeeId: string): Promise<PassRecord | null> {
  const { data, error } = await createServiceClient().rpc('get_pass', {
    p_attendee_id: attendeeId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    attendeeId: row.attendee_id,
    fullName: row.full_name,
    passCode: row.pass_code,
    dates: row.dates ?? [],
    checkedInToday: row.checked_in_today,
    checkedInAt: row.checked_in_at,
  };
}

export function passUrl(token: string): string {
  return `${publicEnv().NEXT_PUBLIC_APP_URL}/pass/${token}`;
}

export async function buildSnapshot(
  pass: PassRecord,
  settings: PublicSettings,
  partners: Partner[],
): Promise<PassSnapshot> {
  const token = signPassToken(pass.attendeeId);
  const url = passUrl(token);
  return {
    token,
    url,
    fullName: pass.fullName,
    passCode: pass.passCode,
    dates: pass.dates,
    festivalName: settings.festival_name,
    festivalYear: settings.festival_year,
    venue: settings.venue,
    startDate: settings.start_date,
    endDate: settings.end_date,
    openTime: settings.daily_open_time,
    closeTime: settings.daily_close_time,
    // QR holds only the signed pass URL — no personal data.
    qrDataUrl: await qrPngDataUrl(url, 512),
    sponsors: topSponsors(partners, 'pass').map((p) => ({
      id: p.id,
      name: p.name,
      logoUrl: partnerLogoUrl(p.logo_path) ?? '',
    })),
  };
}

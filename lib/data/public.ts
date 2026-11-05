import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { log } from '@/lib/logger';
import { createPublicClient } from '@/lib/supabase/public';
import type { Database } from '@/lib/supabase/database.types';
import type { PartnerPlacement, PartnerTier, PeoplePlacement } from '@/lib/validation/admin';

/**
 * Cached public reads. Each is tagged so admin saves can revalidate exactly
 * what changed (see lib/revalidate.ts). If Supabase is unreachable the result
 * is cached for seconds only, so pages recover on their own.
 */
export const TAGS = {
  settings: 'settings',
  days: 'festival-days',
  partners: 'partners',
  people: 'people',
  winners: 'winners',
} as const;

export type PublicSettings = Pick<
  Database['public']['Tables']['settings']['Row'],
  | 'festival_name'
  | 'festival_year'
  | 'venue'
  | 'start_date'
  | 'end_date'
  | 'daily_open_time'
  | 'daily_close_time'
  | 'registration_open'
  | 'self_checkin_enabled'
  | 'draw_winners_per_day'
  | 'consent_text_version'
  | 'privacy_text'
  | 'contact_email'
  | 'updated_at'
>;

export type Partner = {
  id: string;
  name: string;
  type: 'organiser' | 'sponsor';
  tier: PartnerTier;
  logo_path: string;
  banner_path: string | null;
  website_url: string | null;
  tagline: string | null;
  display_order: number;
  show_on: PartnerPlacement[];
};

export type KeyPerson = {
  id: string;
  full_name: string;
  designation: string;
  organisation: string | null;
  photo_path: string | null;
  short_message: string | null;
  display_order: number;
  is_featured: boolean;
  show_on: PeoplePlacement[];
};

export type WinnerRow = {
  draw_date: string;
  position: number;
  first_name: string;
  masked_mobile: string;
};

export async function getPublicSettings(): Promise<PublicSettings | null> {
  'use cache';
  cacheTag(TAGS.settings);
  try {
    const { data, error } = await createPublicClient()
      .from('settings')
      .select(
        'festival_name, festival_year, venue, start_date, end_date, daily_open_time, daily_close_time, registration_open, self_checkin_enabled, draw_winners_per_day, consent_text_version, privacy_text, contact_email, updated_at',
      )
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    cacheLife('hours');
    return data;
  } catch (err) {
    log.error('public.settings', err);
    cacheLife('seconds');
    return null;
  }
}

export async function getFestivalDays(): Promise<string[]> {
  'use cache';
  cacheTag(TAGS.days);
  try {
    const { data, error } = await createPublicClient()
      .from('festival_days')
      .select('festival_date')
      .eq('is_active', true)
      .order('festival_date');
    if (error) throw error;
    cacheLife('hours');
    return data.map((d) => d.festival_date);
  } catch (err) {
    log.error('public.festival_days', err);
    cacheLife('seconds');
    return [];
  }
}

const TIER_ORDER: Record<PartnerTier, number> = {
  title: 0,
  platinum: 1,
  gold: 2,
  silver: 3,
  partner: 4,
};

export async function getPartners(): Promise<Partner[]> {
  'use cache';
  cacheTag(TAGS.partners);
  try {
    const { data, error } = await createPublicClient()
      .from('partners')
      .select(
        'id, name, type, tier, logo_path, banner_path, website_url, tagline, display_order, show_on',
      )
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    cacheLife('hours');
    return (data as Partner[]).sort(
      (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.display_order - b.display_order,
    );
  } catch (err) {
    log.error('public.partners', err);
    cacheLife('seconds');
    return [];
  }
}

export async function getKeyPeople(): Promise<KeyPerson[]> {
  'use cache';
  cacheTag(TAGS.people);
  try {
    const { data, error } = await createPublicClient()
      .from('key_people')
      .select(
        'id, full_name, designation, organisation, photo_path, short_message, display_order, is_featured, show_on',
      )
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('display_order');
    if (error) throw error;
    cacheLife('hours');
    return data as KeyPerson[];
  } catch (err) {
    log.error('public.key_people', err);
    cacheLife('seconds');
    return [];
  }
}

export async function getWinners(): Promise<WinnerRow[]> {
  'use cache';
  cacheTag(TAGS.winners);
  try {
    const { data, error } = await createPublicClient()
      .from('public_winners')
      .select('draw_date, position, first_name, masked_mobile')
      .order('draw_date', { ascending: false })
      .order('position')
      .limit(1000);
    if (error) throw error;
    cacheLife('hours');
    return data as WinnerRow[];
  } catch (err) {
    log.error('public.winners', err);
    cacheLife('seconds');
    return [];
  }
}

export function partnersFor(
  partners: Partner[],
  placement: PartnerPlacement,
  type?: Partner['type'],
) {
  return partners.filter((p) => p.show_on.includes(placement) && (!type || p.type === type));
}

export function peopleFor(people: KeyPerson[], placement: PeoplePlacement) {
  return people.filter((p) => p.show_on.includes(placement));
}

/** Title or top-tier sponsors for confirmation/pass/check-in screens. */
export function topSponsors(
  partners: Partner[],
  placement: 'pass' | 'checkin_success' | 'winners',
  max = 4,
) {
  const placed = partners.filter((p) => p.type === 'sponsor' && p.show_on.includes(placement));
  const bestTier = placed[0]?.tier;
  const top = placed.filter(
    (p) => p.tier === 'title' || p.tier === 'platinum' || p.tier === bestTier,
  );
  return top.slice(0, max);
}

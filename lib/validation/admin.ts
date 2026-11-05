import { z } from 'zod';
import { isoDateSchema } from './common';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'errors.timeInvalid');
const checkbox = z
  .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((v) => v === true || v === 'on' || v === 'true');

export const settingsSchema = z
  .object({
    festival_name: z.string().trim().min(2).max(120),
    festival_year: z.coerce.number().int().min(2000).max(2200),
    venue: z.string().trim().min(2).max(200),
    start_date: isoDateSchema,
    end_date: isoDateSchema,
    daily_open_time: timeSchema,
    daily_close_time: timeSchema,
    registration_open: checkbox,
    self_checkin_enabled: checkbox,
    draw_winners_per_day: z.coerce.number().int().min(1).max(100),
    staff_limit: z.coerce.number().int().min(1).max(200),
    consent_text_version: z.string().trim().min(1).max(20),
    privacy_text: z.string().max(10_000).default(''),
    contact_email: z.union([z.literal(''), z.email()]).default(''),
    confirm_drop_dates: checkbox,
  })
  .refine((v) => v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'errors.endBeforeStart',
  })
  .refine((v) => (Date.parse(v.end_date) - Date.parse(v.start_date)) / 86_400_000 <= 60, {
    path: ['end_date'],
    message: 'errors.rangeTooLong',
  })
  .refine((v) => v.daily_close_time > v.daily_open_time, {
    path: ['daily_close_time'],
    message: 'errors.closeBeforeOpen',
  });

export type SettingsData = z.output<typeof settingsSchema>;

export const staffCreateSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(10, 'errors.passwordShort')
    .max(72)
    .regex(/[A-Za-z]/, 'errors.passwordWeak')
    .regex(/\d/, 'errors.passwordWeak'),
});

export const staffPasswordSchema = z.object({
  id: z.uuid(),
  password: staffCreateSchema.shape.password,
});

export const PARTNER_PLACEMENTS = [
  'home',
  'header',
  'footer',
  'pass',
  'checkin_success',
  'winners',
  'reports',
  'venue_qr',
] as const;
export const PARTNER_TIERS = ['title', 'platinum', 'gold', 'silver', 'partner'] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];
export type PartnerPlacement = (typeof PARTNER_PLACEMENTS)[number];

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .default('')
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'errors.urlInvalid');

export const partnerSchema = z.object({
  id: z.uuid().optional().or(z.literal('')),
  name: z.string().trim().min(1).max(120),
  type: z.enum(['organiser', 'sponsor']),
  tier: z.enum(PARTNER_TIERS),
  website_url: optionalUrl,
  tagline: z.string().trim().max(160).optional().default(''),
  display_order: z.coerce.number().int().min(0).max(10_000).default(0),
  is_active: checkbox,
  show_on: z.array(z.enum(PARTNER_PLACEMENTS)).default([]),
  festival_year: z.coerce.number().int().min(2000).max(2200),
});

export const PEOPLE_PLACEMENTS = ['home', 'about', 'pass', 'checkin_success', 'reports'] as const;
export type PeoplePlacement = (typeof PEOPLE_PLACEMENTS)[number];

export const personSchema = z.object({
  id: z.uuid().optional().or(z.literal('')),
  full_name: z.string().trim().min(1).max(120),
  designation: z.string().trim().min(1).max(160),
  organisation: z.string().trim().max(160).optional().default(''),
  short_message: z.string().trim().max(300, 'errors.messageTooLong').optional().default(''),
  display_order: z.coerce.number().int().min(0).max(10_000).default(0),
  is_featured: checkbox,
  is_active: checkbox,
  photo_consent: checkbox,
  show_on: z.array(z.enum(PEOPLE_PLACEMENTS)).default([]),
  festival_year: z.coerce.number().int().min(2000).max(2200),
});

export const reorderSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
});

export const attendeeFilterSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  date: z
    .union([z.literal(''), isoDateSchema])
    .optional()
    .default(''),
  gender: z
    .union([z.literal(''), z.enum(['male', 'female', 'other', 'prefer_not_to_say'])])
    .optional()
    .default(''),
  age_band: z.string().max(20).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
});

export type AttendeeFilter = z.output<typeof attendeeFilterSchema>;

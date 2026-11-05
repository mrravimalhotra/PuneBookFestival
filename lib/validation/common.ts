import { z } from 'zod';

/** Normalise 10-digit Indian mobile input to E.164 (+91XXXXXXXXXX), or null. */
export function normaliseMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const mobileSchema = z
  .string({ error: 'errors.mobileRequired' })
  .trim()
  .min(1, 'errors.mobileRequired')
  .transform((v, ctx) => {
    const n = normaliseMobile(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'errors.mobileInvalid' });
      return z.NEVER;
    }
    return n;
  });

export const emailSchema = z
  .string({ error: 'errors.emailRequired' })
  .trim()
  .min(1, 'errors.emailRequired')
  .max(254, 'errors.emailInvalid')
  .pipe(z.email({ error: 'errors.emailInvalid' }))
  .transform((v) => v.toLowerCase());

export const passCodeSchema = z
  .string({ error: 'errors.passCodeRequired' })
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s/g, ''))
  .transform((v) => (/^PBF-?/.test(v) ? `PBF-${v.replace(/^PBF-?/, '')}` : `PBF-${v}`))
  .pipe(z.string().regex(/^PBF-[A-HJ-NP-Z2-9]{6}$/, 'errors.passCodeInvalid'));

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'errors.dateInvalid');

/** Honeypot: must be empty. Bots that fill every field are silently rejected. */
export const honeypotSchema = z.string().max(0).optional().or(z.literal(''));

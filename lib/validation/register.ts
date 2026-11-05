import { z } from 'zod';
import { emailSchema, honeypotSchema, isoDateSchema, mobileSchema } from './common';

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

/** Shared by the client form (React Hook Form) and the server action. */
export const registerSchema = z.object({
  fullName: z
    .string({ error: 'errors.nameRequired' })
    .trim()
    .min(2, 'errors.nameShort')
    .max(100, 'errors.nameLong')
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, 'errors.nameInvalid'),
  mobile: mobileSchema,
  email: emailSchema,
  gender: z.enum(GENDERS, { error: 'errors.genderRequired' }),
  age: z.coerce
    .number({ error: 'errors.ageRequired' })
    .int('errors.ageInvalid')
    .min(1, 'errors.ageInvalid')
    .max(120, 'errors.ageInvalid'),
  city: z
    .string({ error: 'errors.cityRequired' })
    .trim()
    .min(1, 'errors.cityRequired')
    .max(80, 'errors.tooLong'),
  area: z.string().trim().max(80, 'errors.tooLong').optional().default(''),
  dates: z.array(isoDateSchema).min(1, 'errors.datesRequired').max(60),
  consent: z.literal(true, { error: 'errors.consentRequired' }),
  website: honeypotSchema,
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

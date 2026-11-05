import { z } from 'zod';
import { emailSchema, honeypotSchema, mobileSchema, passCodeSchema } from './common';

/** My Pass / self check-in: mobile plus a second factor (pass code or email). */
export const passLookupSchema = z
  .object({
    mobile: mobileSchema,
    method: z.enum(['code', 'email']),
    passCode: z.string().optional().default(''),
    email: z.string().optional().default(''),
    website: honeypotSchema,
  })
  .transform((v, ctx) => {
    if (v.method === 'code') {
      const r = passCodeSchema.safeParse(v.passCode);
      if (!r.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['passCode'],
          message: r.error.issues[0]?.message ?? 'errors.passCodeInvalid',
        });
        return z.NEVER;
      }
      return { mobile: v.mobile, passCode: r.data, email: null as string | null };
    }
    const r = emailSchema.safeParse(v.email);
    if (!r.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['email'],
        message: r.error.issues[0]?.message ?? 'errors.emailInvalid',
      });
      return z.NEVER;
    }
    return { mobile: v.mobile, passCode: null as string | null, email: r.data };
  });

export type PassLookupInput = z.input<typeof passLookupSchema>;

export const selfCheckinSchema = z.union([
  z.object({
    kind: z.literal('token'),
    key: z.string().min(1).max(64),
    token: z.string().min(20).max(64),
  }),
  z.object({
    kind: z.literal('details'),
    key: z.string().min(1).max(64),
    mobile: mobileSchema,
    passCode: passCodeSchema,
    website: honeypotSchema,
  }),
]);

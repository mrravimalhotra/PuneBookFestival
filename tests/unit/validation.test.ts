import { describe, expect, it } from 'vitest';
import { normaliseMobile, passCodeSchema } from '@/lib/validation/common';
import { registerSchema } from '@/lib/validation/register';
import { passLookupSchema, selfCheckinSchema } from '@/lib/validation/pass';
import {
  settingsSchema,
  partnerSchema,
  personSchema,
  staffCreateSchema,
} from '@/lib/validation/admin';

const valid = {
  fullName: 'Asha Kulkarni',
  mobile: '98123 45621',
  email: 'Asha@Example.com',
  gender: 'female',
  age: '29',
  city: 'Pune',
  area: '',
  dates: ['2026-12-12'],
  consent: true,
  website: '',
};

describe('normaliseMobile', () => {
  it.each([
    ['9812345621', '+919812345621'],
    ['+91 98123 45621', '+919812345621'],
    ['09812345621', '+919812345621'],
    ['919812345621', '+919812345621'],
  ])('%s -> %s', (input, expected) => expect(normaliseMobile(input)).toBe(expected));

  it.each(['12345', '5812345621', '98123456', '+1 415 555 0100', ''])('rejects %s', (input) =>
    expect(normaliseMobile(input)).toBeNull(),
  );
});

describe('registerSchema', () => {
  it('accepts and normalises a valid registration', () => {
    const r = registerSchema.parse(valid);
    expect(r.mobile).toBe('+919812345621');
    expect(r.email).toBe('asha@example.com');
    expect(r.age).toBe(29);
  });

  it('requires consent', () => {
    const r = registerSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('errors.consentRequired');
  });

  it('requires at least one date', () => {
    const r = registerSchema.safeParse({ ...valid, dates: [] });
    expect(r.error?.issues[0]?.message).toBe('errors.datesRequired');
  });

  it.each([
    ['mobile', '12345', 'errors.mobileInvalid'],
    ['email', 'not-an-email', 'errors.emailInvalid'],
    ['age', '0', 'errors.ageInvalid'],
    ['age', '121', 'errors.ageInvalid'],
    ['age', '2.5', 'errors.ageInvalid'],
    ['fullName', 'A', 'errors.nameShort'],
    ['fullName', '<script>', 'errors.nameInvalid'],
    ['gender', 'robot', 'errors.genderRequired'],
    ['city', '   ', 'errors.cityRequired'],
  ])('rejects bad %s (%s)', (field, value, message) => {
    const r = registerSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === field)?.message).toBe(message);
  });

  it('rejects a filled honeypot', () => {
    expect(registerSchema.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false);
  });

  it('accepts Devanagari names', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: 'आशा कुलकर्णी' }).success).toBe(true);
  });
});

describe('pass code', () => {
  it.each(['PBF-7K3Q9X', 'pbf-7k3q9x', 'PBF7K3Q9X', '7K3Q9X', ' 7k3q 9x '])('normalises %s', (v) =>
    expect(passCodeSchema.parse(v)).toBe('PBF-7K3Q9X'),
  );
  it.each(['PBF-7K3Q9', 'PBF-OOOOOO', 'PBF-111111', 'XYZ-7K3Q9X'])('rejects %s', (v) =>
    expect(passCodeSchema.safeParse(v).success).toBe(false),
  );
});

describe('passLookupSchema', () => {
  it('needs a pass code when method is code', () => {
    expect(
      passLookupSchema.safeParse({ mobile: '9812345621', method: 'code', passCode: '' }).success,
    ).toBe(false);
    expect(
      passLookupSchema.parse({ mobile: '9812345621', method: 'code', passCode: '7k3q9x' }),
    ).toEqual({
      mobile: '+919812345621',
      passCode: 'PBF-7K3Q9X',
      email: null,
    });
  });
  it('needs an email when method is email', () => {
    expect(
      passLookupSchema.safeParse({ mobile: '9812345621', method: 'email', email: 'x' }).success,
    ).toBe(false);
    expect(
      passLookupSchema.parse({ mobile: '9812345621', method: 'email', email: 'A@B.co' }).email,
    ).toBe('a@b.co');
  });
});

describe('selfCheckinSchema', () => {
  it('accepts token and details variants', () => {
    expect(
      selfCheckinSchema.safeParse({ kind: 'token', key: 'k', token: 'x'.repeat(39) }).success,
    ).toBe(true);
    expect(
      selfCheckinSchema.safeParse({
        kind: 'details',
        key: 'k',
        mobile: '9812345621',
        passCode: '7K3Q9X',
      }).success,
    ).toBe(true);
    expect(
      selfCheckinSchema.safeParse({ kind: 'details', key: 'k', mobile: '9812345621' }).success,
    ).toBe(false);
  });
});

describe('admin schemas', () => {
  const settings = {
    festival_name: 'Pune Book Festival',
    festival_year: '2026',
    venue: 'Fergusson College, Pune',
    start_date: '2026-12-12',
    end_date: '2026-12-20',
    daily_open_time: '11:00',
    daily_close_time: '20:00',
    registration_open: 'on',
    draw_winners_per_day: '5',
    staff_limit: '10',
    consent_text_version: 'v1',
  };
  it('parses settings form data', () => {
    const r = settingsSchema.parse(settings);
    expect(r.registration_open).toBe(true);
    expect(r.self_checkin_enabled).toBe(false);
    expect(r.festival_year).toBe(2026);
  });
  it('rejects end before start and close before open', () => {
    expect(settingsSchema.safeParse({ ...settings, end_date: '2026-12-01' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, daily_close_time: '10:00' }).success).toBe(
      false,
    );
  });
  it('requires strong staff passwords', () => {
    expect(
      staffCreateSchema.safeParse({ full_name: 'A', email: 'a@b.co', password: 'short1' }).success,
    ).toBe(false);
    expect(
      staffCreateSchema.safeParse({ full_name: 'A', email: 'a@b.co', password: 'longenough' })
        .success,
    ).toBe(false);
    expect(
      staffCreateSchema.safeParse({ full_name: 'A', email: 'a@b.co', password: 'longenough1' })
        .success,
    ).toBe(true);
  });
  it('validates partner placements and URLs', () => {
    const base = {
      name: 'NBT',
      type: 'organiser',
      tier: 'title',
      festival_year: 2026,
      show_on: ['header'],
    };
    expect(partnerSchema.safeParse(base).success).toBe(true);
    expect(partnerSchema.safeParse({ ...base, show_on: ['sidebar'] }).success).toBe(false);
    expect(partnerSchema.safeParse({ ...base, website_url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });
  it('limits organiser messages to 300 characters', () => {
    const base = { full_name: 'A', designation: 'Convenor', festival_year: 2026 };
    expect(personSchema.safeParse({ ...base, short_message: 'x'.repeat(300) }).success).toBe(true);
    expect(personSchema.safeParse({ ...base, short_message: 'x'.repeat(301) }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ageBand,
  festivalTodayIso,
  firstName,
  formatDateRange,
  formatDay,
  formatTime,
  maskMobile,
} from '@/lib/format';
import { translate } from '@/lib/i18n';

describe('format', () => {
  it('masks mobiles like the database does', () => {
    expect(maskMobile('+919812345621')).toBe('98XXXXXX21');
  });
  it('takes the first name', () => {
    expect(firstName('  Asha  Kulkarni ')).toBe('Asha');
  });
  it('bands ages', () => {
    expect([5, 12, 13, 17, 18, 24, 25, 34, 35, 44, 45, 59, 60, 99].map(ageBand)).toEqual([
      '12 and under',
      '12 and under',
      '13–17',
      '13–17',
      '18–24',
      '18–24',
      '25–34',
      '25–34',
      '35–44',
      '35–44',
      '45–59',
      '45–59',
      '60 and over',
      '60 and over',
    ]);
  });
  it('formats festival dates without time-zone drift', () => {
    expect(formatDay('2026-12-12')).toMatch(/Sat.*12.*Dec/);
    expect(formatDateRange('2026-12-12', '2026-12-20')).toBe('12–20 December 2026');
    expect(formatTime('11:00:00')).toBe('11:00 am');
    expect(formatTime('20:00')).toBe('8:00 pm');
  });
  it('computes festival today in Asia/Kolkata', () => {
    // 20:00 UTC on 11 Dec is 01:30 on 12 Dec in India.
    expect(festivalTodayIso(new Date('2026-12-11T20:00:00Z'))).toBe('2026-12-12');
  });
});

describe('i18n', () => {
  it('interpolates variables and falls back to the key', () => {
    expect(translate('register.title', { festival: 'PBF', year: 2026 })).toBe(
      'Register for PBF 2026',
    );
    expect(translate('does.not.exist')).toBe('does.not.exist');
  });
});

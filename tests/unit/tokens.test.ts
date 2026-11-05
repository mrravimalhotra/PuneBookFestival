import { describe, expect, it } from 'vitest';
import {
  extractPassToken,
  signPassToken,
  signVenueKey,
  verifyPassToken,
  verifyVenueKey,
} from '@/lib/tokens';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('pass tokens', () => {
  it('round-trips an attendee id', () => {
    const token = signPassToken(ID);
    expect(token).toMatch(/^[A-Za-z0-9_-]{39}$/);
    expect(verifyPassToken(token)).toBe(ID);
  });

  it('is deterministic and contains no personal data', () => {
    expect(signPassToken(ID)).toBe(signPassToken(ID));
  });

  it('rejects tampered tokens', () => {
    const token = signPassToken(ID);
    const raw = Buffer.from(token, 'base64url');
    raw[5] ^= 0xff; // flip a bit in the id
    expect(verifyPassToken(raw.toString('base64url'))).toBeNull();
    const mac = Buffer.from(token, 'base64url');
    mac[mac.length - 1] ^= 0x01; // flip a bit in the MAC
    expect(verifyPassToken(mac.toString('base64url'))).toBeNull();
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'abc', 'x'.repeat(39), '!!!', null, undefined, 'a'.repeat(200)]) {
      expect(verifyPassToken(bad as string)).toBeNull();
    }
  });

  it('rejects a token signed with another secret', () => {
    const token = signPassToken(ID);
    const original = process.env.PASS_TOKEN_SECRET;
    process.env.PASS_TOKEN_SECRET = 'another-secret-0123456789-abcdefghijklmnop';
    try {
      expect(verifyPassToken(token)).toBeNull();
    } finally {
      process.env.PASS_TOKEN_SECRET = original;
    }
  });

  it('throws when the secret is too short', () => {
    const original = process.env.PASS_TOKEN_SECRET;
    process.env.PASS_TOKEN_SECRET = 'short';
    try {
      expect(() => signPassToken(ID)).toThrow();
    } finally {
      process.env.PASS_TOKEN_SECRET = original;
    }
  });

  it('extracts tokens from scanned QR values', () => {
    const token = signPassToken(ID);
    expect(extractPassToken(`https://example.org/pass/${token}`)).toBe(token);
    expect(extractPassToken(`https://example.org/pass/${token}?welcome=1`)).toBe(token);
    expect(extractPassToken(token)).toBe(token);
    expect(extractPassToken('https://example.org/other')).toBeNull();
  });
});

describe('venue self check-in key', () => {
  it('verifies for the right year only', () => {
    const key = signVenueKey(2026);
    expect(verifyVenueKey(key, 2026)).toBe(true);
    expect(verifyVenueKey(key, 2027)).toBe(false);
  });

  it('rejects forged or missing keys', () => {
    expect(verifyVenueKey(undefined, 2026)).toBe(false);
    expect(verifyVenueKey('', 2026)).toBe(false);
    expect(verifyVenueKey('2026.AAAAAAAAAAAAAAAAAAAAAAAA', 2026)).toBe(false);
    expect(verifyVenueKey(signVenueKey(2026).replace(/.$/, 'x'), 2026)).toBe(false);
  });

  it('cannot be used as a pass token', () => {
    expect(verifyPassToken(signVenueKey(2026))).toBeNull();
  });
});

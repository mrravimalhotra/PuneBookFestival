import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed tokens. QR codes carry only these — never personal data.
 *
 * Pass token (base64url, 39 chars):
 *   byte 0      version (1)
 *   bytes 1-16  attendee UUID
 *   bytes 17-28 first 12 bytes of HMAC-SHA256(PASS_TOKEN_SECRET, "pass" | version | uuid)
 *
 * Venue self check-in key: "<festival_year>.<base64url HMAC>" signed with
 * SELF_CHECKIN_SECRET. Rotate it by changing the secret (old posters stop
 * working) or by moving to next year's festival_year.
 */

const PASS_VERSION = 1;
const MAC_BYTES = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretFor(name: 'PASS_TOKEN_SECRET' | 'SELF_CHECKIN_SECRET'): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} is missing or shorter than 32 characters`);
  }
  return value;
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bytesToUuid(b: Buffer): string {
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function passMac(version: number, idBytes: Buffer): Buffer {
  return createHmac('sha256', secretFor('PASS_TOKEN_SECRET'))
    .update('pass')
    .update(Buffer.from([version]))
    .update(idBytes)
    .digest()
    .subarray(0, MAC_BYTES);
}

export function signPassToken(attendeeId: string): string {
  if (!UUID_RE.test(attendeeId)) throw new Error('Invalid attendee id');
  const idBytes = uuidToBytes(attendeeId);
  return Buffer.concat([
    Buffer.from([PASS_VERSION]),
    idBytes,
    passMac(PASS_VERSION, idBytes),
  ]).toString('base64url');
}

/** Returns the attendee id, or null if the token is malformed or forged. */
export function verifyPassToken(token: string | null | undefined): string | null {
  if (!token || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  if (raw.length !== 1 + 16 + MAC_BYTES || raw[0] !== PASS_VERSION) return null;
  const idBytes = raw.subarray(1, 17);
  const mac = raw.subarray(17);
  const expected = passMac(PASS_VERSION, idBytes);
  if (!timingSafeEqual(mac, expected)) return null;
  return bytesToUuid(idBytes);
}

/** Extracts a pass token from a scanned QR value (full pass URL or bare token). */
export function extractPassToken(scanned: string): string | null {
  const value = scanned.trim();
  const match = value.match(/\/pass\/([A-Za-z0-9_-]{20,64})(?:[/?#]|$)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{20,64}$/.test(value)) return value;
  return null;
}

function venueMac(year: number): string {
  return createHmac('sha256', secretFor('SELF_CHECKIN_SECRET'))
    .update(`self-checkin:v1:${year}`)
    .digest()
    .subarray(0, 18)
    .toString('base64url');
}

export function signVenueKey(festivalYear: number): string {
  return `${festivalYear}.${venueMac(festivalYear)}`;
}

export function verifyVenueKey(key: string | null | undefined, festivalYear: number): boolean {
  if (!key || key.length > 64) return false;
  const [yearPart, mac] = key.split('.');
  if (!yearPart || !mac || Number(yearPart) !== festivalYear) return false;
  const expected = Buffer.from(venueMac(festivalYear));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

import 'server-only';
import sharp from 'sharp';

export class UploadError extends Error {}

const MB = 1024 * 1024;
export const LOGO_MAX = 1 * MB;
export const LOGO_WARN = 200 * 1024;
export const PHOTO_MAX = 2 * MB;

type Sniffed = 'png' | 'webp' | 'jpeg' | 'svg' | null;

/** Detect the real file type from its bytes (never trust the browser's MIME type). */
export function sniff(buf: Buffer): Sniffed {
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'webp';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  const head = buf.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'svg';
  return null;
}

/**
 * Strict SVG sanitiser for logos. Rejects anything that can execute or load
 * external content, and strips comments and processing instructions.
 */
export function sanitiseSvg(input: string): string {
  const forbidden: Array<[RegExp, string]> = [
    [/<!DOCTYPE|<!ENTITY/i, 'DTDs/entities'],
    [/<\s*script/i, 'scripts'],
    [/<\s*(foreignObject|iframe|embed|object|audio|video|use)\b/i, 'embedded content'],
    [/\son[a-z]+\s*=/i, 'event handlers'],
    [/javascript\s*:/i, 'javascript: URLs'],
    [/(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpeg|webp);base64,)/i, 'external links'],
    [/url\(\s*["']?\s*(?!#|data:image\/)/i, 'external CSS resources'],
    [/@import/i, 'CSS imports'],
  ];
  for (const [re, what] of forbidden) {
    if (re.test(input)) throw new UploadError(`SVG rejected: contains ${what}.`);
  }
  return input
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

export async function fileToBuffer(file: File, max: number): Promise<Buffer> {
  if (file.size === 0) throw new UploadError('The file is empty.');
  if (file.size > max) throw new UploadError(`The file is larger than ${Math.round(max / MB)} MB.`);
  return Buffer.from(await file.arrayBuffer());
}

/** Partner logos: SVG, PNG or WebP up to 1 MB, checked by content. */
export async function prepareLogo(file: File) {
  const buf = await fileToBuffer(file, LOGO_MAX);
  const kind = sniff(buf);
  if (kind === 'svg') {
    const clean = Buffer.from(sanitiseSvg(buf.toString('utf8')), 'utf8');
    return {
      body: clean,
      ext: 'svg',
      contentType: 'image/svg+xml',
      large: clean.length > LOGO_WARN,
    };
  }
  if (kind === 'png' || kind === 'webp') {
    // Re-encode through sharp: drops metadata and anything appended to the file.
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new UploadError('That image could not be read.');
    const body =
      kind === 'png'
        ? await sharp(buf).png({ compressionLevel: 9 }).toBuffer()
        : await sharp(buf).webp({ quality: 90 }).toBuffer();
    return { body, ext: kind, contentType: `image/${kind}`, large: body.length > LOGO_WARN };
  }
  throw new UploadError('Logos must be SVG, PNG or WebP.');
}

export type Crop = { cx: number; cy: number; zoom: number };

/**
 * Organiser photos: JPG, PNG or WebP up to 2 MB. Auto-rotates, applies the
 * admin's square crop, and writes 600×600 and 1200×800 WebP versions.
 * sharp drops EXIF (incl. GPS location) unless asked to keep it.
 */
export async function preparePhoto(file: File, crop: Crop) {
  const buf = await fileToBuffer(file, PHOTO_MAX);
  const kind = sniff(buf);
  if (kind !== 'jpeg' && kind !== 'png' && kind !== 'webp')
    throw new UploadError('Photos must be JPG, PNG or WebP.');

  const rotated = await sharp(buf).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(rotated).metadata();
  if (!width || !height) throw new UploadError('That image could not be read.');

  const zoom = Math.min(4, Math.max(1, crop.zoom));
  const side = Math.floor(Math.min(width, height) / zoom);
  const left = Math.round(Math.min(width - side, Math.max(0, crop.cx * width - side / 2)));
  const top = Math.round(Math.min(height - side, Math.max(0, crop.cy * height - side / 2)));

  const square = await sharp(rotated)
    .extract({ left, top, width: side, height: side })
    .resize(600, 600)
    .webp({ quality: 82 })
    .toBuffer();
  const wide = await sharp(rotated)
    .resize(1200, 800, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 80 })
    .toBuffer();
  return { square, wide };
}

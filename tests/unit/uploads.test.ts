import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { preparePhoto, sanitiseSvg, sniff, UploadError } from '@/lib/uploads';

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;

describe('sniff', () => {
  it('detects types from bytes, not names', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const jpg = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .jpeg()
      .toBuffer();
    const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .webp()
      .toBuffer();
    expect(sniff(png)).toBe('png');
    expect(sniff(jpg)).toBe('jpeg');
    expect(sniff(webp)).toBe('webp');
    expect(sniff(Buffer.from(svg('<rect/>')))).toBe('svg');
    expect(sniff(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });
});

describe('sanitiseSvg', () => {
  it('keeps plain vector logos', () => {
    expect(
      sanitiseSvg(`<?xml version="1.0"?><!-- c -->${svg('<path d="M0 0h10v10z" fill="#123"/>')}`),
    ).toBe(svg('<path d="M0 0h10v10z" fill="#123"/>'));
  });
  it.each([
    svg('<script>alert(1)</script>'),
    svg('<rect onload="alert(1)"/>'),
    svg('<a href="javascript:alert(1)"><rect/></a>'),
    svg('<image href="https://evil.example/x.png"/>'),
    svg('<foreignObject><div/></foreignObject>'),
    svg('<use href="https://evil.example/s.svg#a"/>'),
    svg('<style>@import url(https://evil.example/x.css)</style>'),
    `<!DOCTYPE svg [<!ENTITY x "y">]>${svg('')}`,
  ])('rejects %s', (input) => {
    expect(() => sanitiseSvg(input)).toThrow(UploadError);
  });
});

describe('preparePhoto', () => {
  it('crops, resizes and strips metadata', async () => {
    const src = await sharp({
      create: { width: 1600, height: 1000, channels: 3, background: '#a33' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } })
      .toBuffer();
    const file = new File([new Uint8Array(src)], 'p.jpg', { type: 'image/jpeg' });
    const { square, wide } = await preparePhoto(file, { cx: 0.5, cy: 0.5, zoom: 1.5 });
    const sq = await sharp(square).metadata();
    const wd = await sharp(wide).metadata();
    expect([sq.width, sq.height, sq.format]).toEqual([600, 600, 'webp']);
    expect([wd.width, wd.height]).toEqual([1200, 800]);
    expect(sq.exif).toBeUndefined();
    expect(wd.exif).toBeUndefined();
  });
  it('rejects non-images', async () => {
    const file = new File(['hello'], 'x.jpg', { type: 'image/jpeg' });
    await expect(preparePhoto(file, { cx: 0.5, cy: 0.5, zoom: 1 })).rejects.toThrow(UploadError);
  });
});

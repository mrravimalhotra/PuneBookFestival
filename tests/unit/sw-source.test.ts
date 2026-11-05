import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '@/lib/sw/source';

describe('service worker source', () => {
  const src = serviceWorkerSource('test-build-123');

  it('is valid JavaScript', () => {
    // Throws a SyntaxError if escaping inside the template literal breaks.
    expect(() => new Function(src)).not.toThrow();
  });

  it('embeds the build id so each deploy ships a new worker', () => {
    expect(src).toContain('"test-build-123"');
    expect(serviceWorkerSource('other')).not.toBe(src);
  });

  it('never caches admin or API responses', () => {
    expect(src).toMatch(/NEVER = \[.*admin.*api/);
  });

  it('extracts static asset URLs from precached HTML', () => {
    const re = new RegExp(src.match(/html\.matchAll\(\/(.+)\/g\)/)![1], 'g');
    const html =
      '<script src="/_next/static/chunks/abc.js" async></script><link href="/_next/static/css/x.css">';
    expect([...html.matchAll(re)].map((m) => m[1])).toEqual([
      '/_next/static/chunks/abc.js',
      '/_next/static/css/x.css',
    ]);
  });
});

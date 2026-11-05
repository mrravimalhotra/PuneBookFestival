import { expect, test } from '@playwright/test';
import { festivalYear, randomMobile, register, venueKey } from './helpers';

test.describe('public journey', () => {
  test('home shows festival details and a register button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText(/\d{4}/);
    await expect(page.getByRole('link', { name: 'Register now' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Pass' }).first()).toBeVisible();
  });

  test('registration validates inline and requires consent', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Mobile number').fill('12345');
    await page.getByLabel('Email').fill('nope');
    await page.getByRole('button', { name: 'Get my pass' }).click();
    await expect(page.getByText('Enter a valid 10-digit Indian mobile number.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Please tick the consent box to register.')).toBeVisible();
    await expect(page.getByText('Pick at least one day.')).toBeVisible();
  });

  test('register → pass with QR, downloads, duplicate handling, My Pass', async ({ page }) => {
    const r = await register(page);
    await expect(page.getByRole('heading', { name: "You're registered!" })).toBeVisible();
    await expect(page.getByRole('img', { name: `QR code for pass ${r.passCode}` })).toBeVisible();
    await expect(page.getByText('Not checked in today')).toBeVisible();
    await expect(page.getByText('Saved on this phone')).toBeVisible();

    const [png] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PNG' }).click(),
    ]);
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF' }).click(),
    ]);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

    // Same mobile + same email -> existing pass, no duplicate.
    await register(page, { mobile: r.mobile, email: r.email });
    await expect(
      page.getByRole('heading', { name: "You're already registered. Here's your pass." }),
    ).toBeVisible();
    await expect(page.locator('p.font-mono').first()).toHaveText(r.passCode);

    // Same mobile, different email -> pass is not revealed.
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Someone Else');
    await page.getByLabel('Mobile number').fill(r.mobile);
    await page.getByLabel('Email').fill('other@example.com');
    await page.getByLabel('Gender').selectOption('male');
    await page.getByLabel('Age').fill('40');
    await page.getByLabel('City').fill('Mumbai');
    await page.locator('input[name="dates"]').first().check();
    await page.getByRole('checkbox', { name: /I agree to the organisers/ }).check();
    await page.getByRole('button', { name: 'Get my pass' }).click();
    await expect(page.getByText('This mobile number already has a pass.')).toBeVisible();

    // My Pass: mobile alone is not enough; mobile + pass code works.
    await page.goto('/my-pass');
    await page.getByLabel('Mobile number').fill(r.mobile);
    await page.getByRole('textbox', { name: 'Pass code' }).fill('PBF-AAAAAA');
    await page.getByRole('button', { name: 'Show my pass' }).click();
    await expect(page.getByText("We couldn't find a pass with those details.")).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Pass code' })
      .fill(r.passCode.replace('PBF-', '').toLowerCase());
    await page.getByRole('button', { name: 'Show my pass' }).click();
    await page.waitForURL(r.passUrl);
  });

  test('forged pass links are rejected', async ({ page }) => {
    await page.goto('/pass/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await expect(page.getByRole('heading', { name: "This pass link isn't valid." })).toBeVisible();
  });

  test('self check-in only works from the venue QR, records once per day', async ({ page }) => {
    const r = await register(page, { mobile: randomMobile() });
    await page.goto('/checkin');
    await expect(page.getByText('Please scan the self check-in poster')).toBeVisible();
    await page.goto('/checkin?k=2026.forged');
    await expect(page.getByText('Please scan the self check-in poster')).toBeVisible();

    const year = await festivalYear(page);
    await page.goto(`/checkin?k=${encodeURIComponent(venueKey(year))}`);
    // The pass was saved on this device, so a one-tap button is offered.
    await page.getByRole('button', { name: /^Check in as/ }).click();
    await expect(page.getByRole('heading', { name: /Welcome!/ })).toBeVisible();
    await expect(page.getByText("You're entered in today's lucky draw.")).toBeVisible();

    await page.goto(`/checkin?k=${encodeURIComponent(venueKey(year))}`);
    await page.getByLabel('Mobile number').fill(r.mobile);
    await page.getByRole('textbox', { name: 'Pass code' }).fill(r.passCode);
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(page.getByRole('heading', { name: /already checked in/ })).toBeVisible();

    await page.goto(r.passUrl);
    await expect(page.getByText(/Checked in today at/)).toBeVisible();
  });

  test('winners page shows only masked data', async ({ page }) => {
    await page.goto('/winners');
    await expect(page.getByRole('heading', { name: 'Lucky draw winners' })).toBeVisible();
    const text = await page.locator('main').textContent();
    expect(text).not.toMatch(/\+91\d{10}|\b[6-9]\d{9}\b/);
    expect(text).not.toMatch(/@/);
  });
});

test.describe('offline pass (PWA)', () => {
  test('the saved pass and its QR open with no network', async ({ page, context }) => {
    const r = await register(page, { mobile: randomMobile() });
    // Wait for the service worker to install (precache) and control the page.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, {
      timeout: 20_000,
    });
    await page.waitForFunction(
      async () =>
        (await caches.keys()).some((k) => k.startsWith('pbf-shell-')) &&
        Boolean(await caches.match('/saved-pass')),
      undefined,
      { timeout: 20_000 },
    );
    await context.setOffline(true);
    await page.goto('/saved-pass');
    await expect(page.getByRole('img', { name: `QR code for pass ${r.passCode}` })).toBeVisible();
    await expect(page.getByText(r.passCode)).toBeVisible();
    // Opening the pass link itself while offline falls back to the saved pass.
    await page.goto(r.passUrl);
    await expect(page.getByRole('img', { name: `QR code for pass ${r.passCode}` })).toBeVisible();
    await context.setOffline(false);
  });

  test('manifest and service worker are served', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    const sw = await request.get('/sw.js');
    expect(sw.headers()['cache-control']).toContain('no-store');
    expect(await sw.text()).toContain('pbf-checkins');
  });
});

test('security headers are set', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  const scan = await request.get('/staff/scan', { maxRedirects: 0 });
  expect([200, 302, 307]).toContain(scan.status());
});

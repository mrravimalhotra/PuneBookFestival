import { expect, test } from '@playwright/test';
import { loginAsAdmin, randomMobile, register } from './helpers';

test.describe('staff and admin', () => {
  test('protected pages redirect to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/staff\/login\?next=/);
    await page.goto('/staff/scan');
    await expect(page).toHaveURL(/\/staff\/login\?next=/);
  });

  test('anonymous calls to the staff API are refused', async ({ request, baseURL }) => {
    const res = await request.post('/api/staff/checkins', {
      headers: { origin: baseURL! },
      data: {
        items: [
          { clientRef: 'abcdefgh-1', token: 'x'.repeat(39), scannedAt: new Date().toISOString() },
        ],
      },
    });
    expect(res.status()).toBe(401);
  });

  test('gate scan checks in once; a second scan says already checked in', async ({
    page,
    baseURL,
  }) => {
    const r = await register(page, { mobile: randomMobile(), name: 'Gate Tester' });
    const token = r.passUrl.split('/pass/')[1];
    await loginAsAdmin(page);
    await page.goto('/staff/scan');
    await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible();

    const post = (clientRef: string) =>
      page.request.post('/api/staff/checkins', {
        headers: { origin: baseURL! },
        data: { items: [{ clientRef, token: r.passUrl, scannedAt: new Date().toISOString() }] },
      });
    // The scanner sends the token extracted from the QR; the API also accepts it directly.
    const first = await page.request.post('/api/staff/checkins', {
      headers: { origin: baseURL! },
      data: {
        items: [{ clientRef: `ref-${Date.now()}-a`, token, scannedAt: new Date().toISOString() }],
      },
    });
    const a = await first.json();
    expect(a.results[0]).toMatchObject({ status: 'checked_in', name: 'Gate Tester', final: true });

    const replay = await page.request.post('/api/staff/checkins', {
      headers: { origin: baseURL! },
      data: {
        items: [{ clientRef: `ref-${Date.now()}-b`, token, scannedAt: new Date().toISOString() }],
      },
    });
    const b = await replay.json();
    expect(b.results[0].status).toBe('already');
    expect(b.results[0].checkinAt).toBeTruthy();

    const bad = await (await post(`ref-${Date.now()}-c`)).json();
    expect(bad.results[0].status).toBe('invalid'); // a full URL is not a bare token

    // Manual search by pass code.
    await page.getByPlaceholder('Pass code or mobile number').fill(r.passCode);
    await page.getByRole('button', { name: 'Find' }).click();
    await expect(page.getByText('Gate Tester')).toBeVisible();
    await expect(page.getByText(/Checked in today at/)).toBeVisible();
  });

  test('offline scans queued on the device sync once, without double counting', async ({
    page,
    baseURL,
  }) => {
    const r = await register(page, { mobile: randomMobile(), name: 'Queue Tester' });
    const token = r.passUrl.split('/pass/')[1];
    await loginAsAdmin(page);
    await page.goto('/staff/scan');
    // Simulate two scans of the same pass made while the network was down.
    await page.evaluate(async (tok) => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const req = indexedDB.open('pbf-scanner', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'clientRef' });
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      await new Promise<void>((res) => {
        const tx = db.transaction('queue', 'readwrite');
        const at = new Date().toISOString();
        tx.objectStore('queue').put({
          clientRef: `offline-${Date.now()}-1`,
          token: tok,
          scannedAt: at,
        });
        tx.objectStore('queue').put({
          clientRef: `offline-${Date.now()}-2`,
          token: tok,
          scannedAt: at,
        });
        tx.oncomplete = () => res();
      });
    }, token);
    await page.reload();
    const pending = page.getByRole('button', { name: /2 scan\(s\) waiting to sync/ });
    await expect(pending).toBeVisible();
    await pending.click();
    await expect(pending).toBeHidden({ timeout: 10_000 });

    const check = await page.request.post('/api/staff/checkins', {
      headers: { origin: baseURL! },
      data: {
        items: [{ clientRef: `ref-${Date.now()}-z`, token, scannedAt: new Date().toISOString() }],
      },
    });
    expect((await check.json()).results[0].status).toBe('already');
  });

  test('admin dashboard, draw, winners and reports', async ({ page }) => {
    test.setTimeout(300_000); // ten full exports; slower on large datasets
    // Make sure someone is checked in today.
    await register(page, { mobile: randomMobile(), name: 'Draw Candidate' });
    await loginAsAdmin(page);
    await expect(page.getByText('Total registrations')).toBeVisible();

    await page.goto('/admin/draw');
    const select = page.getByRole('combobox', { name: 'Date' });
    await expect(select).toBeVisible();

    for (const report of ['attendees', 'daily', 'checkins', 'demographics', 'winners']) {
      for (const format of ['xlsx', 'pdf'] as const) {
        const res = await page.request.get(`/api/admin/reports/${report}?format=${format}`, {
          timeout: 120_000,
        });
        expect(res.status(), `${report}.${format}`).toBe(200);
        const body = await res.body();
        expect(body.subarray(0, format === 'pdf' ? 4 : 2).toString()).toBe(
          format === 'pdf' ? '%PDF' : 'PK',
        );
      }
    }
    const poster = await page.request.get('/api/admin/venue-qr');
    expect(poster.headers()['content-type']).toBe('application/pdf');
  });
});

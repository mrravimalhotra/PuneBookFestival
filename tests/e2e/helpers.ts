import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** Mirrors lib/tokens.ts signVenueKey (lib/tokens imports server-only). */
export function venueKey(year: number): string {
  const secret = process.env.SELF_CHECKIN_SECRET;
  if (!secret) throw new Error('SELF_CHECKIN_SECRET must be set for e2e tests');
  const mac = createHmac('sha256', secret)
    .update(`self-checkin:v1:${year}`)
    .digest()
    .subarray(0, 18)
    .toString('base64url');
  return `${year}.${mac}`;
}

/** Random valid Indian mobile so runs never collide. */
export function randomMobile(): string {
  return `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
}

export type Registered = {
  mobile: string;
  email: string;
  passCode: string;
  passUrl: string;
  name: string;
};

export async function register(
  page: Page,
  opts: Partial<{ name: string; mobile: string; email: string }> = {},
): Promise<Registered> {
  const mobile = opts.mobile ?? randomMobile();
  const email = opts.email ?? `e2e+${mobile}@example.com`;
  const name = opts.name ?? 'Asha Kulkarni';
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Gender').selectOption('female');
  await page.getByLabel('Age').fill('29');
  await page.getByLabel('City').fill('Pune');
  const days = page.locator('input[name="dates"]');
  await days.nth(0).check();
  if ((await days.count()) > 1) await days.nth(1).check();
  await page.getByRole('checkbox', { name: /I agree to the organisers/ }).check();
  await page.getByRole('button', { name: 'Get my pass' }).click();
  await page.waitForURL(/\/pass\/[A-Za-z0-9_-]+/);
  const passCode = (await page.locator('p.font-mono').first().textContent())?.trim() ?? '';
  expect(passCode).toMatch(/^PBF-[A-HJ-NP-Z2-9]{6}$/);
  return { mobile, email, passCode, passUrl: page.url().split('?')[0], name };
}

export async function loginAsAdmin(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  await page.goto('/staff/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin\/dashboard/);
}

export async function festivalYear(page: Page): Promise<number> {
  await page.goto('/');
  const h1 = await page.locator('h1').first().textContent();
  return Number(h1?.match(/(\d{4})/)?.[1]);
}

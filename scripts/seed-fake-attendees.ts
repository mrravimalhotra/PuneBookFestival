/**
 * Generates realistic FAKE attendees for testing reports and the dashboard.
 *   pnpm seed:fake            # 500 attendees
 *   pnpm seed:fake -- 2000    # custom count
 * Never run against production. Refuses unless SEED_FAKE_CONFIRM=yes or the
 * Supabase URL is local.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import type { Database } from '../lib/supabase/database.types';

loadEnvConfig(process.cwd());

const FIRST = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Sai',
  'Arjun',
  'Ishaan',
  'Ananya',
  'Diya',
  'Saanvi',
  'Aadhya',
  'Ira',
  'Meera',
  'Kavya',
  'Rohan',
  'Neha',
  'Pooja',
  'Sneha',
  'Rahul',
  'Amit',
  'Priya',
  'Vikram',
  'Sunita',
  'Mangesh',
  'Shruti',
  'Omkar',
  'Tanvi',
  'Yash',
  'Gauri',
  'Siddharth',
  'Rutuja',
];
const LAST = [
  'Kulkarni',
  'Deshpande',
  'Joshi',
  'Patil',
  'Jadhav',
  'Pawar',
  'Shinde',
  'Gokhale',
  'Bhide',
  'Kale',
  'More',
  'Sharma',
  'Iyer',
  'Nair',
  'Khan',
  'Fernandes',
  'Mehta',
  'Shah',
];
const CITIES: Array<[string, string[]]> = [
  [
    'Pune',
    [
      'Kothrud',
      'Deccan',
      'Shivajinagar',
      'Aundh',
      'Baner',
      'Hadapsar',
      'Kharadi',
      'Viman Nagar',
      'Sadashiv Peth',
      'Wakad',
    ],
  ],
  ['Pimpri-Chinchwad', ['Akurdi', 'Nigdi', 'Pimple Saudagar']],
  ['Mumbai', ['Dadar', 'Andheri', 'Thane']],
  ['Nashik', ['']],
  ['Satara', ['']],
  ['Kolhapur', ['']],
];
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function age(): number {
  const r = Math.random();
  if (r < 0.12) return 6 + Math.floor(Math.random() * 7);
  if (r < 0.25) return 13 + Math.floor(Math.random() * 5);
  if (r < 0.5) return 18 + Math.floor(Math.random() * 7);
  if (r < 0.7) return 25 + Math.floor(Math.random() * 10);
  if (r < 0.82) return 35 + Math.floor(Math.random() * 10);
  if (r < 0.93) return 45 + Math.floor(Math.random() * 15);
  return 60 + Math.floor(Math.random() * 25);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const local = /127\.0\.0\.1|localhost/.test(url);
  if (!local && process.env.SEED_FAKE_CONFIRM !== 'yes') {
    throw new Error(
      'Refusing to seed fake data into a non-local project. Set SEED_FAKE_CONFIRM=yes to override.',
    );
  }
  const count = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 500);
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data: days } = await supabase
    .from('festival_days')
    .select('festival_date')
    .eq('is_active', true)
    .order('festival_date');
  const dates = (days ?? []).map((d) => d.festival_date);
  if (!dates.length) throw new Error('No festival days configured.');

  let created = 0;
  let checkins = 0;
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST);
    const [city, areas] = pick(CITIES);
    const chosen = dates.filter(() => Math.random() < 0.35);
    if (!chosen.length) chosen.push(pick(dates));
    const mobile = `${pick(['7', '8', '9'])}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const { data, error } = await supabase.rpc('register_attendee', {
      p_full_name: `${first} ${pick(LAST)}`,
      p_mobile: mobile,
      p_email: `${first.toLowerCase()}.${mobile.slice(-4)}@example.com`,
      p_gender: pick(GENDERS),
      p_age: age(),
      p_city: city,
      p_area: pick(areas),
      p_dates: chosen,
      p_consent: true,
      p_consent_version: 'v1',
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (row?.status !== 'created') continue;
    created++;
    // Roughly 60% of registrants turn up on today's date (for draw testing).
    if (Math.random() < 0.6) {
      await supabase.rpc('checkin', { p_attendee_id: row.attendee_id, p_method: 'self' });
      checkins++;
    }
    if (created % 100 === 0) console.log(`${created} attendees…`);
  }
  console.log(`✔ Created ${created} fake attendees and ${checkins} self check-ins (today).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Registration load test (k6) through the real app (Server Action path is not
 * scriptable, so this hits the registration RPC on a STAGING project).
 *   k6 run -e SUPABASE_URL=... -e SERVICE_KEY=... loadtest/k6-register.js
 * 100,000 registrations at ~100/s ≈ 17 minutes.
 */
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    signups: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: Number(__ENV.TOTAL || 100000),
      maxDuration: '40m',
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] },
};

const DATES = (__ENV.DATES || '2026-12-12,2026-12-13').split(',');

export default function () {
  const n = (__VU * 1_000_000 + __ITER) % 1_000_000_000;
  const mobile = `9${String(n).padStart(9, '0')}`;
  const res = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/register_attendee`,
    JSON.stringify({
      p_full_name: `Load Test ${n}`,
      p_mobile: mobile,
      p_email: `load${n}@example.com`,
      p_gender: 'prefer_not_to_say',
      p_age: 30,
      p_city: 'Pune',
      p_area: '',
      p_dates: [DATES[n % DATES.length]],
      p_consent: true,
      p_consent_version: 'v1',
    }),
    {
      headers: {
        apikey: __ENV.SERVICE_KEY,
        Authorization: `Bearer ${__ENV.SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}

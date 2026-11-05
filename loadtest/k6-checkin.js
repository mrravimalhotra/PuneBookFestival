/**
 * Gate-peak load test (k6). Targets: ~50 check-ins/second, p95 < 300 ms.
 *
 * Exercises the check-in RPC directly against a STAGING Supabase project
 * (never production), the same single round trip the staff API makes.
 *
 *   k6 run -e SUPABASE_URL=... -e SERVICE_KEY=... -e ATTENDEE_IDS=ids.txt loadtest/k6-checkin.js
 *
 * ids.txt: one attendee uuid per line, e.g. exported after `pnpm seed:fake 100000`
 *   psql "$DB_URL" -Atc "select id from attendees" > ids.txt
 * Self check-ins are used because they need no staff session; the database
 * work (insert ... on conflict do nothing + lookup) is identical.
 */
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const ids = new SharedArray('ids', () =>
  open(__ENV.ATTENDEE_IDS || 'ids.txt')
    .split('\n')
    .filter(Boolean),
);

export const options = {
  scenarios: {
    gate_peak: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 50),
      timeUnit: '1s',
      duration: __ENV.DURATION || '5m',
      preAllocatedVUs: 100,
      maxVUs: 400,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const id = ids[Math.floor(Math.random() * ids.length)];
  const res = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/checkin`,
    JSON.stringify({ p_attendee_id: id, p_method: 'self' }),
    {
      headers: {
        apikey: __ENV.SERVICE_KEY,
        Authorization: `Bearer ${__ENV.SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );
  check(res, {
    'status 200': (r) => r.status === 200,
    'checked in or already': (r) => /checked_in|already/.test(r.body),
  });
}

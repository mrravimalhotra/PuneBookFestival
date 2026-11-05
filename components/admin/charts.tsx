'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Validated categorical slots (blue, orange) — see the dataviz palette check.
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';
const GRID = '#e7e5e4';
const INK_MUTED = '#57534e';

type Point = { label: string; [k: string]: string | number };

function ChartFrame({
  title,
  children,
  table,
}: {
  title: string;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  return (
    <figure className="rounded-card border-line border bg-[#fcfcfb] p-4">
      <figcaption className="mb-3 font-bold">{title}</figcaption>
      <div className="h-64 w-full">{children}</div>
      <details className="mt-3 text-sm">
        <summary className="text-brand-700 min-h-11 cursor-pointer py-2 font-semibold">
          Show as table
        </summary>
        {table}
      </details>
    </figure>
  );
}

function DataTable({ rows, cols }: { rows: Point[]; cols: Array<[string, string]> }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            {cols.map(([, h]) => (
              <th key={h} scope="col" className="border-line border-b py-1 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.label)}>
              {cols.map(([k]) => (
                <td key={k} className="border-line border-b py-1 pr-3 tabular-nums">
                  {r[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const axis = { stroke: GRID, tick: { fill: INK_MUTED, fontSize: 12 }, tickLine: false } as const;

/** Single series: registrations per signup day. */
export function RegistrationsChart({ data }: { data: Point[] }) {
  return (
    <ChartFrame
      title="Registrations per day"
      table={
        <DataTable
          rows={data}
          cols={[
            ['label', 'Day'],
            ['registrations', 'Registrations'],
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar
            dataKey="registrations"
            name="Registrations"
            fill={SERIES_1}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Two series on one axis: expected footfall vs actual check-ins per festival day. */
export function FootfallChart({ data }: { data: Point[] }) {
  return (
    <ChartFrame
      title="Expected footfall vs actual check-ins"
      table={
        <DataTable
          rows={data}
          cols={[
            ['label', 'Day'],
            ['expected', 'Expected'],
            ['actual', 'Actual'],
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend wrapperStyle={{ fontSize: 13, color: INK_MUTED }} />
          <Bar
            dataKey="expected"
            name="Expected"
            fill={SERIES_1}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="actual"
            name="Actual"
            fill={SERIES_2}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

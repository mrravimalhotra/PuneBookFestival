/** Horizontal magnitude bars in plain HTML: label, bar, value (text in ink, not series colour). */
export function BarList({
  title,
  rows,
  valueLabel = 'Registered',
}: {
  title: string;
  rows: Array<{ label: string; value: number; secondary?: number }>;
  valueLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="rounded-card border-line border bg-[#fcfcfb] p-4">
      <figcaption className="mb-3 font-bold">{title}</figcaption>
      {rows.length === 0 ? <p className="text-muted">No data yet.</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate" title={r.label}>
              {r.label}
            </span>
            <span className="h-3 rounded-r bg-stone-100" aria-hidden="true">
              <span
                className="block h-3 rounded-r-[4px] bg-[#2a78d6]"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {r.value.toLocaleString('en-IN')}
              {r.secondary !== undefined ? (
                <span className="text-muted"> · {r.secondary.toLocaleString('en-IN')} came</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{valueLabel}</p>
    </figure>
  );
}

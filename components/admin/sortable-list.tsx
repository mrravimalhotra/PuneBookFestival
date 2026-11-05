'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/result';

/**
 * Drag to reorder (pointer) plus up/down buttons (keyboard and touch).
 * Saves the new order through the given server action.
 */
export function SortableList<T extends { id: string }>({
  items,
  render,
  onReorder,
  label,
}: {
  items: T[];
  render: (item: T) => React.ReactNode;
  onReorder: (ids: string[]) => Promise<ActionResult>;
  label: string;
}) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [, startTransition] = useTransition();
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = [
    ...order.filter((id) => byId.has(id)),
    ...items.map((i) => i.id).filter((id) => !order.includes(id)),
  ];

  const commit = (next: string[]) => {
    setOrder(next);
    startTransition(async () => {
      const res = await onReorder(next);
      setStatus(res.ok ? 'Order saved.' : res.error);
    });
  };
  const move = (id: string, delta: number) => {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div>
      <ul
        aria-label={label}
        className="divide-line rounded-card border-line divide-y border bg-white"
      >
        {ids.map((id, idx) => {
          const item = byId.get(id)!;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragId || dragId === id) return;
                const next = ids.filter((x) => x !== dragId);
                next.splice(next.indexOf(id), 0, dragId);
                setDragId(null);
                commit(next);
              }}
              className={`flex items-start gap-2 p-3 ${dragId === id ? 'opacity-50' : ''}`}
            >
              <GripVertical
                aria-hidden="true"
                className="text-muted mt-2 size-5 shrink-0 cursor-grab"
              />
              <div className="min-w-0 flex-1">{render(item)}</div>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded hover:bg-stone-100 disabled:opacity-30"
                  onClick={() => move(id, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded hover:bg-stone-100 disabled:opacity-30"
                  onClick={() => move(id, 1)}
                  disabled={idx === ids.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p role="status" className="text-muted mt-2 text-sm">
        {status}
      </p>
    </div>
  );
}

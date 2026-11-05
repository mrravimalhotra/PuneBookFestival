'use client';

import { publishDrawAction, runDrawAction } from '@/app/admin/draw/actions';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { formatDay } from '@/lib/format';
import { ActionForm } from './action-form';

export function RunDrawForm({
  days,
  defaultDate,
}: {
  days: Array<{ date: string; eligible: number; done: boolean }>;
  defaultDate: string;
}) {
  return (
    <ActionForm action={runDrawAction} className="space-y-3">
      {(pending) => (
        <>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Date</span>
            <Select name="date" defaultValue={defaultDate}>
              {days.map((d) => (
                <option key={d.date} value={d.date} disabled={d.done}>
                  {formatDay(d.date)} — {d.done ? 'already drawn' : `${d.eligible} eligible`}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm" className="mt-1 size-5" />
            <span>I understand the draw runs once for this date and cannot be undone.</span>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? 'Drawing…' : 'Run draw'}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function PublishForm({
  id,
  published,
  prize,
}: {
  id: number;
  published: boolean;
  prize: string | null;
}) {
  return (
    <ActionForm action={publishDrawAction} className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="publish" value={published ? 'false' : 'true'} />
          {!published ? (
            <label className="min-w-56 flex-1">
              <span className="mb-1 block text-sm font-semibold">Prize note (optional)</span>
              <Input name="prize" defaultValue={prize ?? ''} placeholder="e.g. Book hamper" />
            </label>
          ) : null}
          <Button type="submit" variant={published ? 'outline' : 'primary'} disabled={pending}>
            {published ? 'Unpublish' : 'Publish to /winners'}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

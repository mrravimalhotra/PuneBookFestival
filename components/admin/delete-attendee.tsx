'use client';

import { useActionState } from 'react';
import { deleteAttendeeAction } from '@/app/admin/attendees/actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';

export function DeleteAttendee({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteAttendeeAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field
        id="confirm"
        label="Type DELETE to permanently remove this attendee and their check-ins"
      >
        <Input id="confirm" name="confirm" autoComplete="off" />
      </Field>
      <Button type="submit" variant="danger" disabled={pending}>
        Delete attendee
      </Button>
    </form>
  );
}

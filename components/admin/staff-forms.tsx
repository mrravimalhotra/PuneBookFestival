'use client';

import {
  createStaffAction,
  resetStaffPasswordAction,
  setStaffActiveAction,
} from '@/app/admin/staff/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ActionForm } from './action-form';

export function CreateStaffForm() {
  return (
    <ActionForm action={createStaffAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      {(pending) => (
        <>
          <label>
            <span className="mb-1 block text-sm font-semibold">Full name</span>
            <Input name="full_name" required />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Email</span>
            <Input name="email" type="email" required autoComplete="off" />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Temporary password</span>
            <Input
              name="password"
              type="text"
              minLength={10}
              required
              autoComplete="new-password"
            />
          </label>
          <Button type="submit" disabled={pending}>
            Add staff
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function StaffRowActions({
  id,
  active,
  self,
}: {
  id: string;
  active: boolean;
  self: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {!self ? (
        <ActionForm action={setStaffActiveAction}>
          {(pending) => (
            <>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={active ? 'false' : 'true'} />
              <Button
                type="submit"
                size="sm"
                variant={active ? 'outline' : 'primary'}
                disabled={pending}
              >
                {active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}
      <ActionForm action={resetStaffPasswordAction} className="flex gap-2">
        {(pending) => (
          <>
            <input type="hidden" name="id" value={id} />
            <label>
              <span className="sr-only">New password</span>
              <Input
                name="password"
                type="text"
                placeholder="New password"
                className="min-h-9 w-40 text-sm"
                autoComplete="new-password"
              />
            </label>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Reset
            </Button>
          </>
        )}
      </ActionForm>
    </div>
  );
}

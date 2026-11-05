'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/result';
import { Alert } from '@/components/ui/card';

/** Small wrapper: a <form> bound to a server action with result messages. */
export function ActionForm<T>({
  action,
  children,
  className,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult<T>>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {state ? (
        <Alert tone={state.ok ? 'success' : 'danger'} className="mb-3">
          {state.ok ? (state.message ?? 'Saved.') : state.error}
        </Alert>
      ) : null}
      {children(pending)}
    </form>
  );
}

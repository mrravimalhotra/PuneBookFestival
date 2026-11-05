'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/staff/actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { t, tError } from '@/lib/i18n';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-5">
      {state && !state.ok ? <Alert tone="danger">{tError(state.error)}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="email" label={t('staff.email')}>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field id="password" label={t('staff.password')}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
        {pending ? t('staff.signingIn') : t('staff.signIn')}
      </Button>
    </form>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { findPassAction } from '@/app/(public)/my-pass/actions';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input, describedBy } from '@/components/ui/field';
import { t, tError } from '@/lib/i18n';
import { useSavedPassHint } from '@/lib/pass-store';

export function MyPassForm() {
  const router = useRouter();
  const [method, setMethod] = useState<'code' | 'email'>('code');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const saved = useSavedPassHint();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      mobile: String(fd.get('mobile') ?? ''),
      method,
      passCode: String(fd.get('passCode') ?? ''),
      email: String(fd.get('email') ?? ''),
      website: String(fd.get('website') ?? ''),
    };
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await findPassAction(input);
      if (res.ok) router.push(res.data.redirectTo);
      else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <div className="space-y-6">
      {saved ? (
        <LinkButton href="/saved-pass" variant="accent" block size="lg">
          {t('myPass.savedPass')}
        </LinkButton>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error ? <Alert tone="danger">{tError(error)}</Alert> : null}
        <Field
          id="mobile"
          label={t('register.mobile')}
          hint={t('register.mobileHint')}
          error={tError(fieldErrors.mobile)}
        >
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            aria-invalid={Boolean(fieldErrors.mobile)}
            aria-describedby={describedBy('mobile', true)}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('myPass.method')}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['code', 'email'] as const).map((m) => (
              <label
                key={m}
                className="has-checked:border-brand-600 has-checked:bg-brand-50 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white font-semibold"
              >
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="accent-brand-600 size-4"
                />
                {m === 'code' ? t('myPass.useCode') : t('myPass.useEmail')}
              </label>
            ))}
          </div>
        </fieldset>

        {method === 'code' ? (
          <Field
            id="passCode"
            label={t('myPass.passCode')}
            hint={t('myPass.passCodeHint')}
            error={tError(fieldErrors.passCode)}
          >
            <Input
              id="passCode"
              name="passCode"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
              aria-invalid={Boolean(fieldErrors.passCode)}
              aria-describedby={describedBy('passCode', true)}
            />
          </Field>
        ) : (
          <Field id="email" label={t('myPass.email')} error={tError(fieldErrors.email)}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={describedBy('email', false)}
            />
          </Field>
        )}

        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">{t('register.honeypot')}</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
          {pending ? t('myPass.submitting') : t('myPass.submit')}
        </Button>
      </form>
    </div>
  );
}

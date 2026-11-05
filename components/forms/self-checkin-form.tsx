'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { selfCheckinAction, type SelfCheckinOutcome } from '@/app/(public)/checkin/actions';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { Field, Input, describedBy } from '@/components/ui/field';
import { formatClock } from '@/lib/format';
import { t, tError } from '@/lib/i18n';
import { useSavedPassHint } from '@/lib/pass-store';

export function SelfCheckinForm({
  venueKey,
  successExtras,
}: {
  venueKey: string;
  successExtras?: React.ReactNode;
}) {
  const saved = useSavedPassHint();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SelfCheckinOutcome | null>(null);

  function submit(input: Record<string, string>) {
    setError(null);
    startTransition(async () => {
      const res = await selfCheckinAction({ key: venueKey, ...input });
      if (res.ok) {
        setResult(res.data);
        if ('vibrate' in navigator) navigator.vibrate?.(80);
      } else setError(res.error);
    });
  }

  if (result) {
    const fresh = result.status === 'checked_in';
    return (
      <div className="space-y-6" aria-live="polite">
        <Card
          className={
            fresh
              ? 'border-success-600/40 bg-success-50 text-center'
              : 'border-warning-500/50 bg-warning-50 text-center'
          }
        >
          <CheckCircle2
            aria-hidden="true"
            className={`mx-auto size-16 ${fresh ? 'text-success-600' : 'text-warning-800'}`}
          />
          <h2 className="mt-2 text-3xl font-bold">
            {fresh ? t('checkin.successTitle') : t('checkin.alreadyTitle')}
            {result.firstName ? ` ${result.firstName}` : ''}
          </h2>
          <p className="mt-2 text-lg">
            {fresh
              ? t('checkin.successText')
              : t('checkin.alreadyText', { time: formatClock(result.checkinAt) })}
          </p>
        </Card>
        {successExtras}
        <LinkButton href={result.passPath} variant="secondary" block>
          {t('checkin.viewPass')}
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Alert tone="danger">{tError(error)}</Alert> : null}
      {saved ? (
        <div className="space-y-2">
          <Button
            size="lg"
            block
            disabled={pending}
            onClick={() => submit({ kind: 'token', token: saved.token })}
          >
            {pending
              ? t('checkin.submitting')
              : t('checkin.useSaved', { name: saved.name.split(/\s+/)[0] ?? '' })}
          </Button>
          <p className="text-muted text-center text-sm">{t('checkin.savedHint')}</p>
          <p className="pt-2 text-center text-sm font-semibold">{t('checkin.orDetails')}</p>
        </div>
      ) : null}
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          submit({
            kind: 'details',
            mobile: String(fd.get('mobile') ?? ''),
            passCode: String(fd.get('passCode') ?? ''),
            website: String(fd.get('website') ?? ''),
          });
        }}
      >
        <Field id="mobile" label={t('checkin.mobile')} hint={t('register.mobileHint')}>
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            aria-describedby={describedBy('mobile', true)}
          />
        </Field>
        <Field id="passCode" label={t('checkin.passCode')} hint={t('myPass.passCodeHint')}>
          <Input
            id="passCode"
            name="passCode"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            required
            aria-describedby={describedBy('passCode', true)}
          />
        </Field>
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">{t('register.honeypot')}</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <Button
          type="submit"
          size="lg"
          block
          variant={saved ? 'secondary' : 'primary'}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? t('checkin.submitting') : t('checkin.submit')}
        </Button>
      </form>
    </div>
  );
}

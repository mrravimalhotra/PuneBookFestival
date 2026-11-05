'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { registerAction } from '@/app/(public)/register/actions';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, FieldError, Input, Select, describedBy } from '@/components/ui/field';
import { formatDay } from '@/lib/format';
import { t, tError } from '@/lib/i18n';
import {
  GENDERS,
  registerSchema,
  type RegisterData,
  type RegisterInput,
} from '@/lib/validation/register';

/**
 * Values typed before hydration (slow phones) would be wiped when React Hook
 * Form attaches. Read them from the server-rendered DOM on the first client
 * render and use them as defaults so nothing the visitor typed is lost.
 */
function readPrehydrationValues(): Partial<RegisterInput> {
  if (typeof document === 'undefined') return {};
  const form = document.getElementById('register-form') as HTMLFormElement | null;
  if (!form) return {};
  const out: Record<string, unknown> = {};
  for (const name of ['fullName', 'mobile', 'email', 'gender', 'age', 'city', 'area'] as const) {
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el && 'value' in el && el.value) out[name] = el.value;
  }
  const dates = [...form.querySelectorAll<HTMLInputElement>('input[name="dates"]:checked')].map(
    (i) => i.value,
  );
  if (dates.length) out.dates = dates;
  const consent = form.elements.namedItem('consent') as HTMLInputElement | null;
  if (consent?.checked) out.consent = true;
  return out as Partial<RegisterInput>;
}

export function RegisterForm({ days }: { days: string[] }) {
  const [prehydration] = useState(readPrehydrationValues);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { dates: days.length === 1 ? days : [], area: '', website: '', ...prehydration },
  });

  const chosen = useWatch({ control, name: 'dates' }) ?? [];

  const onSubmit = (values: RegisterData) => {
    setFormError(null);
    setAlready(false);
    startTransition(async () => {
      const res = await registerAction(values);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [field, message] of Object.entries(res.fieldErrors)) {
            setError(field as keyof RegisterInput, { message });
          }
        }
        setFormError(res.error);
        return;
      }
      if ('alreadyRegistered' in res.data) {
        setAlready(true);
        return;
      }
      router.replace(res.data.redirectTo);
    });
  };

  const err = (name: keyof RegisterInput) => tError(errors[name]?.message as string | undefined);

  return (
    <form
      id="register-form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-describedby={formError ? 'form-error' : undefined}
    >
      {already ? (
        <Alert tone="warning">
          <p className="font-bold">{t('register.alreadyRegistered')}</p>
          <p className="mt-1">{t('register.alreadyRegisteredText')}</p>
          <LinkButton href="/my-pass" size="sm" className="mt-3">
            {t('home.findPass')}
          </LinkButton>
        </Alert>
      ) : null}
      {formError && !already ? (
        <Alert tone="danger" id="form-error">
          {tError(formError)}
        </Alert>
      ) : null}

      <Field id="fullName" label={t('register.fullName')} error={err('fullName')}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describedBy('fullName', false)}
          {...register('fullName')}
        />
      </Field>

      <Field
        id="mobile"
        label={t('register.mobile')}
        hint={t('register.mobileHint')}
        error={err('mobile')}
      >
        <div className="flex">
          <span className="text-muted inline-flex min-h-11 items-center rounded-l-lg border border-r-0 border-stone-400 bg-stone-100 px-3">
            +91
          </span>
          <Input
            id="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            className="rounded-l-none"
            aria-invalid={Boolean(errors.mobile)}
            aria-describedby={describedBy('mobile', true)}
            {...register('mobile')}
          />
        </div>
      </Field>

      <Field id="email" label={t('register.email')} error={err('email')}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy('email', false)}
          {...register('email')}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="gender" label={t('register.gender')} error={err('gender')}>
          <Select
            id="gender"
            defaultValue=""
            aria-invalid={Boolean(errors.gender)}
            aria-describedby={describedBy('gender', false)}
            {...register('gender')}
          >
            <option value="" disabled>
              {t('register.genderPlaceholder')}
            </option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`register.genderOptions.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="age" label={t('register.age')} error={err('age')}>
          <Input
            id="age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            aria-invalid={Boolean(errors.age)}
            aria-describedby={describedBy('age', false)}
            {...register('age')}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="city" label={t('register.city')} error={err('city')}>
          <Input
            id="city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={describedBy('city', false)}
            {...register('city')}
          />
        </Field>
        <Field
          id="area"
          label={t('register.area')}
          optional
          optionalLabel={t('common.optional')}
          error={err('area')}
        >
          <Input
            id="area"
            autoComplete="address-level3"
            aria-describedby={describedBy('area', false)}
            {...register('area')}
          />
        </Field>
      </div>

      <fieldset aria-describedby="dates-hint dates-error" aria-invalid={Boolean(errors.dates)}>
        <legend className="mb-1 text-sm font-semibold">{t('register.dates')}</legend>
        <p id="dates-hint" className="text-muted mb-3 text-sm">
          {t('register.datesHint')}
        </p>
        {days.length === 0 ? <p className="text-muted">{t('register.noDays')}</p> : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {days.map((d) => (
            <label
              key={d}
              className="has-checked:border-brand-600 has-checked:bg-brand-50 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-stone-300 bg-white px-3"
            >
              <input
                type="checkbox"
                value={d}
                className="accent-brand-600 size-5"
                {...register('dates')}
              />
              <span className="font-semibold">{formatDay(d)}</span>
            </label>
          ))}
        </div>
        {days.length > 1 ? (
          <button
            type="button"
            className="text-brand-700 mt-2 min-h-11 text-sm font-semibold underline underline-offset-4"
            onClick={() =>
              setValue('dates', chosen.length === days.length ? [] : days, { shouldValidate: true })
            }
          >
            {t('register.selectAll')}
          </button>
        ) : null}
        <FieldError id="dates-error" message={err('dates')} />
      </fieldset>

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">{t('register.honeypot')}</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 bg-white p-4">
          <input
            type="checkbox"
            className="accent-brand-600 mt-1 size-5 shrink-0"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby="consent-error"
            {...register('consent')}
          />
          <span>
            {t('register.consentLabel')}{' '}
            <Link
              href="/privacy"
              className="text-brand-700 font-semibold underline underline-offset-4"
              target="_blank"
            >
              {t('register.consentPrivacy')}
            </Link>
          </span>
        </label>
        <FieldError id="consent-error" message={err('consent')} />
      </div>

      <Button
        type="submit"
        size="lg"
        block
        disabled={pending || days.length === 0}
        aria-busy={pending}
      >
        {pending ? t('register.submitting') : t('register.submit')}
      </Button>
    </form>
  );
}

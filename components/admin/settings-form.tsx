'use client';

import { saveSettingsAction } from '@/app/admin/settings/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { ActionForm } from './action-form';

export type SettingsValues = {
  festival_name: string;
  festival_year: number;
  venue: string;
  start_date: string;
  end_date: string;
  daily_open_time: string;
  daily_close_time: string;
  registration_open: boolean;
  self_checkin_enabled: boolean;
  draw_winners_per_day: number;
  staff_limit: number;
  consent_text_version: string;
  privacy_text: string;
  contact_email: string | null;
};

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-muted mt-1 block text-sm">{hint}</span> : null}
    </label>
  );
}

export function SettingsForm({ s }: { s: SettingsValues }) {
  return (
    <ActionForm action={saveSettingsAction} className="max-w-3xl space-y-5">
      {(pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Row label="Festival name">
              <Input name="festival_name" defaultValue={s.festival_name} required />
            </Row>
            <Row label="Year">
              <Input name="festival_year" type="number" defaultValue={s.festival_year} required />
            </Row>
          </div>
          <Row label="Venue">
            <Input name="venue" defaultValue={s.venue} required />
          </Row>
          <div className="grid gap-4 sm:grid-cols-4">
            <Row label="Start date">
              <Input name="start_date" type="date" defaultValue={s.start_date} required />
            </Row>
            <Row label="End date">
              <Input name="end_date" type="date" defaultValue={s.end_date} required />
            </Row>
            <Row label="Opens">
              <Input
                name="daily_open_time"
                type="time"
                defaultValue={s.daily_open_time.slice(0, 5)}
                required
              />
            </Row>
            <Row label="Closes">
              <Input
                name="daily_close_time"
                type="time"
                defaultValue={s.daily_close_time.slice(0, 5)}
                required
              />
            </Row>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Row label="Winners per day">
              <Input
                name="draw_winners_per_day"
                type="number"
                min={1}
                max={100}
                defaultValue={s.draw_winners_per_day}
              />
            </Row>
            <Row label="Staff account limit">
              <Input
                name="staff_limit"
                type="number"
                min={1}
                max={200}
                defaultValue={s.staff_limit}
              />
            </Row>
            <Row label="Consent text version" hint="Bump when the consent wording changes.">
              <Input name="consent_text_version" defaultValue={s.consent_text_version} />
            </Row>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Switches</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="registration_open"
                defaultChecked={s.registration_open}
                className="size-5"
              />
              Registration open
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="self_checkin_enabled"
                defaultChecked={s.self_checkin_enabled}
                className="size-5"
              />
              Self check-in enabled
            </label>
          </fieldset>
          <Row label="Privacy contact email">
            <Input name="contact_email" type="email" defaultValue={s.contact_email ?? ''} />
          </Row>
          <Row label="Privacy notice" hint="Plain text. Separate paragraphs with a blank line.">
            <Textarea name="privacy_text" rows={10} defaultValue={s.privacy_text} />
          </Row>
          <label className="bg-warning-50 flex items-start gap-2 rounded-lg p-3 text-sm">
            <input type="checkbox" name="confirm_drop_dates" className="mt-0.5 size-5" />I
            understand that removing festival dates hides them from the form even if people already
            chose them.
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save settings'}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

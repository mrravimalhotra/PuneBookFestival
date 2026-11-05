'use client';

/* eslint-disable @next/next/no-img-element -- live previews of local files (blob: URLs) and storage URLs */
import { useEffect, useState, useTransition } from 'react';
import {
  reorderPartnersAction,
  savePartnerAction,
  togglePartnerAction,
} from '@/app/admin/partners/actions';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { PARTNER_PLACEMENTS, PARTNER_TIERS } from '@/lib/validation/admin';
import { ActionForm } from './action-form';
import { SortableList } from './sortable-list';

export type AdminPartner = {
  id: string;
  name: string;
  type: 'organiser' | 'sponsor';
  tier: (typeof PARTNER_TIERS)[number];
  logo_url: string | null;
  website_url: string | null;
  tagline: string | null;
  display_order: number;
  is_active: boolean;
  show_on: string[];
  festival_year: number;
};

const PLACEMENT_LABEL: Record<string, string> = {
  home: 'Home page',
  header: 'Header',
  footer: 'Footer',
  pass: 'Pass & confirmation',
  checkin_success: 'Check-in success',
  winners: 'Winners page',
  reports: 'PDF reports',
  venue_qr: 'Venue QR poster',
};

function LogoInput({ current }: { current: string | null }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [size, setSize] = useState<number | null>(null);
  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div className="flex items-center gap-4">
      <span className="border-line flex h-20 w-44 items-center justify-center rounded-md border bg-white p-2">
        {preview ? (
          <img src={preview} alt="Logo preview" className="max-h-16 max-w-40 object-contain" />
        ) : (
          <span className="text-muted text-xs">No logo</span>
        )}
      </span>
      <label className="flex-1">
        <span className="mb-1 block text-sm font-semibold">Logo (SVG, PNG or WebP, max 1 MB)</span>
        <input
          type="file"
          name="logo"
          accept="image/svg+xml,image/png,image/webp"
          className="block w-full text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPreview(URL.createObjectURL(f));
              setSize(f.size);
            }
          }}
        />
        {size !== null && size > 200 * 1024 ? (
          <span className="text-warning-800 mt-1 block text-sm">
            This file is {Math.round(size / 1024)} KB. Logos under 200 KB load faster.
          </span>
        ) : null}
      </label>
    </div>
  );
}

export function PartnerForm({ partner, year }: { partner?: AdminPartner; year: number }) {
  const p = partner;
  return (
    <ActionForm action={savePartnerAction} className="space-y-4">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={p?.id ?? ''} />
          <input type="hidden" name="display_order" value={p?.display_order ?? 1000} />
          <input type="hidden" name="festival_year" value={p?.festival_year ?? year} />
          <LogoInput current={p?.logo_url ?? null} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-sm font-semibold">Name</span>
              <Input name="name" defaultValue={p?.name} required />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Type</span>
              <Select name="type" defaultValue={p?.type ?? 'sponsor'}>
                <option value="organiser">Organiser</option>
                <option value="sponsor">Sponsor</option>
              </Select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Tier</span>
              <Select name="tier" defaultValue={p?.tier ?? 'partner'}>
                {PARTNER_TIERS.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold">Website (optional)</span>
              <Input
                name="website_url"
                type="url"
                defaultValue={p?.website_url ?? ''}
                placeholder="https://"
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Tagline (optional)</span>
              <Input name="tagline" defaultValue={p?.tagline ?? ''} maxLength={160} />
            </label>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Show on</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {PARTNER_PLACEMENTS.map((pl) => (
                <label key={pl} className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="show_on"
                    value={pl}
                    defaultChecked={p ? p.show_on.includes(pl) : ['home', 'footer'].includes(pl)}
                    className="size-4"
                  />
                  {PLACEMENT_LABEL[pl]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={p?.is_active ?? true}
              className="size-5"
            />
            Visible on the site
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : p ? 'Save changes' : 'Add'}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => void (await togglePartnerAction(id, !active)))}
    >
      {active ? 'Hide' : 'Show'}
    </Button>
  );
}

export function PartnerList({
  partners,
  year,
  label,
}: {
  partners: AdminPartner[];
  year: number;
  label: string;
}) {
  return (
    <SortableList
      label={label}
      items={partners}
      onReorder={reorderPartnersAction}
      render={(p) => (
        <div className="flex items-start gap-2">
          <details className="min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="border-line flex h-12 w-24 items-center justify-center rounded border bg-white p-1">
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt={`Logo of ${p.name}`}
                    className="max-h-10 max-w-22 object-contain"
                  />
                ) : null}
              </span>
              <span className="font-semibold">{p.name}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs capitalize">
                {p.tier}
              </span>
              {!p.is_active ? (
                <span className="bg-warning-50 text-warning-800 rounded-full px-2 py-0.5 text-xs">
                  Hidden
                </span>
              ) : null}
            </summary>
            <div className="mt-4">
              <PartnerForm partner={p} year={year} />
            </div>
          </details>
          <ToggleButton id={p.id} active={p.is_active} />
        </div>
      )}
    />
  );
}

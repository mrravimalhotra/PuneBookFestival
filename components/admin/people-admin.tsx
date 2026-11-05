'use client';

/* eslint-disable @next/next/no-img-element -- live crop preview of a local file (blob: URL) */
import { useEffect, useState, useTransition } from 'react';
import {
  reorderPeopleAction,
  savePersonAction,
  togglePersonAction,
} from '@/app/admin/people/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { PEOPLE_PLACEMENTS } from '@/lib/validation/admin';
import { ActionForm } from './action-form';
import { SortableList } from './sortable-list';

export type AdminPerson = {
  id: string;
  full_name: string;
  designation: string;
  organisation: string | null;
  photo_url: string | null;
  short_message: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  show_on: string[];
  festival_year: number;
  photo_consent: boolean;
};

const PLACEMENT_LABEL: Record<string, string> = {
  home: 'Home page',
  about: 'Organisers page',
  pass: 'Confirmation screen',
  checkin_success: 'Check-in success',
  reports: 'Reports & poster',
};

/** Square crop with live preview: pick zoom and focal point; the server applies it. */
function PhotoCrop({ current }: { current: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.5);
  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src],
  );

  // Preview math mirrors lib/uploads.ts preparePhoto().
  let style: React.CSSProperties = {};
  if (src && natural) {
    const side = Math.min(natural.w, natural.h) / zoom;
    const left = Math.min(natural.w - side, Math.max(0, cx * natural.w - side / 2));
    const top = Math.min(natural.h - side, Math.max(0, cy * natural.h - side / 2));
    const scale = 160 / side;
    style = {
      width: natural.w * scale,
      height: natural.h * scale,
      maxWidth: 'none',
      transform: `translate(${-left * scale}px, ${-top * scale}px)`,
    };
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="relative size-40 overflow-hidden rounded-full bg-stone-200">
        {src ? (
          <img
            src={src}
            alt="Crop preview"
            style={style}
            onLoad={(e) =>
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
          />
        ) : current ? (
          <img src={current} alt="Current photo" className="size-40 object-cover" />
        ) : (
          <span className="text-muted flex size-40 items-center justify-center text-xs">
            No photo
          </span>
        )}
      </div>
      <div className="min-w-56 flex-1 space-y-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            Photo (JPG, PNG or WebP, max 2 MB)
          </span>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setNatural(null);
                setZoom(1);
                setCx(0.5);
                setCy(0.5);
                setSrc(URL.createObjectURL(f));
              }
            }}
          />
        </label>
        {src ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              Zoom{' '}
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Left–right{' '}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={cx}
                onChange={(e) => setCx(Number(e.target.value))}
                className="flex-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Up–down{' '}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={cy}
                onChange={(e) => setCy(Number(e.target.value))}
                className="flex-1"
              />
            </label>
          </>
        ) : null}
        <input type="hidden" name="crop_x" value={cx} />
        <input type="hidden" name="crop_y" value={cy} />
        <input type="hidden" name="crop_zoom" value={zoom} />
      </div>
    </div>
  );
}

export function PersonForm({ person, year }: { person?: AdminPerson; year: number }) {
  const p = person;
  return (
    <ActionForm action={savePersonAction} className="space-y-4">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={p?.id ?? ''} />
          <input type="hidden" name="display_order" value={p?.display_order ?? 1000} />
          <input type="hidden" name="festival_year" value={p?.festival_year ?? year} />
          <PhotoCrop current={p?.photo_url ?? null} />
          <label className="bg-warning-50 flex items-start gap-2 rounded-lg p-3 text-sm">
            <input
              type="checkbox"
              name="photo_consent"
              defaultChecked={p?.photo_consent ?? false}
              className="mt-0.5 size-5"
            />
            This person has agreed to have their photo published. (Unticking removes the photo from
            the site.)
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-sm font-semibold">Full name</span>
              <Input name="full_name" defaultValue={p?.full_name} required />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Designation</span>
              <Input
                name="designation"
                defaultValue={p?.designation}
                required
                placeholder="Festival Convenor"
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Organisation (optional)</span>
              <Input name="organisation" defaultValue={p?.organisation ?? ''} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              Welcome message (optional, max 300 characters)
            </span>
            <Textarea
              name="short_message"
              maxLength={300}
              rows={3}
              defaultValue={p?.short_message ?? ''}
            />
          </label>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Show on</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
              {PEOPLE_PLACEMENTS.map((pl) => (
                <label key={pl} className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="show_on"
                    value={pl}
                    defaultChecked={p ? p.show_on.includes(pl) : ['home', 'about'].includes(pl)}
                    className="size-4"
                  />
                  {PLACEMENT_LABEL[pl]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={p?.is_featured ?? false}
                className="size-5"
              />
              Featured (shown first and larger)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={p?.is_active ?? true}
                className="size-5"
              />
              Visible on the site
            </label>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : p ? 'Save changes' : 'Add person'}
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
      onClick={() => start(async () => void (await togglePersonAction(id, !active)))}
    >
      {active ? 'Hide' : 'Show'}
    </Button>
  );
}

export function PeopleList({ people, year }: { people: AdminPerson[]; year: number }) {
  return (
    <SortableList
      label="Key people"
      items={people}
      onReorder={reorderPeopleAction}
      render={(p) => (
        <div className="flex items-start gap-2">
          <details className="min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="size-12 overflow-hidden rounded-full bg-stone-200">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={`Photo of ${p.full_name}, ${p.designation}`}
                    className="size-12 object-cover"
                  />
                ) : null}
              </span>
              <span>
                <span className="block font-semibold">{p.full_name}</span>
                <span className="text-muted text-sm">{p.designation}</span>
              </span>
              {p.is_featured ? (
                <span className="bg-accent-100 text-accent-700 rounded-full px-2 py-0.5 text-xs">
                  Featured
                </span>
              ) : null}
              {!p.is_active ? (
                <span className="bg-warning-50 text-warning-800 rounded-full px-2 py-0.5 text-xs">
                  Hidden
                </span>
              ) : null}
            </summary>
            <div className="mt-4">
              <PersonForm person={p} year={year} />
            </div>
          </details>
          <ToggleButton id={p.id} active={p.is_active} />
        </div>
      )}
    />
  );
}

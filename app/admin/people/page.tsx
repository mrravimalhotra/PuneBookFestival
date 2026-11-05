import type { Metadata } from 'next';
import { Suspense } from 'react';
import { personPhotoUrl } from '@/lib/storage-url';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { PeopleList, PersonForm, type AdminPerson } from '@/components/admin/people-admin';

export const metadata: Metadata = { title: 'Key people' };

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Key people (organisers’ photos)</h1>
      <p className="text-muted">
        Photos are cropped to 600×600 and 1200×800, and location/EXIF data is removed on upload.
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PeopleContent />
      </Suspense>
    </div>
  );
}

async function PeopleContent() {
  const supabase = await createClient();
  const [{ data }, { data: s }] = await Promise.all([
    supabase
      .from('key_people')
      .select(
        'id, full_name, designation, organisation, photo_path, short_message, display_order, is_featured, is_active, show_on, festival_year, photo_consent',
      )
      .order('display_order'),
    supabase.from('settings').select('festival_year').eq('id', 1).single(),
  ]);
  const year = s?.festival_year ?? new Date().getFullYear();
  const people: AdminPerson[] = (data ?? []).map(({ photo_path, ...p }) => ({
    ...p,
    photo_url: personPhotoUrl(photo_path),
  }));
  return (
    <>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Add a person</h2>
        <PersonForm year={year} />
      </Card>
      <PeopleList people={people} year={year} />
    </>
  );
}

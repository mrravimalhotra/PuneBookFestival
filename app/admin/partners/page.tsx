import type { Metadata } from 'next';
import { Suspense } from 'react';
import { partnerLogoUrl } from '@/lib/storage-url';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { PartnerForm, PartnerList, type AdminPartner } from '@/components/admin/partner-admin';

export const metadata: Metadata = { title: 'Sponsors & organisers' };

export default function PartnersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sponsors & organisers</h1>
      <p className="text-muted">
        Changes appear on the public site immediately. Drag or use the arrows to reorder.
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PartnersContent />
      </Suspense>
    </div>
  );
}

async function PartnersContent() {
  const supabase = await createClient();
  const [{ data }, { data: s }] = await Promise.all([
    supabase
      .from('partners')
      .select(
        'id, name, type, tier, logo_path, website_url, tagline, display_order, is_active, show_on, festival_year',
      )
      .order('display_order'),
    supabase.from('settings').select('festival_year').eq('id', 1).single(),
  ]);
  const year = s?.festival_year ?? new Date().getFullYear();
  const all: AdminPartner[] = (data ?? []).map(({ logo_path, ...p }) => ({
    ...p,
    logo_url: partnerLogoUrl(logo_path),
  }));
  return (
    <>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Add an organiser or sponsor</h2>
        <PartnerForm year={year} />
      </Card>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Organisers</h2>
        <PartnerList
          partners={all.filter((p) => p.type === 'organiser')}
          year={year}
          label="Organisers"
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Sponsors</h2>
        <PartnerList
          partners={all.filter((p) => p.type === 'sponsor')}
          year={year}
          label="Sponsors"
        />
      </section>
    </>
  );
}

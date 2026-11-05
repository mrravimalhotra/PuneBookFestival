import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Skeleton } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuditList />
      </Suspense>
    </div>
  );
}

async function AuditList() {
  const supabase = await createClient();
  const [{ data: entries }, { data: people }] = await Promise.all([
    supabase
      .from('audit_log')
      .select('id, actor_id, action, entity, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('id, full_name'),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return (
    <div className="rounded-card border-line overflow-x-auto border bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-stone-50">
          <tr>
            {['When', 'Who', 'Action', 'Entity', 'Details'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((e) => (
            <tr key={e.id} className="border-line border-t align-top">
              <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
              <td className="px-3 py-2">{(e.actor_id && names.get(e.actor_id)) ?? '—'}</td>
              <td className="px-3 py-2 font-mono">{e.action}</td>
              <td className="px-3 py-2">
                {e.entity}
                {e.entity_id ? ` · ${e.entity_id}` : ''}
              </td>
              <td className="max-w-md px-3 py-2">
                <code className="block truncate text-xs" title={JSON.stringify(e.details)}>
                  {JSON.stringify(e.details)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

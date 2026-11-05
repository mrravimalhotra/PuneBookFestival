import type { Metadata } from 'next';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { REPORTS, type ReportKey } from '@/lib/reports/definitions';
import { AGE_BANDS } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Reports' };

/** Each report downloads as Excel (full, streamed) or PDF (summary, capped rows). */
export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-muted">
        Exports are generated on the server and logged in the audit trail.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(REPORTS) as ReportKey[]).map((key) => (
          <Card key={key}>
            <h2 className="text-lg font-bold">{REPORTS[key].title}</h2>
            <p className="text-muted mb-4 text-sm">{REPORTS[key].description}</p>
            <form action={`/api/admin/reports/${key}`} method="get" className="space-y-3">
              {key === 'attendees' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-sm font-semibold">Search</span>
                    <Input name="q" placeholder="Name, mobile, email, code" />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">Chosen day</span>
                    <Input name="date" type="date" />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">Gender</span>
                    <Select name="gender" defaultValue="">
                      <option value="">All</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </Select>
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">Age band</span>
                    <Select name="age_band" defaultValue="">
                      <option value="">All</option>
                      {AGE_BANDS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-sm font-semibold">City</span>
                    <Input name="city" />
                  </label>
                </div>
              ) : null}
              {key === 'checkins' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-sm font-semibold">From</span>
                    <Input name="from" type="date" />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">To</span>
                    <Input name="to" type="date" />
                  </label>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="format" value="xlsx" variant="secondary">
                  <FileSpreadsheet aria-hidden="true" className="size-5" /> Excel (.xlsx)
                </Button>
                <Button type="submit" name="format" value="pdf" variant="secondary">
                  <FileText aria-hidden="true" className="size-5" /> PDF
                </Button>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}

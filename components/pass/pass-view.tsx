'use client';

import { CheckCircle2, Download, FileDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { savePass } from '@/lib/pass-store';
import type { PassSnapshot } from '@/lib/pass-types';
import { PassCard } from './pass-card';

/** Pass with Download PNG / PDF buttons; saves itself to the device for offline use. */
export function PassView({
  pass,
  status,
  saveOffline = true,
}: {
  pass: PassSnapshot;
  status?: React.ReactNode;
  saveOffline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saveOffline) return;
    savePass(pass)
      .then(() => setSaved(true))
      .catch((err: unknown) => console.warn('pass.save', err));
  }, [pass, saveOffline]);

  async function renderPng(): Promise<string> {
    const { toPng } = await import('html-to-image');
    if (!ref.current) throw new Error('Pass not mounted');
    return toPng(ref.current, { pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: false });
  }

  const fileBase = `${pass.festivalName}-${pass.festivalYear}-${pass.passCode}`.replace(
    /\s+/g,
    '-',
  );

  async function downloadPng() {
    setBusy('png');
    try {
      const dataUrl = await renderPng();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileBase}.png`;
      a.click();
    } catch (err) {
      console.warn('pass.png', err);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy('pdf');
    try {
      const [{ jsPDF }, dataUrl] = await Promise.all([import('jspdf'), renderPng()]);
      const node = ref.current!;
      const ratio = node.offsetHeight / node.offsetWidth;
      // A6 portrait (105 × 148 mm), pass centred with margins.
      const pdf = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
      const pageW = 105;
      const pageH = 148;
      let w = pageW - 10;
      let h = w * ratio;
      if (h > pageH - 10) {
        h = pageH - 10;
        w = h / ratio;
      }
      pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.setProperties({ title: `${pass.festivalName} ${pass.festivalYear} — ${pass.passCode}` });
      pdf.save(`${fileBase}.pdf`);
    } catch (err) {
      console.warn('pass.pdf', err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <PassCard ref={ref} pass={pass} status={status} />
      <div className="no-print mx-auto grid max-w-sm grid-cols-2 gap-3">
        <Button
          variant="secondary"
          onClick={downloadPng}
          disabled={busy !== null}
          aria-busy={busy === 'png'}
        >
          <Download aria-hidden="true" className="size-5" />
          {busy === 'png' ? t('pass.downloading') : t('pass.downloadPng')}
        </Button>
        <Button
          variant="secondary"
          onClick={downloadPdf}
          disabled={busy !== null}
          aria-busy={busy === 'pdf'}
        >
          <FileDown aria-hidden="true" className="size-5" />
          {busy === 'pdf' ? t('pass.downloading') : t('pass.downloadPdf')}
        </Button>
      </div>
      <p className="no-print text-muted mx-auto max-w-sm text-center text-sm" aria-live="polite">
        {saved ? (
          <span className="text-success-700 inline-flex items-center gap-1">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t('pass.savedOffline')}
          </span>
        ) : null}{' '}
        {t('pass.saveTip')}
      </p>
    </div>
  );
}

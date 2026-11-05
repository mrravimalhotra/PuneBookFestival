import Image from 'next/image';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { partnerLogoUrl } from '@/lib/storage-url';
import type { Partner } from '@/lib/data/public';

const SIZES = {
  xs: { w: 72, h: 32 },
  sm: { w: 112, h: 48 },
  md: { w: 160, h: 72 },
  lg: { w: 220, h: 100 },
  xl: { w: 300, h: 132 },
} as const;
export type LogoSize = keyof typeof SIZES;

/**
 * Logo in a fixed-size box (no layout shift), aspect ratio preserved, neutral
 * background, descriptive alt text, and a sponsored link in a new tab.
 */
export function PartnerLogo({
  partner,
  size = 'md',
  priority = false,
  linked = true,
  className,
}: {
  partner: Pick<Partner, 'name' | 'logo_path' | 'website_url'>;
  size?: LogoSize;
  priority?: boolean;
  linked?: boolean;
  className?: string;
}) {
  const { w, h } = SIZES[size];
  const src = partnerLogoUrl(partner.logo_path);
  const box = (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-md bg-white p-1.5',
        className,
      )}
      style={{ width: w, height: h }}
    >
      {src ? (
        <Image
          src={src}
          alt={t('common.logoOf', { name: partner.name })}
          fill
          sizes={`${w}px`}
          quality={85}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          unoptimized={partner.logo_path.toLowerCase().endsWith('.svg')}
          className="object-contain p-1.5"
        />
      ) : (
        <span className="text-muted text-center text-xs font-semibold">{partner.name}</span>
      )}
    </span>
  );

  if (!linked || !partner.website_url) return box;
  return (
    <a
      href={partner.website_url}
      target="_blank"
      rel="noopener sponsored"
      className="inline-flex rounded-md focus-visible:outline-offset-4"
      aria-label={`${t('common.logoOf', { name: partner.name })} ${t('common.opensNewTab')}`}
    >
      {box}
    </a>
  );
}

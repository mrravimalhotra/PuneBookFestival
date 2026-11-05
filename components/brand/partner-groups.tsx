import { t } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import type { Partner } from '@/lib/data/public';
import type { PartnerTier } from '@/lib/validation/admin';
import { PartnerLogo, type LogoSize } from './partner-logo';

const TIER_SIZE: Record<PartnerTier, LogoSize> = {
  title: 'xl',
  platinum: 'lg',
  gold: 'md',
  silver: 'sm',
  partner: 'sm',
};
const TIERS: PartnerTier[] = ['title', 'platinum', 'gold', 'silver', 'partner'];

/** Home page sponsor wall: grouped by tier, larger logos for higher tiers. */
export function SponsorWall({ sponsors }: { sponsors: Partner[] }) {
  const groups = TIERS.map((tier) => ({
    tier,
    items: sponsors.filter((s) => s.tier === tier),
  })).filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className="space-y-10">
      {groups.map(({ tier, items }) => (
        <section key={tier} aria-labelledby={`tier-${tier}`}>
          <h3
            id={`tier-${tier}`}
            className="text-muted mb-4 text-center text-sm font-bold tracking-widest uppercase"
          >
            {t(`home.tier.${tier}`)}
          </h3>
          <ul className="flex flex-wrap items-center justify-center gap-4">
            {items.map((p) => (
              <li key={p.id}>
                <PartnerLogo partner={p} size={TIER_SIZE[tier]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Compact strip ("Supported by", footer, pass, check-in success). */
export function LogoStrip({
  partners,
  label,
  size = 'sm',
  className,
  linked = true,
}: {
  partners: Partner[];
  label?: string;
  size?: LogoSize;
  className?: string;
  linked?: boolean;
}) {
  if (partners.length === 0) return null;
  return (
    <div className={cn('text-center', className)}>
      {label ? (
        <p className="text-muted mb-2 text-xs font-bold tracking-widest uppercase">{label}</p>
      ) : null}
      <ul className="flex flex-wrap items-center justify-center gap-3">
        {partners.map((p) => (
          <li key={p.id}>
            <PartnerLogo partner={p} size={size} linked={linked} />
          </li>
        ))}
      </ul>
    </div>
  );
}

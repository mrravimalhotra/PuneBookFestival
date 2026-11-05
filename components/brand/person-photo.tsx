import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { personPhotoUrl } from '@/lib/storage-url';
import type { KeyPerson } from '@/lib/data/public';

/** Square crop, fixed box, neutral placeholder when there is no photo. */
export function PersonPhoto({
  person,
  size,
  priority = false,
  rounded = 'full',
  className,
}: {
  person: Pick<KeyPerson, 'full_name' | 'designation' | 'photo_path'>;
  size: number;
  priority?: boolean;
  rounded?: 'full' | 'xl';
  className?: string;
}) {
  const src = personPhotoUrl(person.photo_path, 'square');
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-stone-200',
        rounded === 'full' ? 'rounded-full' : 'rounded-xl',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={t('common.photoOf', { name: person.full_name, designation: person.designation })}
          fill
          sizes={`${size}px`}
          quality={85}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          className="object-cover"
        />
      ) : (
        <UserRound aria-hidden="true" className="h-1/2 w-1/2 text-stone-400" />
      )}
    </span>
  );
}

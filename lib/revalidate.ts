import 'server-only';
import { updateTag } from 'next/cache';
import { TAGS } from '@/lib/data/public';

/** Called from admin Server Actions so public pages show changes immediately. */
export function revalidatePublic(...tags: Array<keyof typeof TAGS>) {
  for (const t of tags) updateTag(TAGS[t]);
}

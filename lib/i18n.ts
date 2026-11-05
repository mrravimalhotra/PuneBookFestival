import en from '@/messages/en.json';

/**
 * Minimal, dependency-free i18n. All UI strings live in messages/<locale>.json.
 * Adding Marathi later = add messages/mr.json with the same keys and a locale
 * switch; no component changes needed.
 */
type Messages = typeof en;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string];

export type MessageKey = Paths<Messages>;

const catalogs: Record<string, Messages> = { en };

export const DEFAULT_LOCALE = 'en';

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node)
      node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(
  key: MessageKey | string,
  vars?: Record<string, string | number>,
  locale = DEFAULT_LOCALE,
): string {
  const messages = catalogs[locale] ?? en;
  const template = lookup(messages, key) ?? lookup(en, key) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Typed translator: t('register.title', { festival, year }) */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(key, vars);
}

/** Translate a validation message key coming from Zod (falls back to the raw text). */
export function tError(message: string | undefined): string {
  if (!message) return '';
  return translate(message);
}

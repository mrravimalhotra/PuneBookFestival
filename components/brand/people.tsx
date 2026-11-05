import { t } from '@/lib/i18n';
import type { KeyPerson } from '@/lib/data/public';
import { PersonPhoto } from './person-photo';

/**
 * "Meet the Organisers": large portrait cards, featured first and larger.
 * Scrolls sideways on small screens.
 */
export function PeopleCards({
  people,
  priorityCount = 3,
}: {
  people: KeyPerson[];
  priorityCount?: number;
}) {
  if (people.length === 0) return null;
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
      {people.map((p, i) => (
        <li
          key={p.id}
          className={`rounded-card border-line flex shrink-0 snap-start flex-col items-center border bg-white p-5 text-center ${
            p.is_featured ? 'w-64 sm:w-72' : 'w-56 sm:w-60'
          }`}
        >
          <PersonPhoto
            person={p}
            size={p.is_featured ? 176 : 160}
            priority={i < priorityCount && p.is_featured}
            className={p.is_featured ? 'sm:!h-[220px] sm:!w-[220px]' : ''}
          />
          <p className="mt-4 text-lg leading-tight font-bold">{p.full_name}</p>
          <p className="text-muted mt-1 text-sm">{p.designation}</p>
          {p.organisation ? <p className="text-muted text-sm">{p.organisation}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Highlighted quote card with the lead organiser's photo and message. */
export function WelcomeQuote({ person }: { person: KeyPerson }) {
  if (!person.short_message) return null;
  return (
    <figure className="rounded-card border-accent-300 bg-accent-100 flex flex-col items-center gap-5 border p-6 sm:flex-row sm:items-start">
      <PersonPhoto person={person} size={120} />
      <div>
        <blockquote className="text-ink text-lg leading-relaxed sm:text-xl">
          “{person.short_message}”
        </blockquote>
        <figcaption className="mt-3 text-sm">
          <span className="font-bold">{person.full_name}</span>
          <span className="text-muted">
            {' '}
            · {person.designation}
            {person.organisation ? `, ${person.organisation}` : ''}
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

/** Small "Welcome from" strip for confirmation and check-in screens. */
export function WelcomeFromStrip({ people }: { people: KeyPerson[] }) {
  const featured = people.filter((p) => p.is_featured).slice(0, 4);
  if (featured.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-muted text-xs font-bold tracking-widest uppercase">
        {t('pass.welcomeFrom')}
      </p>
      <ul className="flex flex-wrap justify-center gap-4">
        {featured.map((p) => (
          <li key={p.id} className="flex w-24 flex-col items-center text-center">
            <PersonPhoto person={p} size={56} />
            <span className="mt-1 text-xs leading-tight font-semibold">{p.full_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

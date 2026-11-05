import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'block min-h-11 w-full rounded-lg border border-stone-400 bg-white px-3 py-2 text-base text-ink placeholder:text-stone-500 aria-[invalid=true]:border-danger-600 disabled:bg-stone-100';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'pr-8', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-28', className)} {...props} />;
}

export function Label({
  className,
  htmlFor,
  children,
  ...props
}: ComponentProps<'label'> & { htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-ink mb-1 block text-sm font-semibold', className)}
      {...props}
    >
      {children}
    </label>
  );
}

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint + error, wired with aria-describedby by id convention. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  optionalLabel = 'optional',
  children,
  className,
}: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="text-muted ml-1 font-normal">({optionalLabel})</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p
      id={id}
      role={message ? 'alert' : undefined}
      className={cn('text-danger-700 mt-1 text-sm font-medium', !message && 'sr-only')}
    >
      {message ?? ''}
    </p>
  );
}

export function describedBy(id: string, hasHint: boolean) {
  return [hasHint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ');
}

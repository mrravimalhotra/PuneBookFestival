import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-card border-line bg-card border p-5 shadow-sm sm:p-6', className)}
      {...props}
    />
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-success-600/40 bg-success-50 text-success-700',
  warning: 'border-warning-500/50 bg-warning-50 text-warning-800',
  danger: 'border-danger-600/40 bg-danger-50 text-danger-700',
};

export function Alert({
  tone = 'info',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: Tone }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3', tones[tone], className)}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'bg-accent-100 text-accent-700 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-stone-200', className)} />
  );
}

export function PageTitle({ className, children, ...props }: ComponentProps<'h1'>) {
  return (
    <h1
      className={cn('text-ink text-3xl font-bold tracking-tight sm:text-4xl', className)}
      {...props}
    >
      {children}
    </h1>
  );
}

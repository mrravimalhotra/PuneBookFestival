import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// shadcn/ui-style button. Minimum 44px tap target.
export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: 'border border-brand-600 bg-white text-brand-700 hover:bg-brand-50',
        ghost: 'text-brand-700 hover:bg-brand-50',
        accent: 'bg-accent-500 text-ink hover:bg-accent-300',
        danger: 'bg-danger-600 text-white hover:bg-danger-700',
        outline: 'border border-line bg-white text-ink hover:bg-stone-50',
      },
      size: {
        sm: 'min-h-9 px-3 text-sm',
        md: '',
        lg: 'min-h-13 px-7 text-lg',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function LinkButton({ className, variant, size, block, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

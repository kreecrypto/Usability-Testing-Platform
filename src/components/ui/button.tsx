'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/ui';
const buttonVariants = cva('', { variants: { variant: {
  default: 'tw:inline-flex tw:items-center tw:justify-center tw:gap-ah-8 tw:min-h-[var(--ah-button-md-height)] tw:rounded-ah-sm tw:border tw:border-solid tw:border-primary tw:bg-primary tw:text-on-primary tw:px-ah-16 tw:font-ah tw:font-semibold tw:hover:bg-primary-dark tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-primary tw:disabled:opacity-60',
  secondary: 'tw:inline-flex tw:items-center tw:justify-center tw:gap-ah-8 tw:min-h-[var(--ah-button-md-height)] tw:rounded-ah-sm tw:border tw:border-solid tw:border-hairline tw:bg-canvas tw:text-ink tw:px-ah-16 tw:focus-visible:outline-2 tw:focus-visible:outline-primary',
  legacy: '',
} }, defaultVariants: { variant: 'default' } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; loading?: boolean; }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, asChild = false, loading = false, disabled, children, ...props }, ref) {
  const Component = asChild ? Slot : 'button';
  const inactive = disabled || loading;
  const stop = (event: React.SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); };
  // Slot normally prefers child props. Clone the child so it cannot override inactivity.
  const content = asChild && inactive && React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        disabled: true, 'aria-disabled': true, 'aria-busy': loading || undefined,
        tabIndex: -1, href: undefined, onClick: stop, onClickCapture: stop,
        onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') stop(event); },
      }) : children;
  // Preserve native form type/default submission. Never inject type="button" here.
  return <Component {...props} ref={ref} className={cn(buttonVariants({ variant }), className)} data-ui="button" disabled={disabled || loading || undefined} aria-busy={loading || props['aria-busy']} aria-disabled={asChild && inactive ? true : props['aria-disabled']} onClickCapture={asChild && inactive ? stop : props.onClickCapture}>
    {loading && !asChild ? <><LoaderCircle aria-hidden="true" data-ui="icon" className="tw:motion-safe:animate-spin" />{children}</> : content}
  </Component>;
});

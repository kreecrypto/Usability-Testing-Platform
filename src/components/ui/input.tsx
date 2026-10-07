'use client';
import * as React from 'react';
import { cn } from '@/lib/ui';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { appearance?: 'default' | 'legacy'; }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({className, appearance='default', ...props},ref) {
  return <input {...props} ref={ref} data-ui="input" className={cn(appearance==='default' && 'tw:w-full tw:min-w-0 tw:min-h-[var(--ah-button-md-height)] tw:border tw:border-solid tw:border-hairline tw:rounded-ah-sm tw:bg-canvas tw:text-ink tw:px-ah-16 tw:focus-visible:outline-2 tw:focus-visible:outline-primary',className)} />;
});

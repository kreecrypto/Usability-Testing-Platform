import type { HTMLAttributes, Ref } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/ui';
export function Card({className,asChild=false,appearance='default',...props}:HTMLAttributes<HTMLDivElement> & {asChild?:boolean;appearance?:'default'|'legacy';ref?:Ref<HTMLDivElement>}) {
  const Component=asChild?Slot:'div';
  return <Component {...props} data-ui="card" className={cn(appearance==='default'&&'tw:min-w-0 tw:rounded-ah-lg tw:border tw:border-solid tw:border-hairline tw:bg-canvas tw:text-ink tw:p-ah-24 tw:shadow-ah-card',className)} />;
}

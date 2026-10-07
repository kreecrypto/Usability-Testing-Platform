import type { HTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/ui';
export function Badge({className,appearance='default',...props}:HTMLAttributes<HTMLSpanElement>&{appearance?:'default'|'legacy';ref?:Ref<HTMLSpanElement>}) {
  return <span {...props} data-ui="badge" className={cn(appearance==='default'&&'tw:inline-flex tw:items-center tw:gap-ah-4 tw:rounded-ah-sm tw:bg-muted tw:text-ink tw:px-ah-8',className)} />;
}
